defmodule Connectix.Bots.CompilerTest do
  use Connectix.DataCase, async: false

  import Connectix.AccountsFixtures
  import Connectix.BotsFixtures

  alias Connectix.Bots
  alias Connectix.Bots.BotVersion
  alias Connectix.Bots.CompiledSpec
  alias Connectix.Bots.Compiler
  alias Connectix.Bots.Validator.Report

  setup do
    %{scope: user_scope_fixture()}
  end

  defp version(scope, attrs) do
    bot = bot_fixture(scope, version: valid_version_attrs(attrs))
    bot.draft_version
  end

  test "resolves skills, assembles the prompt, and is deterministic", %{scope: scope} do
    v =
      version(scope, %{
        "behavior" => %{"instructions" => "  Be brief.  "},
        "skills" => [
          %{"skill_id" => "todo", "skill_version" => "1.0.0", "position" => 1},
          %{"skill_id" => "web_lookup", "skill_version" => "1.0.0", "position" => 0}
        ]
      })

    assert {:ok, %CompiledSpec{} = spec} = Compiler.compile(v)
    assert spec.prompt == "Be brief."
    assert Enum.map(spec.skills, & &1.id) == ["web_lookup", "todo"]
    assert %Connectix.Skills.WebLookup.Settings{timeout_ms: 120_000} = hd(spec.skills).settings
    assert spec.capabilities == []
    assert spec.interrupt_on == %{}
    assert spec.limits.max_runs == 10

    assert {:ok, ^spec} = Compiler.compile(v)
  end

  test "model settings and safety policy flow through", %{scope: scope} do
    v =
      version(scope, %{
        "model" => %{"name" => "claude-x", "temperature" => 0.2},
        "safety" => %{"interrupt_on" => ["delete_file"], "forbidden_tools" => ["echo"]},
        "limits" => %{"max_runs" => 3, "tool_timeout_ms" => 5_000}
      })

    assert {:ok, spec} = Compiler.compile(v)
    assert spec.model.name == "claude-x"
    assert spec.model.temperature == 0.2
    assert spec.interrupt_on == %{"delete_file" => true}
    assert spec.forbidden_tools == ["echo"]
    assert spec.limits.max_runs == 3
  end

  test "an unknown skill or bad settings is a report with a path", %{scope: scope} do
    v = version(scope, %{})

    broken = %{
      v
      | skills: [
          %Connectix.Bots.BotVersionSkill{
            skill_id: "web_lookup",
            skill_version: "1.0.0",
            settings: %{"timeout_ms" => 1},
            position: 0
          },
          %Connectix.Bots.BotVersionSkill{
            skill_id: "ghost",
            skill_version: "1.0.0",
            settings: %{},
            position: 1
          }
        ]
    }

    assert {:error, %Report{valid?: false, errors: errors}} = Compiler.compile(broken)

    assert %{code: :invalid_skill_settings, path: "skills[0].settings"} =
             Enum.find(errors, &(&1.code == :invalid_skill_settings))

    assert %{code: :unknown_skill, path: "skills[1].skill_id"} =
             Enum.find(errors, &(&1.code == :unknown_skill))
  end

  test "publishing runs the compiler", %{scope: scope} do
    bot = bot_fixture(scope)

    {:ok, draft} =
      Bots.update_draft(scope, bot.id, %{
        "skills" => [%{"skill_id" => "todo", "skill_version" => "1.0.0"}]
      })

    assert %BotVersion{} = draft
    assert {:ok, %{current_version: %{status: :published}}} = Bots.publish_draft(scope, bot.id)
  end

  test "Runtime caches published specs by fingerprint", %{scope: scope} do
    bot = published_bot_fixture(scope)
    version = bot.current_version

    assert {:ok, spec} = Connectix.Bots.Runtime.spec_for(version)
    assert spec.fingerprint == version.fingerprint
    assert {:ok, ^spec} = Connectix.Bots.Runtime.spec_for(version)
    Connectix.Bots.Runtime.forget(version)
  end

  test "redacted/1 has no modules, only ids and plain data", %{scope: scope} do
    {:ok, spec} = scope |> version(%{}) |> Compiler.compile()
    redacted = CompiledSpec.redacted(spec)

    assert [%{id: "web_lookup", version: "1.0.0", settings: %{timeout_ms: 120_000}}] =
             redacted.skills

    assert {:ok, _json} = Jason.encode(redacted)
  end
end
