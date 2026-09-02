defmodule AgentsDemo.SkillsTest do
  use ExUnit.Case, async: true

  alias AgentsDemo.Skills

  test "the catalog is a fixed set of ids" do
    assert Enum.sort(Skills.ids()) == [
             "customer_lookup",
             "human_handoff",
             "memory_files",
             "todo",
             "web_lookup"
           ]
  end

  test "fetch/2 resolves a compatible version and refuses the rest" do
    assert {:ok, AgentsDemo.Skills.WebLookup} = Skills.fetch("web_lookup", "1.0.0")
    assert {:ok, AgentsDemo.Skills.WebLookup} = Skills.fetch("web_lookup", "1.4.2")

    assert {:error, {:incompatible_skill_version, "web_lookup", "1.0.0"}} =
             Skills.fetch("web_lookup", "2.0.0")

    assert {:error, {:unknown_skill, "Elixir.System"}} = Skills.fetch("Elixir.System", "1.0.0")
  end

  test "validate_settings/3 types settings through the skill's schema" do
    assert {:ok, %AgentsDemo.Skills.MemoryFiles.Settings{enabled_tools: ["read_file"]}} =
             Skills.validate_settings("memory_files", "1.0.0", %{"enabled_tools" => ["read_file"]})

    assert {:error, %{enabled_tools: [_message]}} =
             Skills.validate_settings("memory_files", "1.0.0", %{"enabled_tools" => ["rm_rf"]})

    assert {:ok, %AgentsDemo.Skills.Todo.Settings{inline: true}} =
             Skills.validate_settings("todo", "1.0.0", %{})
  end

  test "catalog/0 is plain data with defaults and badges" do
    entry = Enum.find(Skills.catalog(), &(&1.id == "memory_files"))
    assert entry.version == "1.0.0"
    assert is_list(entry.default_settings.enabled_tools)
    assert entry.capabilities == []
  end
end
