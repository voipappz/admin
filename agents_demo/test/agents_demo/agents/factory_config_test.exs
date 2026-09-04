defmodule Connectix.Agents.FactoryConfigTest do
  use ExUnit.Case, async: true

  alias Connectix.Agents.FactoryConfig
  alias Connectix.Bots.CompiledSpec

  @scope %Connectix.Accounts.Scope{user: %Connectix.Accounts.User{id: 1}}
  @compiled %CompiledSpec{
    bot_version_id: "v1",
    prompt: "Hello",
    capabilities: [],
    interrupt_on: %{"x" => true}
  }

  defp build(inputs) do
    inputs
    |> Map.merge(%{scope: @scope, conversation_id: "c1"})
    |> FactoryConfig.from_inputs()
    |> FactoryConfig.with_spec(@compiled)
    |> FactoryConfig.build()
  end

  test "requires a compiled spec" do
    assert {:error, changeset} =
             %{scope: @scope, conversation_id: "c1"}
             |> FactoryConfig.from_inputs()
             |> FactoryConfig.build()

    assert changeset.spec
  end

  test "request options narrow presentation only; the spec is untouched" do
    hostile = %{
      timezone: "Asia/Jerusalem",
      tool_context: %{"hint" => "x"},
      tools: [:anything],
      interrupt_on: %{},
      spec: %{@compiled | prompt: "pwned"},
      max_runs: 999
    }

    assert {:ok, config} = build(hostile)
    assert config.timezone == "Asia/Jerusalem"
    assert config.tool_context == %{"hint" => "x"}
    assert config.spec == @compiled
    refute Map.has_key?(config, :max_runs)
  end

  test "tool_context must be a map" do
    assert {:error, changeset} = build(%{tool_context: "nope"})
    assert changeset.tool_context
  end
end
