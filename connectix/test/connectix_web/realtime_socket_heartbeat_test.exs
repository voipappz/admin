defmodule ConnectixWeb.RealtimeSocketHeartbeatTest do
  @moduledoc """
  The socket pings its own client.

  `upgrade/1` sets a 60s idle timeout and this connection is idle by design —
  the portal pushes only when something happens and the client says nothing
  after the handshake. Every socket therefore died about a minute after it
  opened, taking the user's SessionRegistry entry with it, and presence is what
  gates a screen pop. The symptom was "pops stopped working", never "the socket
  dropped", which is why it survived so long.
  """

  use ExUnit.Case, async: true

  alias ConnectixWeb.RealtimeSocket

  test "the interval fits inside Chrome's service-worker idle timeout" do
    # MV3 terminates a background service worker idle for ~30s, and that — not
    # the 60s socket timeout — is what was killing sessions. Two heartbeats must
    # fit inside it, so losing one is not a disconnect.
    assert RealtimeSocket.heartbeat_ms() * 2 <= 30_000
    assert RealtimeSocket.heartbeat_ms() * 2 < 60_000
  end

  # A TEXT frame specifically: a protocol ping never wakes the service worker's
  # JS, so Chrome kills the worker while the socket looks perfectly healthy.
  test "a heartbeat pushes a text frame the client can see, and schedules the next" do
    state = %{claims: %{}, topics: MapSet.new()}

    assert {:push, frames, ^state} = RealtimeSocket.handle_info(:heartbeat, state)

    # The pong the browser sends back for this is the only INBOUND frame on an
    # idle socket, and Bandit's timeout measures what it receives. Without it
    # the socket closed every 63s no matter how often we pushed.
    assert {:ping, ""} in frames

    # And this one wakes the service worker, which a pong never does.
    assert Enum.any?(frames, fn
             {:text, json} -> match?(%{"type" => "ping"}, Jason.decode!(json))
             _ -> false
           end)

    # Rescheduled onto this process, so the socket keeps pinging for its life.
    assert_receive :heartbeat, RealtimeSocket.heartbeat_ms() + 1_000
  end

  test "an unrelated message neither pushes nor schedules" do
    state = %{claims: %{}, topics: MapSet.new()}

    assert {:ok, ^state} = RealtimeSocket.handle_info(:something_else, state)
    refute_receive :heartbeat, 100
  end
end
