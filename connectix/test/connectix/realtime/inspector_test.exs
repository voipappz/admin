defmodule Connectix.Realtime.InspectorTest do
  use ExUnit.Case, async: false

  alias Connectix.Realtime.{Inspector, Sessions}

  defp user, do: "insp-#{System.unique_integer([:positive])}"

  test "an agent row carries the browser sockets and the ids the switch knows them by" do
    uuid = user()

    :ok =
      Sessions.opened(self(), %{user_uuid: uuid, environment_uuid: nil, agent_ids: ["agent-1"]})

    assert [row] = Enum.filter(Inspector.agents(), &(&1.user_uuid == uuid))
    assert [%{pid: pid}] = row.sockets
    assert pid == self()
    assert row.agent_ids == ["agent-1"]
    # No CABLE_URL in tests, so no client was ever started: the row says so
    # rather than hiding the user.
    assert row.upstream == nil

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

  test "asking for a resubscribe without a producer is an answer, not a crash" do
    assert :ok = Inspector.resubscribe()
  end
  test "an agent whose only id IS their uuid still shows it, because that is now normal" do
    # The portal issues its own tokens and the identity on them is the
    # powerlink id, so `user_uuid` and the agent id are the same value. This
    # row used to strip it and read `ids=[]`, which looks exactly like a
    # mapping that failed — and on a live host it sent the debugging after the
    # registry when the registry was correct and the id on the wire was not.
    uuid = user()
    :ok = Sessions.opened(self(), %{user_uuid: uuid, environment_uuid: nil, agent_ids: [uuid]})
    on_exit(fn -> Sessions.closed(self(), :normal) end)

    assert [row] = Enum.filter(Inspector.agents(), &(&1.user_uuid == uuid))
    assert row.agent_ids == [uuid]
  end

end
