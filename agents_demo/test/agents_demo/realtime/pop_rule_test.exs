defmodule AgentsDemo.Realtime.PopRuleTest do
  @moduledoc """
  The shipped rule file has to keep matching the frames the switch really
  sends. These assert against `priv/pocketflow/screen_pop.yaml` as deployed,
  so editing it wrongly fails here rather than in production silence.
  """

  use ExUnit.Case, async: false

  alias AgentsDemo.Realtime.PopRule

  setup do
    PopRule.reload()
    :ok
  end

  test "the shipped rule parses and carries a service" do
    assert %{"service_type" => "screen_pop"} = PopRule.rule()
  end

  # Both spellings: sessions.cr maps the callcenter action to a `user.*` name
  # when it folds a state frame, but a relayed raw frame keeps the original.
  test "accepts the raw callcenter action AND the mapped name" do
    triggers = PopRule.triggers()

    assert "agent-state-change" in triggers
    assert "user.state_change" in triggers
    assert "bridge-agent-start" in triggers
    assert "user.answer" in triggers
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

  test "the url template has both placeholders the builder fills" do
    url = PopRule.record_url()
    assert url =~ "{phone}"
    assert url =~ "{call_id}"
  end

  test "a missing rule file falls back rather than going silent" do
    System.put_env("SCREEN_POP_RULE", "/nonexistent/screen_pop.yaml")
    PopRule.reload()

    # Still pops for the real frame's action — a lost file must not quietly
    # switch screen pops off.
    assert "agent-state-change" in PopRule.triggers()
    assert PopRule.record_url() =~ "{phone}"
  after
    System.delete_env("SCREEN_POP_RULE")
    PopRule.reload()
  end
end
