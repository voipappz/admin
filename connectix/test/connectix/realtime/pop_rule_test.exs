defmodule Connectix.Realtime.PopRuleTest do
  @moduledoc """
  The shipped rule file has to keep matching the frames the switch really
  sends. These assert against `priv/pocketflow/screen_pop.yaml` as deployed,
  so editing it wrongly fails here rather than in production silence.
  """

  use ExUnit.Case, async: false

  alias Connectix.Realtime.PopRule

  setup do
    PopRule.reload()
    :ok
  end

  test "the shipped rule parses and carries a service" do
    assert %{"service_type" => "screen_pop"} = PopRule.rule()
  end

  # ANSWER, not ringing. `bridge-agent-start` is the callcenter bridging caller
  # to agent; an `agent-state-change` into "In a queue call" is the same fact
  # as a state. `agent-offering` and `user.ringing` are deliberately absent —
  # they fire while the phone rings, once per agent the queue tries, so one
  # caller ringing four agents opened a CRM tab for three people who never
  # took the call.
  # ONE trigger, because the dedupe key is per (event name, agent, call): two
  # spellings of the same fact produce two keys and two tabs. Observed live —
  # `agent-offering` and `bridge-agent-start` for one call opened two.
  test "exactly one event pops, so one call cannot open two tabs" do
    assert PopRule.triggers() == ["bridge-agent-start"]
  end

  test "never pops while the phone is still ringing" do
    triggers = PopRule.triggers()

    refute "agent-offering" in triggers
    refute "user.ringing" in triggers
    refute "user.answer" in triggers
  end

  # "Receiving" is the ringing state; "In a queue call" is the answered one.
  test "only the answered agent state pops" do
    assert "In a queue call" in PopRule.agent_states()
    refute "Receiving" in PopRule.agent_states()
  end

  # The agent is named by powerlink_token, and CC-Agent is where it lands.
  test "looks for the agent under meta.CC-Agent first" do
    assert "meta.CC-Agent" in PopRule.agent_fields()
    assert "user_uuid" in PopRule.agent_fields()
  end

  test "digs a dotted path out of a real frame" do
    frame = %{
      "user_uuid" => "cb1b0a46-77d5-4b3a-92d8-31768fea74e4",
      "meta" => %{"CC-Agent" => "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"}
    }

    assert PopRule.dig(frame, "meta.CC-Agent") == "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"
    assert PopRule.dig(frame, "user_uuid") == "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"
    assert PopRule.dig(frame, "meta.missing") == nil
    assert PopRule.dig(frame, "nope.deeper") == nil
  end

  # "In a queue call" is the state the node sends when an agent takes a queue
  # call — if it ever stops being listed, no callcenter pop fires at all.
  test "treats the queue-call state as one that pops" do
    assert "In a queue call" in PopRule.agent_states()
  end

  # The customer's endpoint takes ONE parameter: the caller's number. `callId`
  # used to be appended and was not part of their contract — and its value came
  # from `call_id/1` falling back to the event's own id, so it silently carried
  # the action name and changed whenever the trigger did.
  test "the url template takes the caller number and nothing else" do
    url = PopRule.record_url()

    assert url =~ "{phone}"
    refute url =~ "{call_id}"
    refute url =~ "callId"
  end

  describe "the deadman threshold" do
    test "the shipped file sets one, because silence is the failure nobody sees" do
      # A dead feed passes every other check this app has: the socket is open,
      # the producer says subscribed, /health is green. Shipping without a
      # threshold means shipping without the only check that would catch it.
      assert PopRule.nats_deadman_ms() == 900_000
    end

    test "reads minutes, seconds, hours and milliseconds" do
      assert deadman("15m") == 900_000
      assert deadman("90s") == 90_000
      assert deadman("2h") == 7_200_000
      assert deadman("1500ms") == 1_500
    end

    test "a bare number is SECONDS, because nobody writes milliseconds by hand" do
      assert deadman("600") == 600_000
      assert deadman(600) == 600_000
    end

    test "`off` disables it, and does not fall back to the default" do
      # The distinction that matters: 0 is a decision, and treating it as
      # "unset" would quietly re-enable an alarm somebody turned off on
      # purpose — on a deployment whose switch is legitimately quiet at night,
      # that is a page every night.
      assert deadman("off") == 0
      assert deadman("never") == 0
      assert deadman("none") == 0
    end

    test "an unreadable value falls back rather than disabling the check" do
      # `15 minutes` is the plausible typo, and the dangerous reading of it is
      # 0 — which turns the alarm off silently. Falling back keeps it armed.
      assert deadman("15 minutes") == 900_000
      assert deadman("") == 900_000
      assert deadman(nil) == 900_000
    end

    test "the environment supplies it when the file does not" do
      System.put_env("NATS_DEADMAN", "3m")
      assert deadman(nil) == 180_000
    after
      System.delete_env("NATS_DEADMAN")
    end
  end

  defp deadman(value) do
    nats = %{"url" => "nats://127.0.0.1:4222", "subjects" => ["node:test1"]}
    nats = if is_nil(value), do: nats, else: Map.put(nats, "deadman", value)

    write_rule(%{"nats" => nats, "triggers" => ["bridge-agent-start"]})
    PopRule.nats_deadman_ms()
  end

  defp write_rule(rule) do
    path = Path.join(System.tmp_dir!(), "deadman_#{System.unique_integer([:positive])}.yaml")
    File.write!(path, yaml(rule))
    Application.put_env(:connectix, :shared_rule, path)
    PopRule.reload()

    on_exit(fn ->
      File.rm(path)
      Application.delete_env(:connectix, :shared_rule)
      PopRule.reload()
    end)
  end

  # Enough YAML for these examples, written out rather than pulled in: the
  # values under test are scalars and lists of scalars.
  defp yaml(rule) do
    Enum.map_join(rule, "\n", fn
      {key, value} when is_list(value) ->
        "#{key}:\n" <> Enum.map_join(value, "\n", &"  - #{&1}")

      {key, %{} = nested} ->
        "#{key}:\n" <>
          Enum.map_join(nested, "\n", fn
            {k, v} when is_list(v) -> "  #{k}:\n" <> Enum.map_join(v, "\n", &"    - #{&1}")
            {k, v} -> "  #{k}: \"#{v}\""
          end)
    end)
  end

  test "a missing shared rule still pops, rather than going silent" do
    Application.put_env(:connectix, :shared_rule, "/nonexistent/screen_pop.yaml")
    PopRule.reload()

    # The trigger survives: a lost file must not quietly switch screen pops off.
    assert PopRule.triggers() == ["bridge-agent-start"]
  after
    Application.delete_env(:connectix, :shared_rule)
    PopRule.reload()
  end

  describe "the customer rule" do
    test "is a mounted file, not a name in the environment" do
      # An env selector named a customer while the image carried the files, and
      # nothing checked that the name matched one — so a typo, or a customer
      # added to a deploy config before its file merged, started cleanly,
      # signed nobody in and consumed nothing. The file that is MOUNTED is the
      # customer; there are not two things to keep in step.
      assert Path.type(PopRule.customer_path()) == :absolute
      assert PopRule.customer_path() =~ "customers/example.yaml"
    end

    test "supplies the values the shared policy deliberately does not" do
      # The suite runs against priv/pocketflow/customers/example.yaml, named in
      # config/test.exs exactly as a deployment names its mount.
      assert PopRule.record_url() =~ "{phone}"
      assert PopRule.subjects() != []
      assert map_size(PopRule.agents()) > 0
    end

    test "the shared policy carries no customer's agents or CRM" do
      # It shipped as one customer's rule doubling as everyone's default, so an
      # unconfigured deployment signed in that customer's agents and popped at
      # their CRM. A wrong answer delivered confidently is worse than none.
      shared = Path.join(:code.priv_dir(:connectix), "pocketflow/screen_pop.yaml")
      {:ok, rule} = YamlElixir.read_from_file(shared)

      refute Map.has_key?(rule, "agents")
      refute get_in(rule, ["profile", "record_url"])
      refute get_in(rule, ["nats", "subjects"])
    end

    test "with nothing mounted there are no agents, so nobody can sign in" do
      # The loud failure this design is for: a login that refuses beats a
      # login that succeeds against the wrong site's roster.
      #
      # RESTORED, NOT DELETED, in `after`. config/test.exs sets this key, so
      # `delete_env` would not put things back — it would remove the suite's
      # customer file for every test that runs after this one, in every file.
      # That is exactly what it did: nine pop tests failed in other modules
      # with "no profile.record_url" and passed when run alone.
      previous = Application.get_env(:connectix, :customer_rule)

      on_exit(fn ->
        Application.put_env(:connectix, :customer_rule, previous)
        PopRule.reload()
      end)

      Application.put_env(:connectix, :customer_rule, "/nonexistent/screen_pop.yaml")
      PopRule.reload()

      assert PopRule.agents() == %{}
      assert PopRule.record_url() == nil
      refute PopRule.source().customer_loaded?

      # And the shared policy is still there, so the failure is "no customer",
      # not "no rules at all".
      assert PopRule.triggers() == ["bridge-agent-start"]
    end
  end
end
