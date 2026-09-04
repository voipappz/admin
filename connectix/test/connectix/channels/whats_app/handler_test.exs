defmodule Connectix.Channels.WhatsApp.HandlerTest do
  use Connectix.DataCase, async: false
  use Mimic

  import Connectix.AccountsFixtures
  import Connectix.BotsFixtures

  alias Connectix.Agents.Coordinator
  alias Connectix.Channels.WhatsApp.Handler
  alias Connectix.Conversations
  alias Sagents.AgentServer

  setup :set_mimic_global

  setup do
    test = self()

    stub(Coordinator, :ensure_agent_session_running, fn _state, _opts ->
      {:ok, %{agent_id: "agent-1"}}
    end)

    stub(AgentServer, :add_message, fn _agent_id, message ->
      send(test, {:submitted, text_of(message)})
      :ok
    end)

    user = user_fixture()
    System.put_env("WHATSAPP_OWNER_EMAIL", user.email)
    on_exit(fn -> System.delete_env("WHATSAPP_OWNER_EMAIL") end)

    %{user: user, scope: Connectix.Accounts.Scope.for_user(user)}
  end

  defp inbound(attrs), do: struct(%Anu.Event.Message{from: "972501234567"}, attrs)

  # LangChain carries a message's text as content parts.
  defp text_of(%{content: content}) when is_binary(content), do: content
  defp text_of(%{content: parts}) when is_list(parts), do: Enum.map_join(parts, & &1.content)

  defp conversation(scope) do
    scope
    |> Conversations.list_conversations(limit: 10_000)
    |> Enum.find(&(&1.source == "whatsapp"))
    |> tap(fn c -> assert c end)
    |> then(fn c ->
      {:ok, loaded} = Conversations.get_conversation(scope, c.id)
      loaded
    end)
  end

  test "a text message starts a thread on the owner's account", %{scope: scope} do
    assert :ok = Handler.handle_event(:message_received, inbound(%{type: "text", text: "שלום"}))

    conversation = conversation(scope)
    assert conversation.title == "WhatsApp +972501234567"
    assert conversation.metadata["phone"] == "972501234567"
    assert conversation.bot_version_id
    assert_received {:submitted, "שלום"}
  end

  test "the thread pins the bot named by WHATSAPP_BOT_SLUG", %{scope: scope} do
    bot = published_bot_fixture(scope, name: "Nimbus", slug: "nimbus")
    System.put_env("WHATSAPP_BOT_SLUG", "nimbus")
    on_exit(fn -> System.delete_env("WHATSAPP_BOT_SLUG") end)

    assert :ok = Handler.handle_event(:message_received, inbound(%{type: "text", text: "hi"}))
    assert conversation(scope).bot_id == bot.id
  end

  test "a handed-off thread stores what arrives and answers nothing", %{scope: scope} do
    Handler.handle_event(:message_received, inbound(%{type: "text", text: "first"}))
    conversation = conversation(scope)
    {:ok, _touched} = Conversations.set_handler(scope, conversation.id, :human)

    assert :ok =
             Handler.handle_event(
               :message_received,
               inbound(%{type: "text", text: "still here?"})
             )

    refute_received {:submitted, "still here?"}

    assert [
             %{
               message_type: "user",
               content: %{"text" => "still here?"},
               metadata: %{"origin" => "whatsapp"}
             }
           ] =
             Conversations.load_display_messages(scope, conversation.id)
  end

  test "a button reply is accepted as the option's id", %{scope: scope} do
    assert :ok =
             Handler.handle_event(
               :message_received,
               inbound(%{
                 type: "interactive",
                 button_reply: %{"id" => "fault", "title" => "תקלה"}
               })
             )

    assert_received {:submitted, "תקלה"}
    assert conversation(scope).source == "whatsapp"
  end

  test "a list reply is accepted too", %{scope: scope} do
    assert :ok =
             Handler.handle_event(
               :message_received,
               inbound(%{type: "interactive", list_reply: %{"id" => "sms", "title" => "sms"}})
             )

    assert_received {:submitted, "sms"}
    assert conversation(scope).source == "whatsapp"
  end

  test "a reaction is ignored" do
    assert :ok =
             Handler.handle_event(
               :message_received,
               inbound(%{type: "reaction", raw: %{"reaction" => %{"emoji" => "👍"}}})
             )

    assert whatsapp_conversations() == []
  end

  test "every message from a number continues the same conversation", %{scope: _scope} do
    Handler.handle_event(:message_received, inbound(%{type: "text", text: "one"}))
    Handler.handle_event(:message_received, inbound(%{type: "text", text: "two"}))

    assert [_single] = whatsapp_conversations()
    assert_received {:submitted, "one"}
    assert_received {:submitted, "two"}
  end

  test "a missing owner account drops the message rather than crashing" do
    System.put_env("WHATSAPP_OWNER_EMAIL", "nobody@example.invalid")
    assert :ok = Handler.handle_event(:message_received, inbound(%{type: "text", text: "hi"}))
    assert whatsapp_conversations() == []
  end

  defp whatsapp_conversations do
    Connectix.Accounts.Store.list_users()
    |> Enum.flat_map(fn user ->
      user
      |> Connectix.Accounts.Scope.for_user()
      |> Conversations.list_conversations(limit: 10_000)
    end)
    |> Enum.filter(&(&1.source == "whatsapp"))
  end
end
