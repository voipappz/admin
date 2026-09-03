defmodule AgentsDemoWeb.RealtimeSocketHeartbeatTest do
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

  alias AgentsDemoWeb.RealtimeSocket

  test "the interval leaves room for a missed ping inside the idle timeout" do
    # The timeout `upgrade/1` passes to WebSockAdapter. Two heartbeats must fit,
    # so losing one is not a disconnect.
    assert RealtimeSocket.heartbeat_ms() * 2 < 60_000
  end

  test "a heartbeat pushes a protocol ping and schedules the next one" do
    state = %{claims: %{}, topics: MapSet.new()}

    assert {:push, {:ping, ""}, ^state} = RealtimeSocket.handle_info(:heartbeat, state)

    # Rescheduled onto this process, so the socket keeps pinging for its life.
    assert_receive :heartbeat, RealtimeSocket.heartbeat_ms() + 1_000
  end

  test "an unrelated message neither pushes nor schedules" do
    state = %{claims: %{}, topics: MapSet.new()}

    assert {:ok, ^state} = RealtimeSocket.handle_info(:something_else, state)
    refute_receive :heartbeat, 100
  end
end
