defmodule ConnectixWeb.Api.ConversationController do
  @moduledoc """
  The public API: create a conversation, send it a message, read the transcript.

  Sending is asynchronous. An agent turn may call tools and take many seconds,
  so `create_message/2` returns once the message is accepted and the agent has
  been started; callers poll `index_messages/2` for the reply. Holding the
  request open for the duration would tie a socket to the length of a
  conversation and time out on anything interesting.
  """

  use ConnectixWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias Connectix.Conversations
  alias Connectix.Conversations.Conversation
  alias Connectix.Turns
  alias ConnectixWeb.Api.Schemas

  action_fallback ConnectixWeb.Api.FallbackController

  tags(["conversations"])

  operation(:create,
    summary: "Start a conversation",
    description: """
    Pins a bot version for the life of the conversation: `bot_id` pins that
    bot's current published version, `bot_version_id` pins an exact published
    version (for reproducible integrations), neither pins your default bot.
    A later publish never moves an existing conversation.
    """,
    request_body:
      {"Conversation attributes", "application/json", Schemas.CreateConversationRequest,
       required: false},
    responses: [
      created: {"The conversation", "application/json", Schemas.ConversationResponse},
      unauthorized: {"Missing or invalid bearer token", "application/json", Schemas.Error}
    ]
  )

  def create(conn, params) do
    scope = conn.assigns.current_scope

    attrs =
      %{"source" => "api"}
      |> maybe_put_title(params)
      |> Map.merge(Map.take(params, ["bot_id", "bot_version_id"]))

    with {:ok, conversation} <- Conversations.create_conversation(scope, attrs) do
      conn
      |> put_status(:created)
      |> json(%{data: render_conversation(conversation)})
    end
  end

  operation(:create_message,
    summary: "Send a message to the agent",
    description: """
    Accepted immediately; the reply arrives asynchronously — poll the messages
    endpoint for it. Send `text`, or `reply_id` to choose an option the bot
    offered. Answers 409 when a human has taken the conversation over: the
    message is stored, but no reply will be generated.
    """,
    parameters: [id: [in: :path, type: :string, description: "Conversation id", required: true]],
    request_body:
      {"The message", "application/json", Schemas.CreateMessageRequest, required: true},
    responses: [
      accepted: {"Accepted for processing", "application/json", Schemas.Error},
      conflict: {"A human is answering this conversation", "application/json", Schemas.Error},
      not_found: {"No such conversation", "application/json", Schemas.Error},
      unauthorized: {"Missing or invalid bearer token", "application/json", Schemas.Error}
    ]
  )

  def create_message(conn, %{"id" => id} = params) do
    scope = conn.assigns.current_scope
    text = params |> Map.get("text", "") |> to_string() |> String.trim()
    reply_id = params["reply_id"]

    input = %Turns.Input{text: text, reply_id: reply_id, origin: :api}

    with :ok <- validate_text(text, reply_id),
         {:ok, outcome} <- Turns.submit(scope, id, input) do
      case outcome do
        :handed_off ->
          conn
          |> put_status(:conflict)
          |> json(%{status: "handed_off", error: "a human is answering this conversation"})

        _accepted_or_handled ->
          conn
          |> put_status(:accepted)
          |> json(%{status: "accepted"})
      end
    end
  end

  operation(:index_messages,
    summary: "Read a conversation's messages",
    parameters: [id: [in: :path, type: :string, description: "Conversation id", required: true]],
    responses: [
      ok: {"The messages, oldest first", "application/json", Schemas.MessagesResponse},
      not_found: {"No such conversation", "application/json", Schemas.Error},
      unauthorized: {"Missing or invalid bearer token", "application/json", Schemas.Error}
    ]
  )

  def index_messages(conn, %{"id" => id}) do
    scope = conn.assigns.current_scope

    with {:ok, %Conversation{}} <- Conversations.get_conversation(scope, id) do
      messages =
        scope
        |> Conversations.load_display_messages(id)
        |> Enum.map(&render_message/1)

      json(conn, %{data: messages})
    end
  end

  defp validate_text("", reply_id) when not is_binary(reply_id), do: {:error, :empty_message}
  defp validate_text(_text, _reply_id), do: :ok

  defp maybe_put_title(attrs, %{"title" => title}) when is_binary(title) and title != "",
    do: Map.put(attrs, "title", title)

  defp maybe_put_title(attrs, _params), do: attrs

  defp render_conversation(%Conversation{} = c) do
    %{
      id: c.id,
      title: c.title,
      source: c.source,
      bot_id: c.bot_id,
      bot_version_id: c.bot_version_id,
      handler: c.handler,
      inserted_at: c.inserted_at,
      updated_at: c.updated_at
    }
  end

  defp render_message(m) do
    %{
      id: m.id,
      role: m.message_type,
      type: m.content_type,
      text: text_of(m.content),
      status: m.status,
      inserted_at: m.inserted_at
    }
  end

  # Only textual content has a `text` key; tool calls and results are
  # structured, and flattening them into a string would lose the structure a
  # client might want.
  defp text_of(%{"text" => text}) when is_binary(text), do: text
  defp text_of(_content), do: nil
end
