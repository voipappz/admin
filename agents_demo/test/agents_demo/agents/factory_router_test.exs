defmodule AgentsDemo.Agents.FactoryRouterTest do
  use AgentsDemo.DataCase

  import AgentsDemo.AccountsFixtures
  import AgentsDemo.BotsFixtures
  import AgentsDemo.ConversationsFixtures

  alias AgentsDemo.Agents.Factory
  alias AgentsDemo.Agents.FactoryConfig
  alias AgentsDemo.Agents.FactoryRouter
  alias AgentsDemo.Bots

  test "resolves the pinned version through the caller's scope" do
    scope = user_scope_fixture()

    bot =
      published_bot_fixture(scope,
        version: valid_version_attrs(%{"behavior" => %{"instructions" => "v1 prompt"}})
      )

    conversation = conversation_fixture(%{scope: scope, bot_id: bot.id})

    assert {:ok, Factory, %FactoryConfig{} = config} =
             FactoryRouter.resolve(scope, conversation.id, timezone: "UTC")

    assert config.spec.prompt == "v1 prompt"
    assert config.conversation.id == conversation.id

    {:ok, _draft} =
      Bots.update_draft(scope, bot.id, %{"behavior" => %{"instructions" => "v2 prompt"}})

    {:ok, _bot} = Bots.publish_draft(scope, bot.id)

    assert {:ok, Factory, config} = FactoryRouter.resolve(scope, conversation.id, [])
    assert config.spec.prompt == "v1 prompt"
  end

  test "another owner's conversation is not found" do
    scope = user_scope_fixture()
    conversation = conversation_fixture(%{scope: scope})
    assert {:error, :not_found} = FactoryRouter.resolve(user_scope_fixture(), conversation.id, [])
  end
end
