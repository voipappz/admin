defmodule Connectix.Agents.DisplayMessagePersistence do
  @moduledoc """
  Implements `Sagents.DisplayMessagePersistence` for display messages.

  Persists user-facing message representations to PostgreSQL and handles
  tool execution lifecycle status updates. Called from within the AgentServer
  process for exactly-once semantics.
  """

  @behaviour Sagents.DisplayMessagePersistence

  require Logger

  alias Sagents.Message.DisplayHelpers
  alias LangChain.Message

  @impl true
  def save_message(scope, %Message{} = message, context) do
    display_items = DisplayHelpers.extract_display_items(message)

    if Enum.empty?(display_items) do
      {:ok, []}
    else
      Enum.reduce_while(display_items, {:ok, []}, fn item, {:ok, acc} ->
        attrs = %{
          "message_type" => Atom.to_string(item.message_type),
          "content_type" => Atom.to_string(item.type),
          "content" => item.content
        }

        # Pull the tool-call id out of `content` into the top-level
        # `tool_call_id` column so the lifecycle queries can use an indexed
        # equality lookup. Tool calls additionally start in "pending" status.
        attrs =
          case item do
            %{type: :tool_call, content: %{"call_id" => call_id}} ->
              Map.merge(attrs, %{
                "tool_call_id" => call_id,
                "status" => "pending"
              })

            %{type: :tool_result, content: %{"tool_call_id" => tool_call_id}} ->
              Map.put(attrs, "tool_call_id", tool_call_id)

            _other ->
              attrs
          end

        case Connectix.Conversations.append_display_message(
               scope,
               context.conversation_id,
               attrs
             ) do
          {:ok, display_msg} ->
            {:cont, {:ok, acc ++ [display_msg]}}

          {:error, reason} ->
            Logger.error(
              "Failed to persist DisplayMessage (#{attrs["content_type"]}): #{inspect(reason)}"
            )

            {:halt, {:error, reason}}
        end
      end)
      |> deliver_to_channel(scope, context.conversation_id)
    end
  end

  # Offer each persisted message to whichever channel the conversation arrived
  # on. Conversations started in the browser have source "chat", which no
  # channel claims, so this is a no-op for them.
  #
  # Persistence is the right place for this: it is the one point every message
  # passes through exactly once, inside the AgentServer process. Hooking the
  # streaming path instead would send a WhatsApp message per token.
  defp deliver_to_channel({:ok, display_msgs} = result, scope, conversation_id) do
    case Connectix.Conversations.get_conversation(scope, conversation_id) do
      {:ok, conversation} ->
        Enum.each(display_msgs, &Connectix.Channels.deliver(&1, conversation))

      {:error, reason} ->
        Logger.warning("Skipped channel delivery for #{conversation_id}: #{inspect(reason)}")
    end

    result
  end

  defp deliver_to_channel(result, _scope, _conversation_id), do: result

  @impl true
  def update_tool_status(scope, :executing, %{call_id: call_id}, _context) do
    Connectix.Conversations.mark_tool_executing(scope, call_id)
  end

  def update_tool_status(
        scope,
        :completed,
        %{call_id: call_id, result: result} = tool_info,
        _context
      ) do
    metadata = %{"result" => result}

    metadata =
      case Map.get(tool_info, :display_text) do
        nil -> metadata
        text -> Map.put(metadata, "display_text", text)
      end

    Connectix.Conversations.complete_tool_call(scope, call_id, metadata)
  end

  def update_tool_status(scope, :failed, %{call_id: call_id, error: error}, _context) do
    Connectix.Conversations.fail_tool_call(scope, call_id, %{"error" => error})
  end

  def update_tool_status(
        scope,
        :interrupted,
        %{call_id: call_id, display_text: display_text},
        _context
      ) do
    Connectix.Conversations.interrupt_tool_call(scope, call_id, %{"display_text" => display_text})
  end

  def update_tool_status(scope, :cancelled, %{call_id: call_id}, _context) do
    Connectix.Conversations.cancel_tool_call(scope, call_id)
  end

  @doc """
  Resolves an interrupted tool result display message with the actual result content.
  Called after a sub-agent resumes and completes.
  """
  @impl true
  def resolve_tool_result(scope, tool_call_id, result_content, _context) do
    Connectix.Conversations.resolve_interrupted_tool_result(scope, tool_call_id, result_content)
  end

  @impl true
  def save_synthetic_message(_scope, _attrs, %{conversation_id: nil}),
    do: {:error, :no_conversation}

  def save_synthetic_message(scope, attrs, %{conversation_id: conversation_id}) do
    Connectix.Conversations.append_display_message(scope, conversation_id, attrs)
  end
end
