defmodule AgentsDemo.Agents.FactoryTest do
  use AgentsDemo.DataCase

  import AgentsDemo.AccountsFixtures
  import AgentsDemo.BotsFixtures
  import AgentsDemo.ConversationsFixtures

  alias AgentsDemo.Agents.Factory
  alias AgentsDemo.Agents.FactoryRouter

  setup do
    previous = System.get_env("ANTHROPIC_API_KEY")
    System.put_env("ANTHROPIC_API_KEY", "sk-ant-test-key")

    on_exit(fn ->
      if previous,
        do: System.put_env("ANTHROPIC_API_KEY", previous),
        else: System.delete_env("ANTHROPIC_API_KEY")
    end)

    %{scope: user_scope_fixture()}
  end

  test "builds the agent from the compiled version", %{scope: scope} do
    bot =
      published_bot_fixture(scope,
        version:
          valid_version_attrs(%{
            "behavior" => %{"instructions" => "Only answer about billing."},
            "model" => %{"name" => "claude-test-1"},
            "safety" => %{"interrupt_on" => ["delete_file"]},
            "limits" => %{"max_runs" => 4, "tool_timeout_ms" => 7_000},
            "skills" => [
              %{"skill_id" => "memory_files", "skill_version" => "1.0.0", "position" => 0},
              %{"skill_id" => "todo", "skill_version" => "1.0.0", "position" => 1}
            ]
          })
      )

    conversation = conversation_fixture(%{scope: scope, bot_id: bot.id})

    {:ok, Factory, config} =
      FactoryRouter.resolve(scope, conversation.id, timezone: "Asia/Jerusalem")

    assert {:ok, %Sagents.Agent{} = agent, []} = Factory.create_agent("agent-test", config)
    assert agent.base_system_prompt == "Only answer about billing."
    assert agent.model.model == "claude-test-1"
    assert agent.max_runs == 4
    assert agent.async_tool_timeout == 7_000
    # Middleware contributes the file tools; no capability is selected.
    tool_names = Enum.map(agent.tools, & &1.name)
    assert "list_files" in tool_names
    refute "echo" in tool_names

    modules = middleware_modules(agent)
    assert Sagents.Middleware.FileSystem in modules
    assert Sagents.Middleware.TodoList in modules
    refute AgentsDemo.Middleware.WebToolMiddleware in modules
    assert List.last(modules) == Sagents.Middleware.HumanInTheLoop
    assert Sagents.Middleware.Haltable in modules
  end

  test "the default bot reproduces the platform assistant", %{scope: scope} do
    conversation = conversation_fixture(%{scope: scope})
    {:ok, Factory, config} = FactoryRouter.resolve(scope, conversation.id, [])
    {:ok, agent, []} = Factory.create_agent("agent-default", config)

    assert agent.base_system_prompt =~ "/Memories"
    modules = middleware_modules(agent)
    assert AgentsDemo.Middleware.WebToolMiddleware in modules
    assert Sagents.Middleware.FileSystem in modules
    assert agent.max_runs == 50
    refute Sagents.Middleware.HumanInTheLoop in modules
  end

  defp middleware_modules(agent) do
    Enum.map(agent.middleware, fn
      {mod, _opts} -> mod
      %{module: mod} -> mod
      mod when is_atom(mod) -> mod
    end)
  end
end
