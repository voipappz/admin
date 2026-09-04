defmodule ConnectixWeb.RealtimeSocketSessionTest do
  use ExUnit.Case, async: false

  alias Connectix.Realtime.ScreenPop
  alias ConnectixWeb.RealtimeSocket

  @environment_uuid "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

  test "registers the verified websocket user and environment with Elixir PubSub presence" do
    user_uuid = "socket-user-#{System.unique_integer([:positive])}"
    refute ScreenPop.online?(user_uuid, @environment_uuid)

    assert :ok = RealtimeSocket.register_session(user_uuid, @environment_uuid)
    assert ScreenPop.online?(user_uuid, @environment_uuid)
    refute ScreenPop.online?(user_uuid, "another-environment")
  end

  test "does not register a missing identity" do
    assert :ok = RealtimeSocket.register_session(nil, @environment_uuid)
    assert :ok = RealtimeSocket.register_session("", @environment_uuid)
    assert :ok = RealtimeSocket.register_session("user", nil)
    assert :ok = RealtimeSocket.register_session("user", "")
  end
end
