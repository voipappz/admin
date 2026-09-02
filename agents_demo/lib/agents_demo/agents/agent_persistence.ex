defmodule AgentsDemo.Agents.AgentPersistence do
  @moduledoc """
  Implements `Sagents.AgentPersistence` for state snapshots.

  Persists full agent state (messages, todos, metadata) to Mnesia
  via `AgentsDemo.Conversations.save_agent_state/3`, and mirrors the
  durable interrupt flag onto `conversation.metadata["interrupted"]` via
  `set_interrupted/3` (called by sagents only on actual transitions).
  """

  @behaviour Sagents.AgentPersistence

  require Logger

  @impl true
  def persist_state(scope, state_data, context) do
    conversation_id = extract_conversation_id(context.agent_id)

    case AgentsDemo.Conversations.save_agent_state(scope, conversation_id, state_data) do
      {:ok, _agent_state} ->
        Logger.debug("Persisted agent state for #{context.agent_id} (#{context.lifecycle})")
        :ok

      # The conversation is gone or belongs to someone else: nothing to
      # persist against, and not a reason to crash the agent.
      {:error, :not_found} ->
        Logger.warning(
          "Skipping agent state persistence for #{context.agent_id} (#{context.lifecycle}): conversation not accessible in scope"
        )

        :ok

      {:error, _reason} = error ->
        error
    end
  end

  @impl true
  def load_state(scope, context) do
    conversation_id = extract_conversation_id(context.agent_id)
    AgentsDemo.Conversations.load_agent_state(scope, conversation_id)
  end

  @impl true
  def set_interrupted(scope, context, interrupted?) do
    conversation_id = extract_conversation_id(context.agent_id)

    case AgentsDemo.Conversations.set_interrupt_status(scope, conversation_id, interrupted?) do
      {:ok, _conversation} ->
        :ok

      {:error, :not_found} ->
        Logger.warning(
          "Skipping interrupt flag update for #{context.agent_id}: conversation not accessible in scope"
        )

        :ok

      other ->
        Logger.warning(
          "Failed to update interrupt flag for #{context.agent_id}: #{inspect(other)}"
        )

        :ok
    end
  end

  defp extract_conversation_id(agent_id) do
    String.replace_prefix(agent_id, "conversation-", "")
  end
end
