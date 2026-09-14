defmodule ConnectixWeb.RealtimeSocketLifecycleTest do
  @moduledoc """
  What the socket records about itself, and how an operator closes it.

  A socket used to leave no trace: `terminate/2` was `:ok`, so a report of
  "the agent got disconnected" could only be answered from the reverse
  proxy's request log. Now the pong, the close reason and the lifetime are
  kept — see `Realtime.Sessions` — and the TUI can kick a socket whose
  browser has gone quiet.
  """
  use ExUnit.Case, async: false

  alias Connectix.Realtime.Sessions
  alias ConnectixWeb.RealtimeSocket

  setup do
    uuid = "life-#{System.unique_integer([:positive])}"
    :ok = Sessions.opened(self(), %{user_uuid: uuid, environment_uuid: nil, agent_ids: []})
    on_exit(fn -> Sessions.closed(self(), :normal) end)
    {:ok, uuid: uuid, state: %{claims: %{user_uuid: uuid}, topics: MapSet.new()}}
  end

  test "a pong from the browser is the proof the path is alive", %{state: state} do
    assert Sessions.lookup(self()).last_pong_at == nil
    assert {:ok, ^state} = RealtimeSocket.handle_control({"", [opcode: :pong]}, state)
    assert is_integer(Sessions.lookup(self()).last_pong_at)
  end

  test "other control frames are ignored", %{state: state} do
    assert {:ok, ^state} = RealtimeSocket.handle_control({"", [opcode: :ping]}, state)
  end

  test "a kick closes with 1012 so the extension reconnects", %{state: state} do
    # 1012 is "service restart" — a code the client treats as "try again",
    # which the extension does three seconds later with the same token.
    assert {:stop, :normal, {1012, "kicked"}, ^state} = RealtimeSocket.handle_info(:kick, state)
  end

  test "terminate records the close with its reason", %{state: state, uuid: uuid} do
    assert :ok = RealtimeSocket.terminate(:remote, state)
    assert Sessions.lookup(self()) == nil
    assert [%{reason: :remote}] = Enum.filter(Sessions.recent_closes(50), &(&1.user_uuid == uuid))
  end

  test "a realtime frame is counted as pushed", %{state: state} do
    assert {:push, {:text, _}, ^state} = RealtimeSocket.handle_info({:realtime, %{type: "x"}}, state)
    assert Sessions.lookup(self()).pushed == 1
  end
end
