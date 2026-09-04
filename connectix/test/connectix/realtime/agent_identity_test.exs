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

  # A bad credential must degrade to "match on the uuid", never to a user with
  # no ids at all — that would silently switch every pop off for the session.
  test "resolve never returns fewer ids than the user uuid" do
    assert AgentIdentity.resolve("u-1", nil) == ["u-1"]
  end
end
