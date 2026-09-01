defmodule AgentsDemo.ConfigTest do
  @moduledoc """
  The rules every accessor inherits, tested once on the primitives, plus the
  handful of accessors whose behaviour is more than "read this variable".
  """

  use ExUnit.Case, async: false

  alias AgentsDemo.Config

  # Resolution happens at call time, so a test can set a variable and read it
  # back without reloading config — which is the property these tests rely on.
  defp with_env(pairs, fun) do
    previous = Map.new(pairs, fn {key, _new_value} -> {key, System.get_env(key)} end)

    Enum.each(pairs, fn
      {key, nil} -> System.delete_env(key)
      {key, value} -> System.put_env(key, value)
    end)

    try do
      fun.()
    after
      Enum.each(previous, fn
        {key, nil} -> System.delete_env(key)
        {key, value} -> System.put_env(key, value)
      end)
    end
  end

  describe "env/1" do
    test "an unset variable and one set to \"\" are both absent" do
      with_env([{"AGENTS_DEMO_TEST_VAR", nil}], fn ->
        assert Config.env("AGENTS_DEMO_TEST_VAR") == nil
      end)

      with_env([{"AGENTS_DEMO_TEST_VAR", ""}], fn ->
        assert Config.env("AGENTS_DEMO_TEST_VAR") == nil
      end)
    end

    test "a value is returned verbatim" do
      with_env([{"AGENTS_DEMO_TEST_VAR", " padded "}], fn ->
        assert Config.env("AGENTS_DEMO_TEST_VAR") == " padded "
      end)
    end
  end

  describe "int_env/3" do
    test "parses an integer inside the range" do
      with_env([{"AGENTS_DEMO_TEST_INT", "42"}], fn ->
        assert Config.int_env("AGENTS_DEMO_TEST_INT", 7, 1..100) == 42
      end)
    end

    test "falls back rather than raising on garbage, partial numbers, and out of range" do
      for value <- ["not a number", "42abc", "", "1000"] do
        with_env([{"AGENTS_DEMO_TEST_INT", value}], fn ->
          assert Config.int_env("AGENTS_DEMO_TEST_INT", 7, 1..100) == 7
        end)
      end
    end

    test "falls back when unset" do
      with_env([{"AGENTS_DEMO_TEST_INT", nil}], fn ->
        assert Config.int_env("AGENTS_DEMO_TEST_INT", 7, 1..100) == 7
      end)
    end
  end

  describe "api_key/0" do
    test "a key shorter than 16 bytes is treated as absent" do
      with_env([{"AGENTS_DEMO_API_KEY", "tooshort"}], fn ->
        assert Config.api_key() == nil
      end)
    end

    test "a long enough key is returned" do
      key = String.duplicate("k", 24)

      with_env([{"AGENTS_DEMO_API_KEY", key}], fn ->
        assert Config.api_key() == key
      end)
    end
  end

  describe "anthropic_api_key!/0" do
    test "raises with the variable's name when unset" do
      with_env([{"ANTHROPIC_API_KEY", nil}], fn ->
        assert_raise RuntimeError, ~r/ANTHROPIC_API_KEY/, fn ->
          Config.anthropic_api_key!()
        end
      end)
    end
  end

  describe "data_dir/0" do
    test "AGENTS_DEMO_DATA_DIR wins when set" do
      with_env([{"AGENTS_DEMO_DATA_DIR", "/srv/agents"}], fn ->
        assert Config.data_dir() == "/srv/agents"
      end)
    end

    test "defaults under the system temp dir in test, so parallel runs cannot collide" do
      with_env([{"AGENTS_DEMO_DATA_DIR", nil}], fn ->
        assert Config.data_dir() =~ System.tmp_dir!()
        assert Config.data_dir() =~ "user_files"
      end)
    end

    test "the default is partitioned by MIX_TEST_PARTITION" do
      with_env([{"AGENTS_DEMO_DATA_DIR", nil}, {"MIX_TEST_PARTITION", "3"}], fn ->
        assert Config.data_dir() =~ "agents_demo_test3"
      end)
    end
  end

  describe "models" do
    test "fall back to documented defaults" do
      with_env([{"AGENTS_DEMO_MODEL", nil}, {"AGENTS_DEMO_TITLE_MODEL", nil}], fn ->
        assert Config.main_model() == "claude-sonnet-4-6"
        assert Config.title_model() == "claude-haiku-4-5"
      end)
    end

    test "are overridable" do
      with_env([{"AGENTS_DEMO_MODEL", "claude-opus-5"}], fn ->
        assert Config.main_model() == "claude-opus-5"
      end)
    end
  end

  describe "summary/0" do
    test "reports secrets by presence and never by value" do
      key = String.duplicate("s", 32)

      with_env([{"ANTHROPIC_API_KEY", key}, {"AGENTS_DEMO_API_KEY", nil}], fn ->
        summary = Config.summary()

        assert {"ANTHROPIC_API_KEY", "set"} in summary
        assert {"AGENTS_DEMO_API_KEY", "not set"} in summary

        refute Enum.any?(summary, fn {_label, value} -> value =~ key end)
      end)
    end

    test "reports non-secret settings by value" do
      with_env([{"AGENTS_DEMO_MODEL", "claude-opus-5"}], fn ->
        assert {"AGENTS_DEMO_MODEL", "claude-opus-5"} in Config.summary()
      end)
    end
  end
end
