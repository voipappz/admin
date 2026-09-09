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

    assert url =~ "CallerNumber={phone}"
    refute url =~ "{call_id}"
    refute url =~ "callId"
  end

  test "a missing rule file falls back rather than going silent" do
    System.put_env("SCREEN_POP_RULE", "/nonexistent/screen_pop.yaml")
    PopRule.reload()

    # Still pops for the real frame's action — a lost file must not quietly
    # switch screen pops off.
    assert PopRule.triggers() == ["bridge-agent-start"]
    assert PopRule.record_url() =~ "{phone}"
  after
    System.delete_env("SCREEN_POP_RULE")
    PopRule.reload()
  end
end
