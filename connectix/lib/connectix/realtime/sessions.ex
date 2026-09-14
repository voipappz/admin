defmodule Connectix.Realtime.Sessions do
  @moduledoc """
  What the portal knows about each browser socket, kept where a socket's death
  cannot take it with it.

  `SessionRegistry` answers "is this user here" and dies with the socket, which
  is exactly right for gating a screen pop. It is exactly wrong for the
  question that follows a complaint — "what happened to this agent's socket
  an hour ago" — because by then there is nothing left to look at. The
  production logs said `session: registered` and never `closed`, so a socket
  that lived 1h29m and one that lived 1.5s looked the same from the portal,
  and the lifetime had to be read off the reverse proxy's request log.

  So two ETS tables, owned by this process rather than by any socket:

    * `@live` — one row per open socket: who, since when, from where, and when
      the browser last answered a ping. The pong is the only inbound frame an
      idle extension ever sends, so its age is the one number that says the
      TCP path is still real.
    * `@closed` — the last `@keep` closes, with the reason WebSock gave and
      how long the socket lived. `:remote` is the browser hanging up,
      `:timeout` is Bandit's 60s idle close (no pong came back), and a
      `{:crash, _, _}` is ours.

  Public tables so the socket process writes its own row without a round trip
  through here, and so the TUI can read them over RPC.
  """

  use GenServer

  require Logger

  @live :realtime_sessions
  @closed :realtime_socket_closes
  @keep 200

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(_opts) do
    :ets.new(@live, [:named_table, :public, :set, read_concurrency: true])
    :ets.new(@closed, [:named_table, :public, :ordered_set])
    {:ok, %{}}
  end

  # ── writes, from the socket process ─────────────────────────────────────

  @doc "Record an open socket. Keyed by the socket's pid; `attrs` is the identity and origin."
  def opened(pid, attrs) when is_pid(pid) and is_map(attrs) do
    now = System.system_time(:millisecond)

    row =
      Map.merge(attrs, %{
        pid: pid,
        connected_at: now,
        last_pong_at: nil,
        pushed: 0
      })

    insert(@live, {pid, row})
  end

  @doc "The browser answered a ping — the TCP path is alive as of now."
  def pong(pid) when is_pid(pid),
    do: update(pid, &%{&1 | last_pong_at: System.system_time(:millisecond)})

  @doc "A frame went out to the browser."
  def pushed(pid) when is_pid(pid), do: update(pid, &%{&1 | pushed: &1.pushed + 1})

  @doc """
  The socket is gone. Moves the row to the close log with the reason and the
  lifetime, and says so in the log, because "closed after 1h29m (:remote)" is
  the line that was missing when the last report came in.
  """
  def closed(pid, reason) when is_pid(pid) do
    case lookup(pid) do
      nil ->
        :ok

      row ->
        now = System.system_time(:millisecond)
        lived_ms = now - row.connected_at
        :ets.delete(@live, pid)

        record = %{
          at: now,
          user_uuid: row.user_uuid,
          reason: reason,
          lived_ms: lived_ms,
          remote_ip: row[:remote_ip],
          last_pong_at: row.last_pong_at
        }

        insert(@closed, {{now, System.unique_integer([:monotonic, :positive])}, record})
        trim()

        Logger.info(
          "session: closed #{row.user_uuid} after #{human(lived_ms)} (#{inspect(reason)})"
        )

        :ok
    end
  end

  # ── reads ───────────────────────────────────────────────────────────────

  @doc """
  Every open socket, oldest first. A row whose process is gone — killed
  without `terminate/2` running — is dropped on the way out, so the table
  never claims a session the registry would deny.
  """
  def live do
    @live
    |> :ets.tab2list()
    |> Enum.flat_map(fn {pid, row} ->
      if Process.alive?(pid) do
        [row]
      else
        :ets.delete(@live, pid)
        []
      end
    end)
    |> Enum.sort_by(& &1.connected_at)
  rescue
    ArgumentError -> []
  end

  @doc "The most recent closes, newest first."
  def recent_closes(limit \\ 20) do
    @closed
    |> :ets.tab2list()
    |> Enum.sort_by(fn {key, _} -> key end, :desc)
    |> Enum.take(limit)
    |> Enum.map(fn {_key, record} -> record end)
  rescue
    ArgumentError -> []
  end

  @doc false
  def lookup(pid) do
    case :ets.lookup(@live, pid) do
      [{^pid, row}] -> row
      [] -> nil
    end
  rescue
    ArgumentError -> nil
  end

  @doc false
  def human(ms) when is_integer(ms) do
    s = div(ms, 1000)

    cond do
      s < 60 -> "#{s}s"
      s < 3600 -> "#{div(s, 60)}m#{rem(s, 60)}s"
      true -> "#{div(s, 3600)}h#{rem(div(s, 60), 60)}m"
    end
  end

  def human(_), do: "-"

  # ── internals ───────────────────────────────────────────────────────────

  defp update(pid, fun) do
    case lookup(pid) do
      nil -> :ok
      row -> insert(@live, {pid, fun.(row)})
    end
  end

  defp insert(table, tuple) do
    :ets.insert(table, tuple)
    :ok
  rescue
    ArgumentError -> :ok
  end

  defp trim do
    size = :ets.info(@closed, :size)

    if is_integer(size) and size > @keep do
      Enum.each(1..(size - @keep), fn _ ->
        case :ets.first(@closed) do
          :"$end_of_table" -> :ok
          key -> :ets.delete(@closed, key)
        end
      end)
    end
  rescue
    ArgumentError -> :ok
  end
end
