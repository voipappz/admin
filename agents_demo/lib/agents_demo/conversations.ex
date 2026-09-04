defmodule Connectix.Conversations do
  @moduledoc """
  Conversations, their display messages, and their agent state — on Mnesia.

  Every function takes an `Connectix.Accounts.Scope` and filters on its owner.
  Persistence is `Connectix.Conversations.Store`; no Ecto, no Postgres. The
  tool-call lifecycle, agent-state upsert, and message ordering are all plain
  Elixir over Mnesia rows.
  """

  alias Connectix.Conversations.{Store, Conversation, DisplayMessage, AgentState, FlowState}
  alias Connectix.Accounts.Scope
  alias Connectix.Mnesia
  alias Sagents.Todo

  ## Bot-lifecycle helpers

  @doc "Count of conversations pinned to each version of a bot: `%{version_id => count}`."
  def count_by_version(bot_id) do
    Store.index_by_bot(bot_id) |> Enum.frequencies_by(& &1.bot_version_id)
  end

  @doc "Whether any conversation pins this bot."
  def exists_for_bot?(bot_id), do: Store.index_by_bot(bot_id) != []

  @doc "The bot_version_id a conversation pins, or nil."
  def pinned_version_id(conversation_id) do
    case Store.get(conversation_id) do
      %Conversation{bot_version_id: id} -> id
      _ -> nil
    end
  end

  ## Conversation CRUD

  def create_conversation(%Scope{} = scope, attrs) do
    Mnesia.transaction(fn ->
      with {:ok, pin} <- Connectix.Bots.resolve_pin(scope, attrs),
           {:ok, conv} <- Conversation.validate_new(owner_id(scope), attrs, pin) do
        Store.put(conv)
      else
        {:error, reason} -> :mnesia.abort(reason)
      end
    end)
  end

  @doc "A conversation with its bot and pinned version (skills included) attached."
  def get_conversation_with_version(%Scope{} = scope, id) do
    with {:ok, conv} <- get_conversation(scope, id) do
      {:ok, %{conv | bot: Connectix.Bots.Store.get_bot(conv.bot_id), bot_version: Connectix.Bots.Store.get_version(conv.bot_version_id)}}
    end
  end

  def set_handler(%Scope{} = scope, conversation_id, handler) when handler in [:bot, :human] do
    with {:ok, conv} <- get_conversation(scope, conversation_id) do
      updated =
        case handler do
          :human -> %{conv | handler: :human, handed_off_at: DateTime.utc_now()}
          :bot -> %{conv | handler: :bot, handed_off_at: nil, flow_state: nil}
        end

      stored = Store.put(updated)
      broadcast(conversation_id, {:handler_changed, handler})
      {:ok, stored}
    end
  end

  def hand_off(%Scope{} = scope, conversation_id, %{key: key} = info) do
    with {:ok, conv} <- get_conversation(scope, conversation_id),
         {:ok, _} <-
           update_conversation(conv, %{
             metadata: Map.merge(conv.metadata || %{}, %{"handoff_key" => key, "handoff_topic" => info[:topic]})
           }) do
      set_handler(scope, conversation_id, :human)
    end
  end

  def return_to_bot(%Scope{} = scope, conversation_id), do: set_handler(scope, conversation_id, :bot)

  def touch_turn(%Scope{} = scope, conversation_id, attrs) do
    with {:ok, conv} <- get_conversation(scope, conversation_id), do: update_conversation(conv, attrs)
  end

  def topic(conversation_id), do: "conversation:#{conversation_id}"

  def post_bot_reply(%Scope{} = scope, conversation_id, content) when is_map(content),
    do: post_assistant(scope, conversation_id, content, %{"author" => "bot"})

  def post_human_reply(%Scope{} = scope, conversation_id, text) when is_binary(text),
    do: post_assistant(scope, conversation_id, %{"text" => text}, %{"author" => "human", "user_id" => scope.user.id})

  def append_user_message(%Scope{} = scope, conversation_id, text, origin) when is_binary(text) do
    append_display_message(scope, conversation_id, %{
      message_type: "user", content_type: "text", content: %{"text" => text},
      status: "completed", metadata: %{"origin" => to_string(origin)}
    })
  end

  defp post_assistant(scope, conversation_id, content, metadata) do
    attrs = %{
      message_type: "assistant", content_type: DisplayMessage.content_type_for(content),
      content: content, status: "completed", metadata: metadata
    }

    with {:ok, message} <- append_display_message(scope, conversation_id, attrs),
         {:ok, conv} <- get_conversation(scope, conversation_id) do
      Connectix.Channels.deliver(message, conv)
      broadcast(conversation_id, {:display_message_saved, message})
      {:ok, message}
    end
  end

  defp broadcast(conversation_id, event),
    do: Phoenix.PubSub.broadcast(Connectix.PubSub, topic(conversation_id), {:conversation, event})

  def get_conversation!(%Scope{} = scope, id) do
    case get_conversation(scope, id) do
      {:ok, conv} -> conv
      {:error, :not_found} -> raise KeyError, key: id, term: __MODULE__
    end
  end

  def get_conversation(%Scope{} = scope, id) do
    case Store.get(id) do
      %Conversation{user_id: uid} = conv -> if uid == owner_id(scope), do: {:ok, conv}, else: {:error, :not_found}
      nil -> {:error, :not_found}
    end
  end

  def list_conversations(%Scope{} = scope, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    offset = Keyword.get(opts, :offset, 0)

    scope
    |> owner_id()
    |> Store.list_for_user()
    |> Enum.sort_by(& &1.updated_at, {:desc, DateTime})
    |> Enum.drop(offset)
    |> Enum.take(limit)
  end

  @doc "The newest scoped conversation whose source and metadata value match."
  def latest_by_source_metadata(%Scope{} = scope, source, key, value)
      when is_binary(source) and is_binary(key) do
    scope
    |> list_conversations(limit: 10_000)
    |> Enum.find(fn conversation ->
      conversation.source == source and Map.get(conversation.metadata || %{}, key) == value
    end)
  end

  def update_conversation(%Conversation{} = conv, attrs) do
    attrs = Map.new(attrs, fn {k, v} -> {to_string(k), v} end)

    updated = %{
      conv
      | title: Map.get(attrs, "title", conv.title),
        version: Map.get(attrs, "version", conv.version),
        metadata: Map.get(attrs, "metadata", conv.metadata),
        source: Map.get(attrs, "source", conv.source),
        last_user_message_at: Map.get(attrs, "last_user_message_at", conv.last_user_message_at),
        flow_state: flow_state(attrs, conv.flow_state)
    }

    {:ok, Store.put(updated)}
  end

  defp flow_state(attrs, current) do
    case Map.fetch(attrs, "flow_state") do
      {:ok, nil} -> nil
      {:ok, %FlowState{} = fs} -> fs
      {:ok, map} when is_map(map) -> FlowState.new(map)
      :error -> current
    end
  end

  def delete_conversation(%Conversation{} = conv), do: {:ok, tap(conv, &Store.delete(&1.id))}

  def delete_conversation(%Scope{} = scope, conversation_id) when is_binary(conversation_id) do
    with {:ok, conv} <- get_conversation(scope, conversation_id) do
      Store.delete(conv.id)
      {:ok, conv}
    end
  end

  ## Agent state

  def save_agent_state(%Scope{} = scope, conversation_id, state) do
    with :ok <- authorize(scope, conversation_id) do
      existing = Store.get_agent_state(conversation_id)
      base = existing || %AgentState{conversation_id: conversation_id}
      {:ok, Store.put_agent_state(%{base | state_data: state, version: state["version"] || 1})}
    end
  end

  def set_interrupt_status(%Scope{} = scope, conversation_id, interrupted?) when is_boolean(interrupted?) do
    with {:ok, conv} <- get_conversation(scope, conversation_id) do
      update_conversation(conv, %{metadata: Map.put(conv.metadata || %{}, "interrupted", interrupted?)})
    end
  end

  def interrupted?(%Conversation{metadata: %{"interrupted" => true}}), do: true
  def interrupted?(_conversation), do: false

  def load_agent_state(%Scope{} = scope, conversation_id) do
    with :ok <- authorize(scope, conversation_id),
         %AgentState{state_data: data} <- Store.get_agent_state(conversation_id) do
      {:ok, data}
    else
      _ -> {:error, :not_found}
    end
  end

  def load_todos(%Scope{} = scope, conversation_id) do
    case load_agent_state(scope, conversation_id) do
      {:ok, %{"state" => %{"todos" => todos}}} when is_list(todos) ->
        case Todo.list_from_maps(todos) do
          {:ok, parsed} -> parsed
          {:error, _} -> []
        end

      _ ->
        []
    end
  end

  ## Display messages

  def append_display_message(%Scope{} = scope, conversation_id, attrs) do
    with :ok <- authorize(scope, conversation_id),
         {:ok, message} <- DisplayMessage.new(conversation_id, attrs) do
      {:ok, Store.insert_message(message)}
    end
  end

  def load_display_messages(%Scope{} = scope, conversation_id, opts \\ []) do
    case authorize(scope, conversation_id) do
      :ok ->
        Store.list_messages(conversation_id)
        |> drop_take(Keyword.get(opts, :offset), Keyword.get(opts, :limit))

      {:error, :not_found} ->
        []
    end
  end

  def append_text_message(%Scope{} = scope, conversation_id, message_type, text) do
    append_display_message(scope, conversation_id, %{
      message_type: message_type, content_type: "text", content: %{"text" => text}
    })
  end

  ## Tool-call lifecycle

  def mark_tool_executing(%Scope{} = scope, call_id),
    do: transition(scope, call_id, ["pending"], fn m -> %{m | status: "executing"} end)

  def complete_tool_call(%Scope{} = scope, call_id, result_metadata \\ %{}),
    do: transition(scope, call_id, ["pending", "executing", "interrupted"], fn m ->
      %{m | status: "completed", metadata: Map.merge(m.metadata || %{}, result_metadata)}
    end)

  def fail_tool_call(%Scope{} = scope, call_id, error_info \\ %{}),
    do: transition(scope, call_id, ["pending", "executing", "interrupted"], fn m ->
      %{m | status: "failed", metadata: Map.merge(m.metadata || %{}, error_info)}
    end)

  def interrupt_tool_call(%Scope{} = scope, call_id, interrupt_info \\ %{}),
    do: transition(scope, call_id, ["pending", "executing"], fn m ->
      %{m | status: "interrupted", metadata: Map.merge(m.metadata || %{}, interrupt_info)}
    end)

  def cancel_tool_call(%Scope{} = scope, call_id),
    do: transition(scope, call_id, ["pending", "executing", "interrupted"], fn m -> %{m | status: "cancelled"} end)

  def record_hitl_decision(%Scope{} = scope, call_id, decision) when decision in ["approved", "rejected"] do
    result =
      transition(scope, call_id, :any, fn m ->
        %{m | metadata: Map.put(m.metadata || %{}, "hitl_decision", decision)}
      end)

    # Stamp the matching tool_result too, when one exists.
    case find_message(scope, call_id, "tool_result", :any) do
      %DisplayMessage{} = tr -> Store.update_message(%{tr | content: Map.put(tr.content || %{}, "hitl_decision", decision)})
      _ -> :ok
    end

    result
  end

  def resolve_interrupted_tool_result(%Scope{} = scope, tool_call_id, result_content) do
    case find_message(scope, tool_call_id, "tool_result", :any) do
      %DisplayMessage{content: %{"is_interrupt" => true} = content} = m ->
        updated = content |> Map.put("is_interrupt", false) |> Map.put("content", result_content)
        {:ok, Store.update_message(%{m | content: updated})}

      _ ->
        {:error, :not_found}
    end
  end

  # Find a scoped tool_call message in one of `statuses` and apply `fun`.
  defp transition(scope, call_id, statuses, fun) do
    case find_message(scope, call_id, "tool_call", statuses) do
      %DisplayMessage{} = m -> {:ok, Store.update_message(fun.(m))}
      nil -> {:error, :not_found}
    end
  end

  defp find_message(%Scope{} = scope, call_id, content_type, statuses) do
    owner = owner_id(scope)

    Store.messages_by_tool_call(call_id)
    |> Enum.find(fn m ->
      m.content_type == content_type and
        (statuses == :any or m.status in statuses) and
        owns?(owner, m.conversation_id)
    end)
  end

  defp owns?(owner_id, conversation_id) do
    case Store.get(conversation_id) do
      %Conversation{user_id: ^owner_id} -> true
      _ -> false
    end
  end

  ## Search

  def search_messages(%Scope{} = scope, search_term) do
    term = String.downcase(search_term)
    owner = owner_id(scope)
    conv_ids = owner |> Store.list_for_user() |> MapSet.new(& &1.id)

    for id <- conv_ids, m <- Store.list_messages(id), matches?(m.content, term), do: m
  end

  defp matches?(content, term) do
    content |> inspect() |> String.downcase() |> String.contains?(term)
  end

  ## Helpers

  defp authorize(%Scope{} = scope, conversation_id) do
    case get_conversation(scope, conversation_id) do
      {:ok, _} -> :ok
      error -> error
    end
  end

  defp drop_take(list, offset, limit) do
    list = if offset, do: Enum.drop(list, offset), else: list
    if limit, do: Enum.take(list, limit), else: list
  end

  defp owner_id(%Scope{user: user}), do: user.id
end
