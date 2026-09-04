defmodule Connectix.Agents.FactoryRouter do
  @moduledoc """
  Resolves a conversation to the factory and config that build its agent.

  `Sagents.Session` consults this on every session start, including resume,
  so a restored conversation is always rebuilt from the version it pinned —
  never from whatever is current now.

  The load is scoped: the conversation is fetched through the caller's
  `current_scope`, and only then is its pinned version compiled
  (`Connectix.Bots.Runtime`). The Factory receives the compiled spec and
  makes no queries of its own. One factory serves every bot; a second one
  would only be warranted by a genuinely different execution architecture.
  """

  @behaviour Sagents.FactoryRouter

  alias Connectix.Agents.Factory
  alias Connectix.Agents.FactoryConfig
  alias Connectix.Bots.Runtime
  alias Connectix.Conversations

  @impl true
  def resolve(scope, conversation_id, request_opts) do
    with {:ok, conversation} <-
           Conversations.get_conversation_with_version(scope, conversation_id),
         {:ok, spec} <- Runtime.spec_for(conversation.bot_version) do
      request_opts
      |> Map.new()
      |> Map.put(:scope, scope)
      |> Map.put(:conversation_id, conversation_id)
      |> FactoryConfig.from_inputs()
      |> FactoryConfig.with_conversation(conversation)
      |> FactoryConfig.with_spec(spec)
      |> FactoryConfig.build()
      |> case do
        {:ok, config} -> {:ok, Factory, config}
        {:error, %{}} = error -> error
      end
    end
  end
end
