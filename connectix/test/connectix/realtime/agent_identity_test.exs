defmodule Connectix.Realtime.AgentIdentityTest do
  # NOT async: the rule file is cached in one `:persistent_term` for the node
  # and these tests swap it, so anything reading a rule beside them would read
  # this file's.
  use ExUnit.Case, async: false

  alias Connectix.Realtime.AgentIdentity

  # The two shapes the API hands back: the login body wraps the user, the
  # record endpoint does not. Both carry the token in the same place.
  test "reads powerlink_token from a bare user record" do
    record = %{"uuid" => "u-1", "profile" => %{"powerlink_token" => "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"}}
    assert AgentIdentity.powerlink_token(record) == "cb1b0a46-77d5-4b3a-92d8-31768fea74e4"
  end

  test "reads powerlink_token from a login body that wraps the user" do
    body = %{"token" => "jwt", "user" => %{"profile" => %{"powerlink_token" => "tok-1"}}}
    assert AgentIdentity.powerlink_token(body) == "tok-1"
  end

  test "treats a missing or blank token as absent" do
    assert AgentIdentity.powerlink_token(%{"profile" => %{}}) == nil
    assert AgentIdentity.powerlink_token(%{"profile" => %{"powerlink_token" => ""}}) == nil
    assert AgentIdentity.powerlink_token(%{}) == nil
  end

  # A session whose token cannot be resolved answers to NO id — not to its
  # portal uuid. The uuid fallback is how every user came to pop on every
  # call: the node stamps `user_uuid` on a user's own stream frames, and the
  # rule falls back to that field. Pops off for one session beats pops for all.
  test "resolve yields no ids at all when there is no credential to look the token up with" do
    assert AgentIdentity.resolve("u-1", nil) == []
  end
  describe "the mapping written in the rule file" do
    setup do
      previous = System.get_env("SCREEN_POP_RULE")

      on_exit(fn ->
        if previous,
          do: System.put_env("SCREEN_POP_RULE", previous),
          else: System.delete_env("SCREEN_POP_RULE")

        Connectix.Realtime.PopRule.reload()
      end)

      :ok
    end

    defp with_agents(yaml, fun) do
      path = Path.join(System.tmp_dir!(), "agents_#{System.unique_integer([:positive])}.yaml")
      File.write!(path, "service_type: screen_pop\ntriggers:\n  - bridge-agent-start\n" <> yaml)
      System.put_env("SCREEN_POP_RULE", path)
      Connectix.Realtime.PopRule.reload()

      try do
        fun.()
      after
        File.rm(path)
      end
    end

    test "one id, written as a bare string" do
      with_agents("""
      agents:
        be5bc5f0-feb3-4c96-a370-3219f7ede250: 23c5e4f4-8e1d-4878-9587-835e4e06ee19
      """, fn ->
        assert Connectix.Realtime.PopRule.agents_for("be5bc5f0-feb3-4c96-a370-3219f7ede250") ==
                 ["23c5e4f4-8e1d-4878-9587-835e4e06ee19"]
      end)
    end

    test "several ids, written as a list" do
      with_agents("""
      agents:
        u-1:
          - powerlink-a
          - powerlink-b
      """, fn ->
        assert Connectix.Realtime.PopRule.agents_for("u-1") == ["powerlink-a", "powerlink-b"]
      end)
    end

    test "a user nobody named gets nothing, not everyone else's ids" do
      with_agents("""
      agents:
        u-1: powerlink-a
      """, fn ->
        assert Connectix.Realtime.PopRule.agents_for("u-2") == []
      end)
    end

    test "resolve/2 uses the file when there is no token to look anything up with" do
      # The lookup needs the user's own credential. Without one there is
      # nothing to ask, and the written mapping is all there is — which is the
      # case that makes this testable at all.
      with_agents("""
      agents:
        u-1: powerlink-a
      """, fn ->
        assert AgentIdentity.resolve("u-1", nil) == ["powerlink-a"]
      end)
    end

    test "an empty agents block is not a mapping for everyone" do
      with_agents("agents: {}\n", fn ->
        assert Connectix.Realtime.PopRule.agents() == %{}
        assert Connectix.Realtime.PopRule.agents_for("anyone") == []
      end)
    end

    test "an id the file names as a powerlink IS an agent id, whoever holds it" do
      # The portal's own login mints a token whose `user_uuid` is the powerlink
      # id, so the value on the socket and the value on the wire are the same
      # one. Looking it up in a map keyed by email finds nothing — and then the
      # socket registers nothing, every `state.user.<id>` frame is dropped as
      # unattributable, and no pop ever fires. Silently, because an unclaimed
      # id looks exactly like an agent who is not signed in.
      with_agents("""
      agents:
        "662@phk.com": {powerlink: cb1b0a46, password: "x"}
      """, fn ->
        assert Connectix.Realtime.PopRule.agent_id?("cb1b0a46")
        refute Connectix.Realtime.PopRule.agent_id?("somebody-else")

        assert AgentIdentity.resolve("cb1b0a46", nil) == ["cb1b0a46"]
      end)
    end

    test "an id nobody names resolves to nothing, never to everyone's ids" do
      with_agents("""
      agents:
        "662@phk.com": {powerlink: cb1b0a46, password: "x"}
      """, fn ->
        assert AgentIdentity.resolve("a-stranger", nil) == []
      end)
    end
  end

end
