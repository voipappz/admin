defmodule Connectix.Skills.CapabilityTest do
  use ExUnit.Case, async: true

  alias Connectix.Fakes.EchoCapability
  alias Connectix.Skills.Capability

  @scope %Connectix.Accounts.Scope{user: %Connectix.Accounts.User{id: 7}}

  defp function(overrides \\ %{}),
    do: overrides |> EchoCapability.capability() |> Capability.to_function()

  defp run(function, args, context) do
    case function.parse_args.(args) do
      {:ok, typed} -> function.function.(typed, context)
      {:error, _message} = error -> error
    end
  end

  test "the function carries the schema the model sees" do
    function = function()
    assert function.name == "echo"
    assert function.parameters_schema["required"] == ["text"]
    assert function.parameters_schema["properties"]["text"]["description"] == "What to echo back"
  end

  test "arguments are validated before the capability runs" do
    assert {:error, "invalid arguments: " <> _detail} =
             run(function(), %{"mode" => "echo"}, %{scope: @scope})

    assert {:error, "invalid arguments: " <> _detail} =
             run(function(), %{"text" => "x", "mode" => "nope"}, %{scope: @scope})
  end

  test "the call runs with the scope and conversation from the agent, never the model" do
    context = %{scope: @scope, conversation_id: "conv-1", agent_id: "agent-1"}

    assert {:ok, %{echo: "hi", user_id: 7, conversation_id: "conv-1"}} =
             run(function(), %{"text" => "hi"}, context)
  end

  test "no scope means no call" do
    assert {:error, "echo: no scope; refusing to run"} = run(function(), %{"text" => "hi"}, %{})
  end

  test "a raise becomes a redacted tool error" do
    assert {:error, message} =
             run(function(), %{"text" => "x", "mode" => "raise"}, %{scope: @scope})

    assert message =~ "echo: failed"
    refute message =~ "abc123"
  end

  test "a slow call is cut at the capability's timeout" do
    assert {:error, "echo: timed out after 100ms"} =
             run(function(), %{"text" => "x", "mode" => "sleep"}, %{scope: @scope})
  end
end
