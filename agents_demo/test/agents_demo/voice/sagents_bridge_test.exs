defmodule AgentsDemo.Voice.SagentsBridgeTest do
  @moduledoc """
  The bridge is a `Feline.Processor`, which is a plain callback module — no
  pipeline is needed to drive it. Every test here calls a callback directly and
  asserts on what it returns, which is the whole contract: frames pushed
  downstream, and state carried forward.

  Three of these guard failures that would survive a demo. They are the reason
  the file exists.
  """

  use ExUnit.Case, async: true
  use Mimic

  alias AgentsDemo.Voice.SagentsBridge

  defmodule TestTurns do
    def submit(_scope, _conversation_id, %AgentsDemo.Turns.Input{text: text}, _opts) do
      send(self(), {:submitted, text})
      {:ok, :accepted}
    end
  end

  alias Feline.Frames.All.{
    ErrorFrame,
    InterruptionFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMMessagesAppendFrame,
    LLMTextFrame,
    TranscriptionFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame
  }

  alias LangChain.Message
  alias LangChain.MessageDelta
  alias Sagents.AgentServer

  # Deliberately NOT `set_mimic_global`: every callback here is invoked directly
  # in the test process, so private mode is both sufficient and compatible with
  # `async: true`. Global mode is process-wide and would break unrelated async
  # tests in other files.

  # The bridge only ever calls `ctx.push` for the greeting; everything else is
  # returned. Sending to self() keeps those visible to the test.
  defp ctx do
    test = self()

    %{
      push: fn frame, direction -> send(test, {:pushed, frame, direction}) end,
      self: test,
      name: :bridge
    }
  end

  defp state(overrides \\ %{}) do
    {:ok, state} = SagentsBridge.init(conversation_id: "conv-1", scope: :scope, turns: TestTurns)
    Map.merge(%{state | agent_id: "conversation-conv-1"}, overrides)
  end

  # Anthropic streams each content block at its own index — thinking in one,
  # text in another — and LangChain merges by index. Deltas built without one
  # would collapse into a single slot, which is not what the provider sends.
  defp delta(content, index) do
    %MessageDelta{role: :assistant, status: :incomplete, content: content, index: index}
  end

  defp text_delta(text), do: delta(LangChain.Message.ContentPart.text!(text), 1)
  defp thinking_delta(text), do: delta(LangChain.Message.ContentPart.thinking!(text), 0)

  describe "thinking is never spoken" do
    test "a delta carrying only thinking pushes nothing" do
      deltas = [thinking_delta("The caller wants their balance. I should check.")]

      assert {:ok, _state} =
               SagentsBridge.handle_info({:agent, {:llm_deltas, deltas}}, ctx(), state())
    end

    test "a delta carrying thinking and text pushes only the text" do
      deltas = [
        thinking_delta("Let me reason about this at length."),
        text_delta("Your balance is twelve pounds.")
      ]

      assert {:push, %LLMTextFrame{text: spoken}, :downstream, _state} =
               SagentsBridge.handle_info({:agent, {:llm_deltas, deltas}}, ctx(), state())

      assert spoken == "Your balance is twelve pounds."
      refute spoken =~ "reason"
    end

    test "thinking arriving before text does not delay or corrupt the spoken text" do
      s = state()

      assert {:ok, s} =
               SagentsBridge.handle_info(
                 {:agent, {:llm_deltas, [thinking_delta("thinking hard")]}},
                 ctx(),
                 s
               )

      assert {:push, %LLMTextFrame{text: "Hello."}, :downstream, _s} =
               SagentsBridge.handle_info(
                 {:agent, {:llm_deltas, [text_delta("Hello.")]}},
                 ctx(),
                 s
               )
    end
  end

  describe "streaming pushes each token once" do
    test "successive deltas push only the new text, never a repeat" do
      s = state()

      {:push, %LLMTextFrame{text: first}, :downstream, s} =
        SagentsBridge.handle_info({:agent, {:llm_deltas, [text_delta("Your ")]}}, ctx(), s)

      {:push, %LLMTextFrame{text: second}, :downstream, s} =
        SagentsBridge.handle_info(
          {:agent, {:llm_deltas, [text_delta("balance ")]}},
          ctx(),
          s
        )

      {:push, %LLMTextFrame{text: third}, :downstream, _s} =
        SagentsBridge.handle_info({:agent, {:llm_deltas, [text_delta("is £12.")]}}, ctx(), s)

      assert first == "Your "
      assert second == "balance "
      assert third == "is £12."
      assert first <> second <> third == "Your balance is £12."
    end

    test "a delta that adds no text pushes nothing rather than an empty frame" do
      s = state()

      {:push, _frame, :downstream, s} =
        SagentsBridge.handle_info({:agent, {:llm_deltas, [text_delta("Hi.")]}}, ctx(), s)

      assert {:ok, _s} =
               SagentsBridge.handle_info({:agent, {:llm_deltas, [delta(nil, 1)]}}, ctx(), s)
    end
  end

  describe "a cancelled turn stays silent" do
    test "deltas arriving after an interruption are not spoken" do
      expect(AgentServer, :cancel, fn "conversation-conv-1" -> :ok end)

      {:push, %InterruptionFrame{}, :downstream, s} =
        SagentsBridge.handle_frame(%InterruptionFrame{}, :downstream, ctx(), state())

      refute s.accepting?

      assert {:ok, _s} =
               SagentsBridge.handle_info(
                 {:agent, {:llm_deltas, [text_delta("the abandoned answer")]}},
                 ctx(),
                 s
               )
    end

    test "the next run reopens the gate and starts a fresh turn" do
      s = %{state() | accepting?: false, spoken: "stale text"}

      assert {:push, %LLMFullResponseStartFrame{}, :downstream, s} =
               SagentsBridge.handle_info({:agent, {:status_changed, :running, nil}}, ctx(), s)

      assert s.accepting?
      assert s.spoken == ""

      assert {:push, %LLMTextFrame{text: "Fresh."}, :downstream, _s} =
               SagentsBridge.handle_info(
                 {:agent, {:llm_deltas, [text_delta("Fresh.")]}},
                 ctx(),
                 s
               )
    end

    test "interruption cancels the generation and discards a half-spoken turn" do
      expect(AgentServer, :cancel, fn _agent_id -> :ok end)

      s = %{state() | spoken: "half a sen", aggregation: ["partial"]}

      {:push, _frame, :downstream, s} =
        SagentsBridge.handle_frame(%InterruptionFrame{}, :downstream, ctx(), s)

      assert s.spoken == ""
      assert s.aggregation == []
    end
  end

  describe "typed input reaches the agent" do
    test "an LLMMessagesAppendFrame becomes a user message" do
      frame = %LLMMessagesAppendFrame{
        messages: [%{"role" => "user", "content" => "what is my balance"}],
        run_llm: true
      }

      assert {:ok, _state} = SagentsBridge.handle_frame(frame, :downstream, ctx(), state())

      assert_received {:submitted, "what is my balance"}
    end

    test "a frame carrying no user content submits nothing" do
      frame = %LLMMessagesAppendFrame{messages: [%{"role" => "assistant", "content" => "hi"}]}

      assert {:ok, _state} = SagentsBridge.handle_frame(frame, :downstream, ctx(), state())
    end
  end

  describe "turn aggregation" do
    test "transcriptions accumulate while speaking and commit when the caller stops" do
      s = state()

      {:push, _frame, :downstream, s} =
        SagentsBridge.handle_frame(%UserStartedSpeakingFrame{}, :downstream, ctx(), s)

      {:ok, s} =
        SagentsBridge.handle_frame(
          %TranscriptionFrame{text: "what is"},
          :downstream,
          ctx(),
          s
        )

      {:ok, s} =
        SagentsBridge.handle_frame(
          %TranscriptionFrame{text: "my balance"},
          :downstream,
          ctx(),
          s
        )

      refute_received {:submitted, _}

      {:push, _frame, :downstream, s} =
        SagentsBridge.handle_frame(%UserStoppedSpeakingFrame{}, :downstream, ctx(), s)

      assert_received {:submitted, "what is my balance"}
      assert s.aggregation == []
    end

    test "a final transcription landing after the turn ended commits immediately" do
      # speaking? is false: the caller already stopped, STT was just late.
      assert {:ok, _s} =
               SagentsBridge.handle_frame(
                 %TranscriptionFrame{text: "late transcript"},
                 :downstream,
                 ctx(),
                 state()
               )

      assert_received {:submitted, "late transcript"}
    end

    test "silence commits nothing" do
      {:push, _frame, :downstream, s} =
        SagentsBridge.handle_frame(%UserStoppedSpeakingFrame{}, :downstream, ctx(), state())

      assert s.aggregation == []
    end
  end

  describe "turn boundaries" do
    test "a completed message ends the response and resets for the next turn" do
      s = %{state() | spoken: "everything said"}

      assert {:push, %LLMFullResponseEndFrame{}, :downstream, s} =
               SagentsBridge.handle_info(
                 {:agent, {:llm_message, Message.new_assistant!("done")}},
                 ctx(),
                 s
               )

      assert s.spoken == ""
      assert s.merged == nil
    end

    test "an agent error surfaces as a non-fatal frame rather than killing the call" do
      assert {:push, %ErrorFrame{fatal: false}, :downstream, _s} =
               SagentsBridge.handle_info(
                 {:agent, {:status_changed, :error, :boom}},
                 ctx(),
                 state()
               )
    end

    test "unrelated agent events are ignored" do
      assert {:ok, _s} =
               SagentsBridge.handle_info({:agent, {:todos_updated, []}}, ctx(), state())
    end
  end
end
