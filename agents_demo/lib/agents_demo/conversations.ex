defmodule AgentsDemo.Conversations do
  @moduledoc """
  Context for conversation persistence with multi-content type support.

  ## Scope-Based Security

  Every public function takes a `AgentsDemo.Accounts.Scope` as its first argument.
  Use it to limit access and actions to the caller's authorized data.
  Wrong-scope callers receive `{:error, :not_found}`.

  ## Customization Required

  The generated code uses generic scope filtering. Customize `scope_query/2`,
  `scope_conversation_query/2`, and `get_owner_id/1` to match your Scope struct.

  ## Multi-Content Type Support

  Display messages support multiple content types (text, thinking, images, files, etc.).
  All content keys are strings (not atoms) due to JSONB storage.
  """

  import Ecto.Query, warn: false
  alias Sagents.Todo
  alias AgentsDemo.Repo
  alias AgentsDemo.Conversations.AgentState
  alias AgentsDemo.Conversations.Conversation
  alias AgentsDemo.Conversations.DisplayMessage
  alias AgentsDemo.Accounts.Scope, as: Scope

  #
  # Conversation CRUD
  #

  @doc """
  Creates a conversation within the given scope, pinned to a bot version.

  The conversation is associated with the scope's owner. `attrs` may name a
  `bot_id` (pins its current published version) or a `bot_version_id` (pins
  that exact published version); otherwise the owner's default bot answers.
  The decision and the insert happen in one transaction — see
  `AgentsDemo.Bots.resolve_pin/2`. Accepts attrs with either atom or string keys.
  """
  def create_conversation(%Scope{} = scope, attrs) do
    Repo.transaction(fn ->
      with {:ok, pin} <- AgentsDemo.Bots.resolve_pin(scope, attrs),
           {:ok, conversation} <-
             scope
             |> get_owner_id()
             |> Conversation.create_changeset(attrs, pin)
             |> Repo.insert() do
        conversation
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  A conversation with the bot and published version it pins, preloaded with
  the version's skills — what the agent factory compiles from.
  """
  def get_conversation_with_version(%Scope{} = scope, id) do
    Conversation
    |> scope_query(scope)
    |> preload([:bot, bot_version: :skills])
    |> Repo.get(id)
    |> case do
      nil -> {:error, :not_found}
      conversation -> {:ok, conversation}
    end
  end

  @doc """
  Hands the conversation to a person, or back to the bot. While a human
  holds it, `handler` is `:human`, the bot stands down, and a return clears
  any flow position so the bot starts fresh. Broadcasts
  `{:conversation, {:handler_changed, handler}}` on the conversation topic.
  """
  def set_handler(%Scope{} = scope, conversation_id, handler) when handler in [:bot, :human] do
    with {:ok, conversation} <- get_conversation(scope, conversation_id),
         {:ok, updated} <-
           conversation
           |> Conversation.handler_changeset(handler, DateTime.utc_now())
           |> Repo.update() do
      broadcast(conversation_id, {:handler_changed, handler})
      {:ok, updated}
    end
  end

  @doc "Hands off to a human, recording the idempotency key and topic in metadata."
  def hand_off(%Scope{} = scope, conversation_id, %{key: key} = info) do
    with {:ok, conversation} <- get_conversation(scope, conversation_id),
         {:ok, _} <-
           update_conversation(conversation, %{
             metadata:
               Map.merge(conversation.metadata || %{}, %{
                 "handoff_key" => key,
                 "handoff_topic" => info[:topic]
               })
           }) do
      set_handler(scope, conversation_id, :human)
    end
  end

  @doc "Returns a handed-off conversation to the bot."
  def return_to_bot(%Scope{} = scope, conversation_id),
    do: set_handler(scope, conversation_id, :bot)

  @doc """
  Records the flow position and the time of the latest user message. Both
  are read by `AgentsDemo.Turns` before every turn.
  """
  def touch_turn(%Scope{} = scope, conversation_id, attrs) do
    with {:ok, conversation} <- get_conversation(scope, conversation_id) do
      update_conversation(conversation, attrs)
    end
  end

  @doc """
  The PubSub topic a conversation's own events go out on — replies posted
  without an agent, handler changes. `Phoenix.PubSub.subscribe(AgentsDemo.PubSub, topic)`.
  """
  def topic(conversation_id), do: "conversation:#{conversation_id}"

  @doc """
  A reply the bot sends without a model: a deterministic flow step, a handoff
  notice. Persisted as a completed assistant message — the same shape the
  agent's replies have — delivered to the conversation's channel through
  `AgentsDemo.Channels.deliver/2`, and broadcast to the LiveView.

  `content` is the display-message content map: `%{"text" => …}` for text,
  or an `"interactive"`/`"image"` content (see
  `AgentsDemo.Conversations.DisplayMessage`). The content type is inferred.
  """
  def post_bot_reply(%Scope{} = scope, conversation_id, content) when is_map(content) do
    post_assistant(scope, conversation_id, content, %{"author" => "bot"})
  end

  @doc "A reply typed by a person who took the conversation over."
  def post_human_reply(%Scope{} = scope, conversation_id, text) when is_binary(text) do
    post_assistant(scope, conversation_id, %{"text" => text}, %{
      "author" => "human",
      "user_id" => scope.user.id
    })
  end

  @doc """
  Stores what a user sent, with where it came from. Never a delivery
  candidate: `Channels.deliver/2` only sends assistant messages, so nothing a
  phone sent is echoed back to it.
  """
  def append_user_message(%Scope{} = scope, conversation_id, text, origin) when is_binary(text) do
    append_display_message(scope, conversation_id, %{
      message_type: "user",
      content_type: "text",
      content: %{"text" => text},
      status: "completed",
      metadata: %{"origin" => to_string(origin)}
    })
  end

  defp post_assistant(scope, conversation_id, content, metadata) do
    attrs = %{
      message_type: "assistant",
      content_type: DisplayMessage.content_type_for(content),
      content: content,
      status: "completed",
      metadata: metadata
    }

    with {:ok, message} <- append_display_message(scope, conversation_id, attrs),
         {:ok, conversation} <- get_conversation(scope, conversation_id) do
      AgentsDemo.Channels.deliver(message, conversation)
      broadcast(conversation_id, {:display_message_saved, message})
      {:ok, message}
    end
  end

  defp broadcast(conversation_id, event) do
    Phoenix.PubSub.broadcast(AgentsDemo.PubSub, topic(conversation_id), {:conversation, event})
  end

  @doc """
  Gets a conversation by ID, scoped to the given context.

  Raises if the conversation doesn't exist or doesn't belong to the scope.
  """
  def get_conversation!(%Scope{} = scope, id) do
    Conversation
    |> scope_query(scope)
    |> Repo.get!(id)
  end

  @doc """
  Gets a conversation by ID, scoped to the given context.

  Returns `{:ok, conversation}` or `{:error, :not_found}`.
  """
  def get_conversation(%Scope{} = scope, id) do
    Conversation
    |> scope_query(scope)
    |> Repo.get(id)
    |> case do
      nil -> {:error, :not_found}
      conversation -> {:ok, conversation}
    end
  end

  @doc """
  Lists all conversations accessible within the given scope.

  ## Options

    * `:limit` - Maximum number of conversations to return (default: 50)
    * `:offset` - Number of conversations to skip (default: 0)
  """
  def list_conversations(%Scope{} = scope, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    offset = Keyword.get(opts, :offset, 0)

    Conversation
    |> scope_query(scope)
    |> order_by([c], desc: c.updated_at)
    |> limit(^limit)
    |> offset(^offset)
    |> Repo.all()
  end

  def update_conversation(%Conversation{} = conversation, attrs) do
    conversation
    |> Conversation.changeset(attrs)
    |> Repo.update()
  end

  def delete_conversation(%Conversation{} = conversation) do
    Repo.delete(conversation)
  end

  def delete_conversation(%Scope{} = scope, conversation_id) when is_binary(conversation_id) do
    conversation = get_conversation!(scope, conversation_id)
    Repo.delete(conversation)
  end

  #
  # Agent State Persistence
  #

  @doc """
  Saves (upsert) the serialized agent state for a conversation.

  Verifies the conversation belongs to `scope` before writing. Returns
  `{:error, :not_found}` if the conversation doesn't belong to the caller.
  """
  def save_agent_state(%Scope{} = scope, conversation_id, state) do
    with :ok <- authorize_conversation(scope, conversation_id) do
      attrs = %{
        conversation_id: conversation_id,
        state_data: state,
        version: state["version"] || 1
      }

      case get_agent_state(scope, conversation_id) do
        nil ->
          %AgentState{}
          |> AgentState.changeset(attrs)
          |> Repo.insert()

        existing ->
          existing
          |> AgentState.changeset(attrs)
          |> Repo.update()
      end
    end
  end

  @doc """
  Records whether the conversation's agent is currently in an interrupted
  state, by writing a boolean flag to `conversation.metadata["interrupted"]`.

  This is the load-path optimization for restored interrupts: rather than
  deserializing the full agent state on every conversation open just to find
  out whether there's a pending question, the load path reads this flag from
  the conversation row (which it loads anyway) and decides whether to
  auto-wake the agent.

  Called by `AgentsDemo.Agents.AgentPersistence.set_interrupted/3`, which sagents
  invokes only on actual transitions of the durable flag — once on enter
  (`true`) and once on leave (`false`). Steady-state turns issue no call,
  so this function is not on the hot path of normal completion.
  """
  def set_interrupt_status(%Scope{} = scope, conversation_id, interrupted?)
      when is_boolean(interrupted?) do
    with {:ok, conversation} <- get_conversation(scope, conversation_id) do
      new_metadata = Map.put(conversation.metadata || %{}, "interrupted", interrupted?)
      update_conversation(conversation, %{metadata: new_metadata})
    end
  end

  @doc """
  Returns `true` if the conversation's metadata indicates a pending
  interrupt. Cheap to read as it does not deserialize the agent state.

  Used on the load path (e.g. by your generated agent_live_helpers) to
  decide whether to auto-wake the agent when a host opens an idle
  conversation whose last persisted status was `:interrupted`.
  """
  def interrupted?(%Conversation{metadata: %{"interrupted" => true}}), do: true
  def interrupted?(_conversation), do: false

  @doc """
  Loads the serialized agent state for a conversation, filtered by scope.

  Returns `{:ok, state_data}` on success or `{:error, :not_found}` if no state
  exists or the conversation doesn't belong to the caller.
  """
  def load_agent_state(%Scope{} = scope, conversation_id) do
    case get_agent_state(scope, conversation_id) do
      nil -> {:error, :not_found}
      state -> {:ok, state.state_data}
    end
  end

  @doc """
  Loads just the TODOs from a saved agent state, filtered by scope.

  Useful for displaying TODOs in the UI when browsing historical conversations
  without starting the agent. Returns an empty list if no state exists, no todos
  are present, or the conversation doesn't belong to the caller.
  """
  def load_todos(%Scope{} = scope, conversation_id) do
    case load_agent_state(scope, conversation_id) do
      {:ok, %{"state" => %{"todos" => todos}}} when is_list(todos) ->
        case Todo.list_from_maps(todos) do
          {:ok, parsed} -> parsed
          {:error, _reason} -> []
        end

      {:ok, _other} ->
        []

      {:error, :not_found} ->
        []
    end
  end

  # Scoped agent-state lookup. Joins to Conversation so we inherit the same
  # tenant filter as `scope_query/2` applies to conversations.
  defp get_agent_state(%Scope{} = scope, conversation_id) do
    from(s in AgentState,
      join: c in Conversation,
      on: s.conversation_id == c.id,
      where: s.conversation_id == ^conversation_id
    )
    |> scope_conversation_query(scope)
    |> Repo.one()
  end

  #
  # Display Messages
  #

  @doc """
  Appends a display message to a conversation, filtered by scope.

  Verifies the conversation belongs to `scope` before inserting.
  """
  def append_display_message(%Scope{} = scope, conversation_id, attrs) do
    with :ok <- authorize_conversation(scope, conversation_id) do
      conversation_id
      |> DisplayMessage.create_changeset(attrs)
      |> Repo.insert()
    end
  end

  @doc """
  Loads display messages for a conversation, ordered chronologically.

  Verifies the conversation belongs to `scope` before querying.

  ## Options

    * `:limit` - Maximum number of messages to return (default: all)
    * `:offset` - Number of messages to skip (default: 0)
  """
  def load_display_messages(%Scope{} = scope, conversation_id, opts \\ []) do
    case authorize_conversation(scope, conversation_id) do
      :ok ->
        query =
          DisplayMessage
          |> where([m], m.conversation_id == ^conversation_id)
          |> order_by([m], asc: m.inserted_at, asc: m.sequence)

        query =
          case Keyword.get(opts, :limit) do
            nil -> query
            limit -> limit(query, ^limit)
          end

        query =
          case Keyword.get(opts, :offset) do
            nil -> query
            offset -> offset(query, ^offset)
          end

        Repo.all(query)

      {:error, :not_found} ->
        []
    end
  end

  #
  # Content Type Helper Functions
  # NOTE: All helper functions create content maps with STRING keys (not atoms)
  # because Ecto :map type (JSONB) stores keys as strings
  #

  @doc """
  Appends a text message to the conversation, filtered by scope.
  """
  def append_text_message(%Scope{} = scope, conversation_id, message_type, text) do
    append_display_message(scope, conversation_id, %{
      message_type: message_type,
      content_type: "text",
      content: %{"text" => text}
    })
  end

  #
  # Tool call lifecycle
  #

  @doc """
  Updates a pending tool call message to "executing" status, scoped.

  Joins to Conversation to enforce tenant isolation — wrong-scope callers
  receive `{:error, :not_found}`.
  """
  @spec mark_tool_executing(Scope.t(), String.t()) ::
          {:ok, DisplayMessage.t()} | {:error, :not_found | Ecto.Changeset.t()}
  def mark_tool_executing(%Scope{} = scope, call_id) do
    call_id
    |> tool_call_query()
    |> where([m], m.status == "pending")
    |> scope_conversation_query(scope)
    |> Repo.one()
    |> case do
      nil ->
        {:error, :not_found}

      message ->
        message
        |> DisplayMessage.changeset(%{"status" => "executing"})
        |> Repo.update()
    end
  end

  @doc """
  Updates a tool call message to "completed" status with result metadata, scoped.
  """
  @spec complete_tool_call(Scope.t(), String.t(), map()) ::
          {:ok, DisplayMessage.t()} | {:error, :not_found | Ecto.Changeset.t()}
  def complete_tool_call(%Scope{} = scope, call_id, result_metadata \\ %{}) do
    call_id
    |> tool_call_query()
    |> where([m], m.status in ["pending", "executing", "interrupted"])
    |> scope_conversation_query(scope)
    |> Repo.one()
    |> case do
      nil ->
        {:error, :not_found}

      message ->
        updated_metadata = Map.merge(message.metadata, result_metadata)

        message
        |> DisplayMessage.changeset(%{
          "status" => "completed",
          "metadata" => updated_metadata
        })
        |> Repo.update()
    end
  end

  @doc """
  Updates a tool call message to "failed" status with error information, scoped.
  """
  @spec fail_tool_call(Scope.t(), String.t(), map()) ::
          {:ok, DisplayMessage.t()} | {:error, :not_found | Ecto.Changeset.t()}
  def fail_tool_call(%Scope{} = scope, call_id, error_info \\ %{}) do
    call_id
    |> tool_call_query()
    |> where([m], m.status in ["pending", "executing", "interrupted"])
    |> scope_conversation_query(scope)
    |> Repo.one()
    |> case do
      nil ->
        {:error, :not_found}

      message ->
        updated_metadata = Map.merge(message.metadata, error_info)

        message
        |> DisplayMessage.changeset(%{
          "status" => "failed",
          "metadata" => updated_metadata
        })
        |> Repo.update()
    end
  end

  @doc """
  Updates a tool call message to "interrupted" status, scoped.
  """
  @spec interrupt_tool_call(Scope.t(), String.t(), map()) ::
          {:ok, DisplayMessage.t()} | {:error, :not_found | Ecto.Changeset.t()}
  def interrupt_tool_call(%Scope{} = scope, call_id, interrupt_info \\ %{}) do
    call_id
    |> tool_call_query()
    |> where([m], m.status in ["pending", "executing"])
    |> scope_conversation_query(scope)
    |> Repo.one()
    |> case do
      nil ->
        {:error, :not_found}

      message ->
        updated_metadata = Map.merge(message.metadata, interrupt_info)

        message
        |> DisplayMessage.changeset(%{
          "status" => "interrupted",
          "metadata" => updated_metadata
        })
        |> Repo.update()
    end
  end

  @doc """
  Updates a tool call message to "cancelled" status, scoped.
  """
  @spec cancel_tool_call(Scope.t(), String.t()) ::
          {:ok, DisplayMessage.t()} | {:error, :not_found | Ecto.Changeset.t()}
  def cancel_tool_call(%Scope{} = scope, call_id) do
    call_id
    |> tool_call_query()
    |> where([m], m.status in ["pending", "executing", "interrupted"])
    |> scope_conversation_query(scope)
    |> Repo.one()
    |> case do
      nil ->
        {:error, :not_found}

      message ->
        message
        |> DisplayMessage.changeset(%{"status" => "cancelled"})
        |> Repo.update()
    end
  end

  @doc """
  Records an HITL decision (approved/rejected) on a tool call display message, scoped.

  Adds `"hitl_decision"` to the tool call's metadata so the UI can display a
  discreet indicator of what the user decided. The metadata persists through
  subsequent status transitions since those operations merge metadata. Also stamps
  the matching tool_result message when one exists.
  """
  @spec record_hitl_decision(Scope.t(), String.t(), String.t()) ::
          {:ok, DisplayMessage.t()} | {:error, :not_found | Ecto.Changeset.t()}
  def record_hitl_decision(%Scope{} = scope, call_id, decision)
      when decision in ["approved", "rejected"] do
    result =
      call_id
      |> tool_call_query()
      |> scope_conversation_query(scope)
      |> Repo.one()
      |> case do
        nil ->
          {:error, :not_found}

        message ->
          updated_metadata = Map.put(message.metadata, "hitl_decision", decision)

          message
          |> DisplayMessage.changeset(%{"metadata" => updated_metadata})
          |> Repo.update()
      end

    call_id
    |> tool_result_query()
    |> scope_conversation_query(scope)
    |> Repo.one()
    |> case do
      nil ->
        :ok

      tr_msg ->
        updated_content = Map.put(tr_msg.content, "hitl_decision", decision)

        tr_msg
        |> DisplayMessage.changeset(%{"content" => updated_content})
        |> Repo.update()
    end

    result
  end

  @doc """
  Resolves an interrupted tool result display message after a sub-agent resumes, scoped.
  """
  @spec resolve_interrupted_tool_result(Scope.t(), String.t(), String.t()) ::
          {:ok, DisplayMessage.t()} | {:error, :not_found | Ecto.Changeset.t()}
  def resolve_interrupted_tool_result(%Scope{} = scope, tool_call_id, result_content) do
    tool_call_id
    |> tool_result_query()
    |> where([m], fragment("(?->>'is_interrupt')::boolean = true", m.content))
    |> scope_conversation_query(scope)
    |> Repo.one()
    |> case do
      nil ->
        {:error, :not_found}

      message ->
        updated_content =
          message.content
          |> Map.put("is_interrupt", false)
          |> Map.put("content", result_content)

        message
        |> DisplayMessage.changeset(%{"content" => updated_content})
        |> Repo.update()
    end
  end

  @doc """
  Searches message content across all types, within the scope's conversations.
  """
  def search_messages(%Scope{} = scope, search_term) do
    owner_id = get_owner_id(scope)

    from(m in DisplayMessage,
      join: c in Conversation,
      on: m.conversation_id == c.id,
      where: c.user_id == ^owner_id,
      where: fragment("?::text ILIKE ?", m.content, ^"%#{search_term}%")
    )
    |> Repo.all()
  end

  #
  # Private Helpers
  #

  # Scope the primary Conversation table.
  #
  # CUSTOMIZE based on YOUR scope struct fields:
  #
  # Single-user scope:
  #   defp scope_query(query, %Scope{user_id: user_id}) do
  #     from q in query, where: q.user_id == ^user_id
  #   end
  #
  # Multi-tenant (organization):
  #   defp scope_query(query, %Scope{organization_id: org_id}) do
  #     from q in query, where: q.organization_id == ^org_id
  #   end
  defp scope_query(query, %Scope{} = scope) do
    owner_id = get_owner_id(scope)
    from q in query, where: q.user_id == ^owner_id
  end

  # Scope a query that has already joined to Conversation. Applies the tenant
  # filter to the joined `c` binding instead of the primary binding.
  defp scope_conversation_query(query, %Scope{} = scope) do
    owner_id = get_owner_id(scope)
    from [_m, c] in query, where: c.user_id == ^owner_id
  end

  # Base query for tool_call display messages by call_id. Callers refine with
  # their own status predicate (or none) and pipe through scope_conversation_query/2
  # to enforce tenant isolation.
  defp tool_call_query(call_id) do
    from m in DisplayMessage,
      join: c in Conversation,
      on: m.conversation_id == c.id,
      where: m.tool_call_id == ^call_id,
      where: m.content_type == "tool_call"
  end

  # Base query for tool_result display messages by tool_call_id. Callers refine
  # with additional predicates (e.g. is_interrupt) and pipe through
  # scope_conversation_query/2 to enforce tenant isolation.
  defp tool_result_query(tool_call_id) do
    from m in DisplayMessage,
      join: c in Conversation,
      on: m.conversation_id == c.id,
      where: m.tool_call_id == ^tool_call_id,
      where: m.content_type == "tool_result"
  end

  # Authorization check: does this conversation belong to the given scope?
  # Emits `SELECT 1 ... LIMIT 1` instead of hydrating the row, since the
  # caller only needs a yes/no answer before proceeding with a write.
  defp authorize_conversation(%Scope{} = scope, conversation_id) do
    Conversation
    |> scope_query(scope)
    |> where([c], c.id == ^conversation_id)
    |> Repo.exists?()
    |> case do
      true -> :ok
      false -> {:error, :not_found}
    end
  end

  # Extracts the owner ID from the scope struct.
  #
  # This default assumes your Scope has a `user` field containing
  # a struct with an `id` field. Customize if your Scope has a different structure.
  defp get_owner_id(%Scope{user: user}), do: user.id
end
