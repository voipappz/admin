defmodule Connectix.Realtime.AgentIdentityTest do
  use ExUnit.Case, async: true

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
end
