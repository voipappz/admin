defmodule AgentsDemo.Conversations.Store do
  @moduledoc """
  Conversations, their display messages, and their agent state — in Mnesia.

  Three `disc_copies` tables replicated across the cluster. `conversations` is
  indexed by `user_id` and `bot_id`; `display_messages` by `conversation_id` and
  `tool_call_id` (the tool-call lifecycle looks messages up by call id);
  `agent_states` by `conversation_id`. Loaded associations (bot, version,
  messages, state) are attached by the context, never stored on the row.
  """

  use GenServer

  alias AgentsDemo.Conversations.{Conversation, DisplayMessage, AgentState}
  alias AgentsDemo.Mnesia

  @conversations :sagents_conversations
  @conv_fields [:id, :user_id, :bot_id, :bot_version_id, :title, :version, :metadata,
                :source, :handler, :handed_off_at, :last_user_message_at, :flow_state,
                :inserted_at, :updated_at]

  @messages :sagents_display_messages
  @msg_fields [:id, :conversation_id, :message_type, :content, :tool_call_id,
               :content_type, :sequence, :status, :metadata, :inserted_at]

  @states :sagents_agent_states
  @state_fields [:id, :conversation_id, :state_data, :version, :inserted_at, :updated_at]

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(_opts) do
    Mnesia.ensure_table(@conversations, attributes: @conv_fields, type: :set, index: [:user_id, :bot_id])
    Mnesia.ensure_table(@messages, attributes: @msg_fields, type: :set, index: [:conversation_id, :tool_call_id])
    Mnesia.ensure_table(@states, attributes: @state_fields, type: :set, index: [:conversation_id])
    {:ok, %{}}
  end

  # ── Conversations ──────────────────────────────────────────────────────────
  def get(id), do: Mnesia.get(@conversations, @conv_fields, id) |> to_conv()

  def list_for_user(user_id) do
    Mnesia.transaction!(fn -> Mnesia.index_read(@conversations, @conv_fields, user_id, :user_id) end)
    |> Enum.map(&to_conv/1)
  end

  def index_by_bot(bot_id) do
    Mnesia.transaction!(fn -> Mnesia.index_read(@conversations, @conv_fields, bot_id, :bot_id) end)
    |> Enum.map(&to_conv/1)
  end

  def put(%Conversation{} = conv) do
    now = DateTime.utc_now()
    conv = %{conv | id: conv.id || Mnesia.uuid(), inserted_at: conv.inserted_at || now, updated_at: now}
    row = conv |> Map.from_struct() |> Map.take(@conv_fields)
    Mnesia.transaction!(fn -> Mnesia.write(@conversations, @conv_fields, row) end)
    conv
  end

  def delete(id) do
    Mnesia.transaction!(fn ->
      @messages |> Mnesia.index_read(@msg_fields, id, :conversation_id) |> Enum.each(&Mnesia.delete(@messages, &1.id))
      @states |> Mnesia.index_read(@state_fields, id, :conversation_id) |> Enum.each(&Mnesia.delete(@states, &1.id))
      Mnesia.delete(@conversations, id)
    end)
  end

  # ── Messages ───────────────────────────────────────────────────────────────
  def insert_message(%DisplayMessage{} = msg) do
    msg = %{msg | id: msg.id || Mnesia.uuid(), inserted_at: msg.inserted_at || DateTime.utc_now()}
    Mnesia.transaction!(fn -> Mnesia.write(@messages, @msg_fields, Map.from_struct(msg)) end)
    msg
  end

  def update_message(%DisplayMessage{id: id} = msg) when is_binary(id) do
    Mnesia.transaction!(fn -> Mnesia.write(@messages, @msg_fields, Map.from_struct(msg)) end)
    msg
  end

  def list_messages(conversation_id) do
    Mnesia.transaction!(fn -> Mnesia.index_read(@messages, @msg_fields, conversation_id, :conversation_id) end)
    |> Enum.map(&to_msg/1)
    |> Enum.sort_by(&{&1.inserted_at, &1.sequence})
  end

  def message_by_tool_call(tool_call_id) do
    Mnesia.transaction!(fn ->
      case Mnesia.index_read(@messages, @msg_fields, tool_call_id, :tool_call_id) do
        [row | _] -> row
        [] -> nil
      end
    end)
    |> to_msg()
  end

  def messages_by_tool_call(tool_call_id) do
    Mnesia.transaction!(fn -> Mnesia.index_read(@messages, @msg_fields, tool_call_id, :tool_call_id) end)
    |> Enum.map(&to_msg/1)
  end

  # ── Agent state ────────────────────────────────────────────────────────────
  def get_agent_state(conversation_id) do
    Mnesia.transaction!(fn ->
      case Mnesia.index_read(@states, @state_fields, conversation_id, :conversation_id) do
        [row | _] -> row
        [] -> nil
      end
    end)
    |> to_state()
  end

  def put_agent_state(%AgentState{} = state) do
    now = DateTime.utc_now()
    state = %{state | id: state.id || Mnesia.uuid(), inserted_at: state.inserted_at || now, updated_at: now}
    Mnesia.transaction!(fn -> Mnesia.write(@states, @state_fields, Map.from_struct(state)) end)
    state
  end

  # ── shaping ────────────────────────────────────────────────────────────────
  defp to_conv(nil), do: nil
  defp to_conv(%{} = row), do: struct(Conversation, row)
  defp to_msg(nil), do: nil
  defp to_msg(%{} = row), do: struct(DisplayMessage, row)
  defp to_state(nil), do: nil
  defp to_state(%{} = row), do: struct(AgentState, row)
end
