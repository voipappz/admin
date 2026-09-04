defmodule Connectix.Turns do
  @moduledoc """
  The one way a user turn enters the system.

  Every surface — the browser, WhatsApp, the HTTP API, voice — calls
  `submit/4`, so the rules that must hold for all of them hold in one place:

  1. **A human holding the conversation wins.** With `handler: :human` the
     message is stored and nothing is generated. This is what makes takeover
     real rather than advisory.
  2. **A silent conversation starts over.** When the pinned version sets
     `limits.session_idle_timeout_seconds` and the gap since the last user
     message exceeds it, any flow position is cleared before the turn runs.
  3. **Only then the model.** The agent session is started (or reused) and the
     message queued through `Sagents.AgentServer`.

  A deterministic flow will slot in between (2) and (3): the conversation's
  flow position is already loaded and reset here, and the step engine will
  answer from it without a model where it can.

  Returns `{:ok, :accepted}` when an agent is working on it, `{:ok, :handled}`
  when the answer was produced without a model, `{:ok, :handed_off}` when a
  human holds the conversation, or `{:error, reason}`.
  """

  alias Connectix.Accounts.Scope
  alias Connectix.Agents.Coordinator
  alias Connectix.Bots.Runtime
  alias Connectix.Controls.SessionTimeout
  alias Connectix.Conversations
  alias Connectix.Conversations.Conversation
  alias LangChain.Message
  alias Sagents.AgentServer

  require Logger

  defmodule Input do
    @moduledoc """
    What the user did: free text, or the id of an option they picked from an
    interactive message. `origin` records the surface it came from.
    """
    @enforce_keys [:origin]
    defstruct [:text, :reply_id, :origin, :external_id]

    @type t :: %__MODULE__{
            text: String.t() | nil,
            reply_id: String.t() | nil,
            origin: :chat | :whatsapp | :api | :voice,
            external_id: String.t() | nil
          }
  end

  @type outcome :: :accepted | :handled | :handed_off

  @spec submit(Scope.t(), term(), Input.t(), keyword()) :: {:ok, outcome()} | {:error, term()}
  def submit(%Scope{} = scope, conversation_id, %Input{} = input, opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now())
    text = display_text(input)

    with :ok <- validate(text),
         {:ok, conversation} <-
           Conversations.get_conversation_with_version(scope, conversation_id),
         {:ok, spec} <- Runtime.spec_for(conversation.bot_version) do
      case conversation.handler do
        :human ->
          Conversations.append_user_message(scope, conversation_id, text, input.origin)
          {:ok, :handed_off}

        :bot ->
          start_turn(scope, conversation, spec, now)
          to_agent(scope, conversation, text, opts)
      end
    end
  end

  # Record when this turn happened, and restart a flow that has gone cold.
  defp start_turn(scope, conversation, spec, now) do
    attrs = %{last_user_message_at: now}

    attrs =
      if SessionTimeout.expired?(conversation, spec.limits, now) and conversation.flow_state do
        Logger.info("conversation #{conversation.id}: flow expired, starting over")
        Map.put(attrs, :flow_state, nil)
      else
        attrs
      end

    case Conversations.touch_turn(scope, conversation.id, attrs) do
      {:ok, updated} -> %{updated | bot_version: conversation.bot_version, bot: conversation.bot}
      {:error, _reason} -> conversation
    end
  end

  defp to_agent(scope, %Conversation{id: id}, text, opts) do
    request_opts = Keyword.get(opts, :request_opts, [])

    with {:ok, %{agent_id: agent_id}} <-
           Coordinator.ensure_agent_session_running(
             %{conversation_id: id, current_scope: scope},
             request_opts
           ),
         :ok <- AgentServer.add_message(agent_id, Message.new_user!(text)) do
      {:ok, :accepted}
    end
  end

  # What the user "said": their text, or the label of the option they picked.
  # A reply id with no text is still a message — the flow engine reads
  # `reply_id`, the model reads this.
  defp display_text(%Input{text: text}) when is_binary(text) do
    case String.trim(text) do
      "" -> nil
      trimmed -> trimmed
    end
  end

  defp display_text(%Input{reply_id: id}) when is_binary(id), do: id
  defp display_text(_input), do: nil

  defp validate(nil), do: {:error, :empty_message}
  defp validate(_text), do: :ok
end
