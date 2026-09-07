defmodule Connectix.ConfigTest do
  @moduledoc """
  The rules every accessor inherits, tested once on the primitives, plus the
  handful of accessors whose behaviour is more than "read this variable".
  """

  use ExUnit.Case, async: false

  alias Connectix.Config

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

  describe "model_provider/1" do
    test "reads the provider off the model name" do
      assert Config.model_provider("claude-sonnet-4-6") == :anthropic
      assert Config.model_provider("claude-haiku-4-5") == :anthropic
      assert Config.model_provider("gemini-2.5-flash") == :google
      assert Config.model_provider("gpt-4o-mini") == :openai
      assert Config.model_provider("o3-mini") == :openai
      assert Config.model_provider("grok-4") == :xai
    end

    test "anything unrecognised is Anthropic, the default provider" do
      assert Config.model_provider("something-else") == :anthropic
    end
  end

  describe "title_model/0" do
    test "defaults to the small Anthropic model when the main model is Anthropic" do
      with_env([{"CONNECTIX_MODEL", nil}, {"CONNECTIX_TITLE_MODEL", nil}], fn ->
        assert Config.model_provider(Config.title_model()) == :anthropic
      end)
    end

    test "follows the main model to another provider rather than needing a second key" do
      # Titles run on every conversation. A Gemini bot whose titles still
      # went to Anthropic would fail every title the moment the Anthropic key
      # was the reason for switching.
      with_env([{"CONNECTIX_MODEL", "gemini-2.5-flash"}, {"CONNECTIX_TITLE_MODEL", nil}], fn ->
        assert Config.title_model() == "gemini-2.5-flash"
      end)
    end

    test "an explicit title model wins" do
      with_env([{"CONNECTIX_MODEL", "gemini-2.5-flash"}, {"CONNECTIX_TITLE_MODEL", "gpt-4o-mini"}], fn ->
        assert Config.title_model() == "gpt-4o-mini"
      end)
    end
  end

  describe "env/1" do
    test "an unset variable and one set to \"\" are both absent" do
      with_env([{"CONNECTIX_TEST_VAR", nil}], fn ->
        assert Config.env("CONNECTIX_TEST_VAR") == nil
      end)

      with_env([{"CONNECTIX_TEST_VAR", ""}], fn ->
        assert Config.env("CONNECTIX_TEST_VAR") == nil
      end)
    end

    test "a value is returned verbatim" do
      with_env([{"CONNECTIX_TEST_VAR", " padded "}], fn ->
        assert Config.env("CONNECTIX_TEST_VAR") == " padded "
      end)
    end
  end

  describe "int_env/3" do
    test "parses an integer inside the range" do
      with_env([{"CONNECTIX_TEST_INT", "42"}], fn ->
        assert Config.int_env("CONNECTIX_TEST_INT", 7, 1..100) == 42
      end)
    end

    test "falls back rather than raising on garbage, partial numbers, and out of range" do
      for value <- ["not a number", "42abc", "", "1000"] do
        with_env([{"CONNECTIX_TEST_INT", value}], fn ->
          assert Config.int_env("CONNECTIX_TEST_INT", 7, 1..100) == 7
        end)
      end
    end

    test "falls back when unset" do
      with_env([{"CONNECTIX_TEST_INT", nil}], fn ->
        assert Config.int_env("CONNECTIX_TEST_INT", 7, 1..100) == 7
      end)
    end
  end

  describe "api_key/0" do
    test "a key shorter than 16 bytes is treated as absent" do
      with_env([{"CONNECTIX_API_KEY", "tooshort"}], fn ->
        assert Config.api_key() == nil
      end)
    end

    test "a long enough key is returned" do
      key = String.duplicate("k", 24)

      with_env([{"CONNECTIX_API_KEY", key}], fn ->
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
    test "CONNECTIX_DATA_DIR wins when set" do
      with_env([{"CONNECTIX_DATA_DIR", "/srv/agents"}], fn ->
        assert Config.data_dir() == "/srv/agents"
      end)
    end

    test "defaults under the system temp dir in test, so parallel runs cannot collide" do
      with_env([{"CONNECTIX_DATA_DIR", nil}], fn ->
        assert Config.data_dir() =~ System.tmp_dir!()
        assert Config.data_dir() =~ "user_files"
      end)
    end

    test "the default is partitioned by MIX_TEST_PARTITION" do
      with_env([{"CONNECTIX_DATA_DIR", nil}, {"MIX_TEST_PARTITION", "3"}], fn ->
        assert Config.data_dir() =~ "connectix_test3"
      end)
    end
  end

  describe "event_streams/0" do
    test "is empty when unset, so the cable connection carries what it always did" do
      with_env([{"EVENT_STREAMS", nil}], fn ->
        assert Config.event_streams() == []
      end)
    end

    test "parses scope:id pairs" do
      with_env([{"EVENT_STREAMS", "environment:env-1,user:user-1"}], fn ->
        assert Config.event_streams() == [{"environment", "env-1"}, {"user", "user-1"}]
      end)
    end

    test "tolerates whitespace around entries" do
      with_env([{"EVENT_STREAMS", " user:a , user:b "}], fn ->
        assert Config.event_streams() == [{"user", "a"}, {"user", "b"}]
      end)
    end

    test "keeps a colon inside the id, because only the first one separates" do
      with_env([{"EVENT_STREAMS", "user:node:test1"}], fn ->
        assert Config.event_streams() == [{"user", "node:test1"}]
      end)
    end

    test "drops malformed entries rather than raising" do
      # A typo in one stream must not stop the relay that carries every login.
      with_env([{"EVENT_STREAMS", "user:ok,nocolon,:no-scope,user:,"}], fn ->
        assert Config.event_streams() == [{"user", "ok"}]
      end)
    end

    test "does not subscribe to the same stream twice" do
      with_env([{"EVENT_STREAMS", "user:a,user:a"}], fn ->
        assert Config.event_streams() == [{"user", "a"}]
      end)
    end
  end

  describe "environments/0" do
    test "falls back to a single placeholder environment when unset" do
      with_env([{"CONNECTIX_ENVIRONMENTS", nil}], fn ->
        assert Config.environments() == [%{name: "default", domain: nil, wss_url: nil}]
      end)
    end

    test "parses name:domain:wss_url triples" do
      with_env(
        [
          {"CONNECTIX_ENVIRONMENTS",
           "prod:sip.example.com:wss://sip.example.com:8443,staging:sip-staging.example.com:wss://sip-staging.example.com:8443"}
        ],
        fn ->
          assert Config.environments() == [
                   %{
                     name: "prod",
                     domain: "sip.example.com",
                     wss_url: "wss://sip.example.com:8443"
                   },
                   %{
                     name: "staging",
                     domain: "sip-staging.example.com",
                     wss_url: "wss://sip-staging.example.com:8443"
                   }
                 ]
        end
      )
    end

    test "a name alone is a valid environment with no domain/wss_url" do
      with_env([{"CONNECTIX_ENVIRONMENTS", "sandbox"}], fn ->
        assert Config.environments() == [%{name: "sandbox", domain: nil, wss_url: nil}]
      end)
    end

    test "drops malformed entries and falls back to default if none survive" do
      with_env([{"CONNECTIX_ENVIRONMENTS", ":no-name,,"}], fn ->
        assert Config.environments() == [%{name: "default", domain: nil, wss_url: nil}]
      end)
    end
  end

  describe "models" do
    test "fall back to documented defaults" do
      with_env([{"CONNECTIX_MODEL", nil}, {"CONNECTIX_TITLE_MODEL", nil}], fn ->
        assert Config.main_model() == "claude-sonnet-4-6"
        assert Config.title_model() == "claude-haiku-4-5"
      end)
    end

    test "are overridable" do
      with_env([{"CONNECTIX_MODEL", "claude-opus-5"}], fn ->
        assert Config.main_model() == "claude-opus-5"
      end)
    end
  end

  describe "summary/0" do
    test "reports secrets by presence and never by value" do
      key = String.duplicate("s", 32)

      with_env([{"ANTHROPIC_API_KEY", key}, {"CONNECTIX_API_KEY", nil}], fn ->
        summary = Config.summary()

        assert {"ANTHROPIC_API_KEY", "set"} in summary
        assert {"CONNECTIX_API_KEY", "not set"} in summary

        refute Enum.any?(summary, fn {_label, value} -> value =~ key end)
      end)
    end

    test "reports non-secret settings by value" do
      with_env([{"CONNECTIX_MODEL", "claude-opus-5"}], fn ->
        assert {"CONNECTIX_MODEL", "claude-opus-5"} in Config.summary()
      end)
    end
  end
end
