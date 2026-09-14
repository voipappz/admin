defmodule Connectix.Realtime.InspectorTest do
  use ExUnit.Case, async: false

  alias Connectix.Realtime.{Inspector, Sessions}

  defp user, do: "insp-#{System.unique_integer([:positive])}"

  test "an agent row joins the browser socket with its cable client, and says when one half is missing" do
    uuid = user()
    :ok = Sessions.opened(self(), %{user_uuid: uuid, environment_uuid: nil, agent_ids: ["agent-1"]})

    assert [row] = Enum.filter(Inspector.agents(), &(&1.user_uuid == uuid))
    assert [%{pid: pid}] = row.sockets
    assert pid == self()
    assert row.agent_ids == ["agent-1"]
    # No CABLE_URL in tests, so no client was ever started: the row says so
    # rather than hiding the user.
    assert row.cable == nil

    Sessions.closed(self(), :normal)
  end

  test "the snapshot carries the closes and the application connection" do
    snap = Inspector.snapshot()
    assert is_list(snap.agents)
    assert is_list(snap.closes)
    assert is_map(snap.api_proxy)
    assert Map.has_key?(snap.api_proxy, :relay_ready?)
  end

  test "kick tells every socket of the user to go, and counts them" do
    uuid = user()
    :ok = Sessions.opened(self(), %{user_uuid: uuid, environment_uuid: nil, agent_ids: []})

    assert Inspector.kick(uuid) == 1
    assert_receive :kick

    Sessions.closed(self(), :normal)
    assert Inspector.kick(uuid) == 0
  end

  test "reconnecting the cable of a user without a client is an error, not a crash" do
    assert {:error, :no_client} = Inspector.reconnect_cable(user())
  end
end
