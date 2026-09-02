defmodule AgentsDemo.Voice.SagentsBridge do
  @moduledoc """
  The one seam between Feline's media pipeline and the Sagents runtime.

  It sits where `Feline.Processors.ContextAggregator`, `Feline.Services.OpenAI.LLM`
  and `Feline.Processors.AssistantCollector` sit in Feline's own example, and
  replaces all three. Those three are a complete second agent runtime — they own
  a message history, call a model, and collect the reply. Sagents already does
  each of those, and is the only thing allowed to.

  So this module holds no conversation state. Its entire state is the
  conversation it is attached to, a counter, and the text it has already spoken.
  Kill it mid-call and the conversation is untouched: still in the database,
  still resumable, still openable in the browser.

  ## Downstream, from the ears

  Transcriptions aggregate into the current user turn and commit when the user
  stops speaking — or immediately, if a final transcription lands after the turn
  already ended, which is ordinary STT latency. A committed turn becomes exactly
  one `Sagents.AgentServer.add_message/2`.

  `LLMMessagesAppendFrame` is handled too, and that is not optional: Feline's
  RTVI processor turns the pipecat client's `send-text` action into one. It was
  `ContextAggregator` that consumed it, so a bridge that ignores it silently
  drops every typed message while voice keeps working — the kind of bug that
  survives a demo.

  ## Upstream, to the mouth

  The agent's `{:agent, …}` events — the same ones `AgentsDemoWeb.ChatLive`
  consumes — become the `LLMFullResponseStartFrame` / `LLMTextFrame` /
  `LLMFullResponseEndFrame` sequence the sentence aggregator and TTS expect.

  **Only `:text` content is ever spoken.** A `%LangChain.MessageDelta{}` carries
  thinking and text in the same stream, separated by `ContentPart` type, and the
  models this app runs have thinking enabled. Pushing delta content unfiltered
  would read the model's private reasoning aloud to the caller. Deltas are
  therefore merged and re-read as text, and only the part not yet spoken is
  pushed.

  ## Stale deltas after a barge-in

  Sagents carries no run identifier: one `AgentServer` per conversation, calls
  serialized, one execution in flight, so it never needs one. Voice does. When a
  caller talks over the bot we cancel the generation, but deltas already in this
  process's mailbox keep arriving — and speaking them answers the question the
  caller just abandoned.

  The gate is `accepting?`, closed by an interruption and reopened only by the
  next `{:status_changed, :running, _}`. That event is the run boundary Sagents
  does give us: every run announces itself before its first delta, so anything
  arriving while the gate is shut belongs to the run we killed.
  """

  use Feline.Processor

  require Logger

  alias AgentsDemo.Agents.Coordinator

  alias Feline.Frames.All.{
    InterruptionFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMMessagesAppendFrame,
    LLMTextFrame,
    TextFrame,
    TranscriptionFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame
  }

  alias LangChain.Message
  alias LangChain.MessageDelta
  alias Sagents.AgentServer

  @impl true
  def init(opts) do
    {:ok,
     %{
       conversation_id: Keyword.fetch!(opts, :conversation_id),
       scope: Keyword.fetch!(opts, :scope),
       turns: Keyword.get(opts, :turns, AgentsDemo.Turns),
       greeting: Keyword.get(opts, :greeting),
       agent_id: nil,
       # The caller is mid-sentence; transcriptions accumulate until they stop.
       speaking?: false,
       aggregation: [],
       # Closed by a barge-in, reopened by the next run's `:running`. See the
       # moduledoc: this is what stops a cancelled turn's tail being spoken.
       accepting?: true,
       # Deltas accumulated for the turn in flight. Merged rather than read
       # one by one because only the merged form classifies content into
       # thinking and text, and only text may be spoken.
       merged: nil,
       # The text already pushed for this turn. Kept as the string rather than
       # a byte offset so no arithmetic can split a multi-byte grapheme.
       spoken: ""
     }}
  end

  @impl true
  def handle_setup(_start_frame, ctx, state) do
    agent_id = Coordinator.conversation_agent_id(state.conversation_id)

    with {:ok, _session} <- ensure_agent(state),
         {:ok, _pid, _ref} <- AgentServer.subscribe(agent_id, :main, ctx.self) do
      maybe_greet(ctx, %{state | agent_id: agent_id})
    else
      error ->
        Logger.error("[voice] could not attach to #{agent_id}: #{inspect(error)}")
        {:ok, state}
    end
  end

  # ── Downstream: the caller ──────────────────────────────────────────────────

  @impl true
  def handle_frame(%UserStartedSpeakingFrame{} = frame, :downstream, _ctx, state) do
    {:push, frame, :downstream, %{state | speaking?: true}}
  end

  def handle_frame(%UserStoppedSpeakingFrame{} = frame, :downstream, _ctx, state) do
    state = %{state | speaking?: false}

    case commit_turn(state) do
      {:committed, state} -> {:push, frame, :downstream, state}
      {:nothing_said, state} -> {:push, frame, :downstream, state}
    end
  end

  # A final transcription arriving after the turn already ended is ordinary STT
  # latency, not a new turn — commit it immediately rather than holding it until
  # the caller happens to speak again.
  def handle_frame(%TranscriptionFrame{text: text}, :downstream, _ctx, state)
      when is_binary(text) do
    state = %{state | aggregation: [text | state.aggregation]}

    if state.speaking? do
      {:ok, state}
    else
      {_result, state} = commit_turn(state)
      {:ok, state}
    end
  end

  # Typed input from the pipecat client, via Feline's RTVI processor. Without
  # this clause it reaches nothing and is silently dropped.
  def handle_frame(%LLMMessagesAppendFrame{messages: messages}, _direction, _ctx, state) do
    text =
      messages
      |> Enum.filter(&(&1["role"] == "user"))
      |> Enum.map_join(" ", & &1["content"])
      |> String.trim()

    if text == "" do
      {:ok, state}
    else
      {:ok, submit(text, state)}
    end
  end

  # Barge-in. Cancelling is best-effort — what makes the bot stop is that we
  # bump the epoch and stop pushing, which does not depend on the agent
  # answering. Inbound audio is deliberately untouched: dropping it would deafen
  # the bot at exactly the moment the caller is talking.
  def handle_frame(%InterruptionFrame{} = frame, direction, _ctx, state) do
    {:push, frame, direction, interrupt(state)}
  end

  def handle_frame(frame, direction, _ctx, state), do: {:push, frame, direction, state}

  # ── Upstream: the agent ─────────────────────────────────────────────────────

  # A run announcing itself is the boundary that reopens the gate.
  @impl true
  def handle_info({:agent, {:status_changed, :running, _data}}, _ctx, state) do
    {:push, %LLMFullResponseStartFrame{}, :downstream, begin_turn(state)}
  end

  def handle_info({:agent, {:llm_deltas, deltas}}, _ctx, %{accepting?: true} = state)
      when is_list(deltas) do
    case speakable_increment(deltas, state) do
      {"", state} -> {:ok, state}
      {text, state} -> {:push, %LLMTextFrame{text: text}, :downstream, state}
    end
  end

  def handle_info({:agent, {:llm_message, %Message{}}}, _ctx, %{accepting?: true} = state) do
    {:push, %LLMFullResponseEndFrame{}, :downstream, end_turn(state)}
  end

  def handle_info({:agent, {:status_changed, :idle, _data}}, _ctx, %{accepting?: true} = state) do
    {:push, %LLMFullResponseEndFrame{}, :downstream, end_turn(state)}
  end

  # Everything below arrives while the gate is shut: the tail of a run we
  # cancelled. Consume it and say nothing.
  def handle_info({:agent, {:status_changed, :cancelled, _data}}, _ctx, state) do
    {:ok, end_turn(state)}
  end

  def handle_info({:agent, {:status_changed, :error, reason}}, _ctx, state) do
    Logger.error("[voice] agent error on #{state.conversation_id}: #{inspect(reason)}")

    {:push, %Feline.Frames.All.ErrorFrame{error: reason, fatal: false}, :downstream, state}
  end

  def handle_info({:agent, _other}, _ctx, state), do: {:ok, state}

  def handle_info(_message, _ctx, state), do: {:ok, state}

  # ── Internals ───────────────────────────────────────────────────────────────

  defp maybe_greet(ctx, %{greeting: greeting} = state) when is_binary(greeting) do
    ctx.push.(%TextFrame{text: greeting}, :downstream)
    {:ok, state}
  end

  defp maybe_greet(_ctx, state), do: {:ok, state}

  defp ensure_agent(state) do
    Coordinator.ensure_agent_session_running(%{
      conversation_id: state.conversation_id,
      current_scope: state.scope
    })
  end

  defp commit_turn(%{aggregation: []} = state), do: {:nothing_said, state}

  defp commit_turn(state) do
    text =
      state.aggregation
      |> Enum.reverse()
      |> Enum.join(" ")
      |> String.trim()

    if text == "" do
      {:nothing_said, %{state | aggregation: []}}
    else
      {:committed, submit(text, state)}
    end
  end

  defp submit(text, state) do
    state = %{state | aggregation: []}

    # Through Turns like every other surface, so a conversation a human has
    # taken over is not answered by the bot over voice either.
    case state.turns.submit(
           state.scope,
           state.conversation_id,
           %AgentsDemo.Turns.Input{
             text: text,
             origin: :voice
           },
           []
         ) do
      {:error, reason} ->
        Logger.error("[voice] could not submit turn: #{inspect(reason)}")
        state

      _accepted_or_handled ->
        state
    end
  end

  # Cancelling is best-effort; what actually stops the bot is shutting the gate,
  # which does not depend on the agent answering.
  defp interrupt(state) do
    if state.agent_id, do: AgentServer.cancel(state.agent_id)
    %{end_turn(state) | accepting?: false, aggregation: []}
  end

  defp begin_turn(state), do: %{state | accepting?: true, merged: nil, spoken: ""}

  defp end_turn(state), do: %{state | merged: nil, spoken: ""}

  # Accumulate the stream, re-read it as text only, and return whatever has not
  # been spoken yet.
  #
  # The merge is not an optimisation. An incoming delta's `content` is raw; only
  # the merged form classifies content into `ContentPart`s, and only that
  # classification separates the model's thinking from what it means to say.
  # Reading `delta.content` directly would read the chain of thought aloud.
  defp speakable_increment(deltas, state) do
    merged = MessageDelta.merge_deltas(state.merged, deltas)
    full = MessageDelta.content_to_string(merged, :text) || ""
    state = %{state | merged: merged}

    case String.replace_prefix(full, state.spoken, "") do
      # The merge rewrote text already spoken. Nothing sensible can be said
      # about the difference, so stay silent and resynchronise.
      ^full when state.spoken != "" -> {"", %{state | spoken: full}}
      increment -> {increment, %{state | spoken: full}}
    end
  end
end
