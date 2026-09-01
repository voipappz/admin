defmodule AgentsDemo.TurnsTest do
  use AgentsDemo.DataCase, async: false
  use Mimic

  import AgentsDemo.AccountsFixtures
  import AgentsDemo.BotsFixtures
  import AgentsDemo.ConversationsFixtures

  alias AgentsDemo.Agents.Coordinator
  alias AgentsDemo.Conversations
  alias AgentsDemo.Turns
  alias Sagents.AgentServer

  setup :set_mimic_global

  setup do
    scope = user_scope_fixture()
    conversation = conversation_fixture(%{scope: scope})
    %{scope: scope, conversation: conversation}
  end

  defp expect_agent do
    stub(Coordinator, :ensure_agent_session_running, fn _state, _opts ->
      {:ok, %{agent_id: "agent-1"}}
    end)

    stub(AgentServer, :add_message, fn _agent_id, _message -> :ok end)
  end

  test "a turn reaches the agent and records when it happened", %{
    scope: scope,
    conversation: conversation
  } do
    expect_agent()
    now = DateTime.utc_now()

    assert {:ok, :accepted} =
             Turns.submit(scope, conversation.id, %Turns.Input{text: " hello ", origin: :chat},
               now: now
             )

    {:ok, reloaded} = Conversations.get_conversation(scope, conversation.id)
    assert DateTime.compare(reloaded.last_user_message_at, now) == :eq
  end

  test "a human holding the conversation stops the bot", %{
    scope: scope,
    conversation: conversation
  } do
    {:ok, _touched} = Conversations.set_handler(scope, conversation.id, :human)

    reject(&Coordinator.ensure_agent_session_running/2)
    reject(&AgentServer.add_message/2)

    assert {:ok, :handed_off} =
             Turns.submit(scope, conversation.id, %Turns.Input{text: "hi", origin: :whatsapp})

    messages = Conversations.load_display_messages(scope, conversation.id)

    assert [
             %{
               message_type: "user",
               content: %{"text" => "hi"},
               metadata: %{"origin" => "whatsapp"}
             }
           ] = messages
  end

  test "an option id is what the user said when there is no text", %{
    scope: scope,
    conversation: conversation
  } do
    expect_agent()

    assert {:ok, :accepted} =
             Turns.submit(scope, conversation.id, %Turns.Input{
               reply_id: "fault",
               origin: :whatsapp
             })
  end

  test "an empty message is refused", %{scope: scope, conversation: conversation} do
    assert {:error, :empty_message} =
             Turns.submit(scope, conversation.id, %Turns.Input{text: "   ", origin: :api})
  end

  test "a silent conversation restarts its flow", %{scope: scope} do
    expect_agent()

    bot =
      published_bot_fixture(scope,
        version: valid_version_attrs(%{"limits" => %{"session_idle_timeout_seconds" => 3600}})
      )

    conversation = conversation_fixture(%{scope: scope, bot_id: bot.id})
    long_ago = DateTime.add(DateTime.utc_now(), -7200, :second)

    {:ok, _posted} =
      Conversations.touch_turn(scope, conversation.id, %{
        last_user_message_at: long_ago,
        flow_state: %{state: "ask_line", vars: %{"line" => "031234567"}}
      })

    assert {:ok, :accepted} =
             Turns.submit(scope, conversation.id, %Turns.Input{text: "hello", origin: :whatsapp})

    {:ok, reloaded} = Conversations.get_conversation(scope, conversation.id)
    assert reloaded.flow_state == nil
  end

  test "a conversation still warm keeps its flow position", %{scope: scope} do
    expect_agent()

    bot =
      published_bot_fixture(scope,
        version: valid_version_attrs(%{"limits" => %{"session_idle_timeout_seconds" => 3600}})
      )

    conversation = conversation_fixture(%{scope: scope, bot_id: bot.id})

    {:ok, _posted} =
      Conversations.touch_turn(scope, conversation.id, %{
        last_user_message_at: DateTime.utc_now(),
        flow_state: %{state: "ask_line", vars: %{}}
      })

    assert {:ok, :accepted} =
             Turns.submit(scope, conversation.id, %Turns.Input{
               text: "031234567",
               origin: :whatsapp
             })

    {:ok, reloaded} = Conversations.get_conversation(scope, conversation.id)
    assert reloaded.flow_state.state == "ask_line"
  end

  test "another owner's conversation is not found", %{conversation: conversation} do
    assert {:error, :not_found} =
             Turns.submit(user_scope_fixture(), conversation.id, %Turns.Input{
               text: "hi",
               origin: :api
             })
  end
end
