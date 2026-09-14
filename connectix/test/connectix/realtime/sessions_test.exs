defmodule Connectix.Realtime.SessionsTest do
  @moduledoc """
  The bookkeeping that outlives a browser socket.

  The production logs said `session: registered` and never `closed`, so a
  socket that lived 1h29m and one that lived 1.5s looked the same from the
  portal. These pin down that a close is recorded with its reason and
  lifetime, and that a row belongs to a live process only.
  """
  use ExUnit.Case, async: false

  import ExUnit.CaptureLog

  alias Connectix.Realtime.Sessions

  defp user, do: "sess-#{System.unique_integer([:positive])}"

  test "an open socket is listed with what was known at the handshake" do
    uuid = user()
    :ok = Sessions.opened(self(), %{user_uuid: uuid, environment_uuid: nil, agent_ids: ["a1"], remote_ip: "1.2.3.4"})

    assert [row] = Enum.filter(Sessions.live(), &(&1.user_uuid == uuid))
    assert row.pid == self()
    assert row.remote_ip == "1.2.3.4"
    assert row.agent_ids == ["a1"]
    assert row.last_pong_at == nil, "no pong has arrived yet"

    Sessions.closed(self(), :normal)
  end

  test "a pong stamps the row, a push counts" do
    uuid = user()
    :ok = Sessions.opened(self(), %{user_uuid: uuid, environment_uuid: nil, agent_ids: []})

    Sessions.pong(self())
    Sessions.pushed(self())
    Sessions.pushed(self())

    row = Sessions.lookup(self())
    assert is_integer(row.last_pong_at)
    assert row.pushed == 2

    Sessions.closed(self(), :normal)
  end

  test "closing moves the row to the log with the reason and the lifetime, and says so" do
    uuid = user()
    :ok = Sessions.opened(self(), %{user_uuid: uuid, environment_uuid: nil, agent_ids: []})

    log = capture_log(fn -> Sessions.closed(self(), :timeout) end)

    assert Sessions.lookup(self()) == nil
    assert [close] = Enum.filter(Sessions.recent_closes(50), &(&1.user_uuid == uuid))
    assert close.reason == :timeout
    assert is_integer(close.lived_ms) and close.lived_ms >= 0
    # The line that was missing when the last report came in.
    assert log =~ "session: closed #{uuid} after"
    assert log =~ ":timeout"
  end

  test "a row whose process died without terminate is dropped on read" do
    uuid = user()
    pid = spawn(fn -> :ok end)
    :ok = Sessions.opened(pid, %{user_uuid: uuid, environment_uuid: nil, agent_ids: []})
    ref = Process.monitor(pid)
    assert_receive {:DOWN, ^ref, _, _, _}

    refute Enum.any?(Sessions.live(), &(&1.user_uuid == uuid))
  end

  test "closing an unknown pid is a no-op" do
    assert :ok = Sessions.closed(spawn(fn -> :ok end), :remote)
  end

  test "lifetimes read like a human wrote them" do
    assert Sessions.human(1_500) == "1s"
    assert Sessions.human(89_000) == "1m29s"
    assert Sessions.human(5_333_000) == "1h28m"
    assert Sessions.human(nil) == "-"
  end
end
