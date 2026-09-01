defmodule AgentsDemo.Channels.WhatsAppTest do
  use AgentsDemo.DataCase, async: false

  import AgentsDemo.AccountsFixtures
  import AgentsDemo.ConversationsFixtures

  alias AgentsDemo.Channels.WhatsApp.TestAdapter
  alias AgentsDemo.Conversations

  setup do
    TestAdapter.receive_here()

    for {name, value} <- [{"WHATSAPP_ACCESS_TOKEN", "t"}, {"WHATSAPP_PHONE_NUMBER_ID", "1"}],
        do: System.put_env(name, value)

    on_exit(fn ->
      System.delete_env("WHATSAPP_ACCESS_TOKEN")
      System.delete_env("WHATSAPP_PHONE_NUMBER_ID")
    end)

    scope = user_scope_fixture()

    conversation =
      conversation_fixture(%{
        scope: scope,
        source: "whatsapp",
        metadata: %{"phone" => "972501234567"}
      })

    %{scope: scope, conversation: conversation}
  end

  test "text goes out as text", %{scope: scope, conversation: conversation} do
    {:ok, _touched} = Conversations.post_bot_reply(scope, conversation.id, %{"text" => "שלום"})
    assert_receive {:whatsapp, %Anu.Message{to: "972501234567", body: "שלום"}}, 1_000
  end

  test "buttons go out as an interactive message with a header", %{
    scope: scope,
    conversation: conversation
  } do
    {:ok, _posted} =
      Conversations.post_bot_reply(scope, conversation.id, %{
        "kind" => "buttons",
        "text" => "אנא בחרו",
        "header_image_url" => "https://example.test/logo.png",
        "footer" => "נימבוס",
        "buttons" => [
          %{"id" => "fault", "title" => "תקלה"},
          %{"id" => "question", "title" => "שאלה"}
        ]
      })

    assert_receive {:whatsapp, %Anu.Message{} = message}, 1_000
    assert message.body == "אנא בחרו"
    assert message.buttons == [{"תקלה", "fault"}, {"שאלה", "question"}]
    assert message.header == %{type: "image", image: %{link: "https://example.test/logo.png"}}
    assert message.footer == "נימבוס"
  end

  test "a list goes out with sections and rows", %{scope: scope, conversation: conversation} do
    {:ok, _posted} =
      Conversations.post_bot_reply(scope, conversation.id, %{
        "kind" => "list",
        "text" => "בנוגע לאיזה פיצ׳ר?",
        "button_text" => "לחצו כאן",
        "sections" => [
          %{
            "title" => "פיצ׳רים",
            "rows" => [
              %{"id" => "sms", "title" => "sms"},
              %{"id" => "fax", "title" => "mail 2 fax"}
            ]
          }
        ]
      })

    assert_receive {:whatsapp, %Anu.Message{} = message}, 1_000
    assert message.button_text == "לחצו כאן"

    assert [%Anu.Section{title: "פיצ׳רים", rows: [%Anu.Row{id: "sms"}, %Anu.Row{id: "fax"}]}] =
             message.sections
  end

  test "an image goes out with its caption", %{scope: scope, conversation: conversation} do
    {:ok, _posted} =
      Conversations.post_bot_reply(scope, conversation.id, %{
        "url" => "https://example.test/a.jpg",
        "caption" => "כך"
      })

    assert_receive {:whatsapp, %Anu.Message{media: media}}, 1_000
    assert media.url == "https://example.test/a.jpg"
    assert media.caption == "כך"
  end

  test "what a phone sent is never sent back to it", %{scope: scope, conversation: conversation} do
    {:ok, _touched} = Conversations.append_user_message(scope, conversation.id, "מה קורה", :whatsapp)
    refute_receive {:whatsapp, _message}, 200
  end

  test "an operator's own reply does go out", %{scope: scope, conversation: conversation} do
    {:ok, _touched} = Conversations.set_handler(scope, conversation.id, :human)
    {:ok, _touched} = Conversations.post_human_reply(scope, conversation.id, "מדבר נציג")
    assert_receive {:whatsapp, %Anu.Message{body: "מדבר נציג"}}, 1_000
  end

  test "a browser conversation reaches no channel", %{scope: scope} do
    conversation = conversation_fixture(%{scope: scope})
    {:ok, _touched} = Conversations.post_bot_reply(scope, conversation.id, %{"text" => "hello"})
    refute_receive {:whatsapp, _message}, 200
  end

  test "interactive limits are refused when the message is written", %{
    scope: scope,
    conversation: conversation
  } do
    assert {:error, changeset} =
             Conversations.post_bot_reply(scope, conversation.id, %{
               "kind" => "buttons",
               "text" => "too many",
               "buttons" => for(n <- 1..4, do: %{"id" => "b#{n}", "title" => "Button #{n}"})
             })

    assert %{content: [message]} = errors_on(changeset)
    assert message =~ "1 to 3"

    assert {:error, changeset} =
             Conversations.post_bot_reply(scope, conversation.id, %{
               "kind" => "buttons",
               "text" => "too long",
               "buttons" => [%{"id" => "b", "title" => String.duplicate("x", 21)}]
             })

    assert %{content: [message]} = errors_on(changeset)
    assert message =~ "20 characters"
  end
end
