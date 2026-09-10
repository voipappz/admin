defmodule Connectix.Events do
  @moduledoc """
  Every event this portal receives off the cable, appended to DuckDB.

  One embedded file this node owns — no server, no Postgres driver. DuckDB
  because the questions asked of this table are analytical ("what did agent X
  see between 14:00 and 15:00", "how many `agent-state-change` per environment")
  and it answers them over columnar storage without another service to run.

  ## The row is deliberately generic

      id | src | sid | create_date | label | headers | raw

  Seven columns, and only two of them mean anything to this application: `src`
  is the stream a frame arrived on and `sid` is the thing it is *about*. The
  shape is deliberately local and generic: later audit questions should remain
  `headers` lookups or `raw` searches rather than schema changes. A projection
  decided today is a migration tomorrow; `raw` keeps the whole frame regardless,
  so nothing is lost by not guessing.

  `sid` is the **call** when the frame carries one, and only then the user, and
  only then the frame's own id. That ordering is the whole value of
  `timeline/1`: one call's frames, from whichever stream they arrived on,
  merged into the sequence a human would narrate.

  `create_date` is epoch **microseconds** — an integer, not a timestamp — so
  ordering never depends on a text format and a caller can subtract two of them.

  ## It never breaks the realtime path

  A write is a `cast`: the caller — `CableClient.fanout/3` on a user's stream,
  `ScreenPop` on CallEvents — hands the frame over and moves on. If DuckDB
  cannot open, this starts anyway, logs once, and every write is a no-op. An
  event store that takes screen pops down with it is worse than no event store.

  Reads say so out loud: a closed store answers `{:error, :not_storing}`, never
  `{:ok, []}`. "No events are stored here" and "nothing happened" are different
  answers and only one of them is worth waking someone for.

  ## Duplicates are dropped, not stored

  The node delivers the same frame many times — one `number.answer` was
  measured arriving 28 times, identical `call_uuid` and `occurred_at`. Storing
  raw would inflate the table thirtyfold and make every count wrong, so a frame
  is keyed by its own identity and a repeat is ignored. The identity
  deliberately excludes `create_date`: a re-delivery arrives later by
  definition, and keying on arrival time would defeat the dedupe entirely.

  ## Where it lives

  `EVENTS_DB`, else `<EVENTS_DIR>/events.duckdb`, else `<data dir>/events`.

  **A path inside the container is not storage.** Every deployment has to mount
  a volume and point `EVENTS_DIR` (or `CONNECTIX_DATA_DIR`) at it, or the
  file is created fresh in the container's own filesystem and every deploy
  starts an empty store — with no error, because an empty DuckDB is a perfectly
  valid one. That was true of nimbus until 2026-09-07, which is why this
  paragraph exists; both deployments now mount `/var/lib/connectix:/data` and
  set `EVENTS_DIR=/data/events`. The same mount carries Mnesia
  (`MNESIA_DIR=/data/mnesia`), which fails the same silent way.

  In development the repo is bind-mounted, so `connectix/user_files/events/`
  survives container restarts without anything extra.
  """

  use GenServer

  require Logger

  @table "events"

  @columns ~w(id src sid create_date label headers raw)

  # `headers` and `raw` are VARCHAR, not JSON. DuckDB's JSON type lives in an
  # extension that must be INSTALLed — a network fetch at boot, on a production
  # box, before a single event can be stored. Both columns hold Jason-encoded
  # text either way; `json_extract` works on them the moment the extension is
  # loaded by whoever queries, and nothing about writing depends on it.
  @schema """
  CREATE TABLE IF NOT EXISTS #{@table} (
    id           VARCHAR PRIMARY KEY,
    src          VARCHAR,
    sid          VARCHAR,
    create_date  BIGINT,
    label        VARCHAR,
    headers      VARCHAR,
    raw          VARCHAR
  )
  """

  # A browse must not be able to ask for the whole table by accident.
  @max_limit 1_000
  @default_recent_limit 100
  @default_search_limit 50

  # How long to wait before trying to open the file again.
  #
  # The store gave up permanently on a failed open, and the one failure that
  # actually happens is transient by construction: kamal starts the new
  # container, health-checks it, and only THEN stops the old one, so for a few
  # seconds both are running — and DuckDB is single-writer. The new container
  # lost the race, logged "Conflicting lock is held in PID 0", and stored
  # nothing at all until someone restarted it by hand. Every deploy, silently.
  @reopen_after_ms 5_000

  # How often to drop events past the retention window. Hourly: the window is
  # measured in days, so the exact moment a row leaves does not matter, and a
  # DELETE over a few hundred thousand rows should not run more often than the
  # data it removes accumulates.
  @prune_every_ms :timer.hours(1)

  # Compact only when the file is both big enough to matter and mostly dead
  # space, because compaction rewrites every live row.
  @compact_min_bytes 256 * 1_048_576
  @compact_ratio 2

  # Keys never copied into `headers`: they are the bulk, and `raw` already has
  # them. Everything else the frame carries is small and worth filtering on.
  @bulk_keys ~w(payload body data raw)

  defstruct [:db, :conn, :path, written: 0, errors: 0]

  # ── API ──────────────────────────────────────────────────────────────────

  @typedoc "One stored event, as returned by every read."
  @type row :: %{String.t() => term()}

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  @doc false
  def child_spec(opts) do
    %{id: Keyword.get(opts, :name, __MODULE__), start: {__MODULE__, :start_link, [opts]}}
  end

  @doc """
  Store one event. `ev` carries `"src"`, `"sid"`, `"label"`, `"headers"`,
  `"raw"`, and optionally `"create_date"` (epoch microseconds) and `"id"`.

  A cast on purpose: the realtime path must not wait on, or fail with, a write.
  """
  @spec insert(map()) :: :ok
  def insert(ev), do: insert(__MODULE__, ev)

  @spec insert(GenServer.server(), map()) :: :ok
  def insert(server, ev) when is_map(ev), do: GenServer.cast(server, {:insert, ev})
  def insert(_server, _ev), do: :ok

  @doc """
  Store one received cable frame. `source` says which stream it came from.

  The convenience the realtime path calls: it holds frames, not rows, and
  should not have to know this module's column names. See `insert/2` for the
  shape it is mapped onto, and the moduledoc for why `sid` prefers the call.
  """
  @spec record(String.t(), map()) :: :ok
  def record(source, event), do: record(__MODULE__, source, event)

  @spec record(GenServer.server(), String.t(), map()) :: :ok
  def record(server, source, event) when is_binary(source) and is_map(event),
    do: GenServer.cast(server, {:record, source, event})

  def record(_server, _source, _event), do: :ok

  @doc """
  Events newest first. Options: `:limit` (default #{@default_recent_limit},
  capped at #{@max_limit}) and `:src`.
  """
  @spec recent(keyword()) :: {:ok, [row()]} | {:error, term()}
  def recent(opts \\ []) when is_list(opts), do: recent(__MODULE__, opts)

  @spec recent(GenServer.server(), keyword()) :: {:ok, [row()]} | {:error, term()}
  def recent(server, opts), do: read(server, {:recent, opts})

  @doc """
  Every stored event for one `sid`, **oldest first** — a call's merged
  timeline, in the order it happened.

  The one read that is not newest-first, because it is the one read a person
  narrates rather than scans.
  """
  @spec timeline(String.t()) :: {:ok, [row()]} | {:error, term()}
  def timeline(sid) when is_binary(sid), do: timeline(__MODULE__, sid)

  @spec timeline(GenServer.server(), String.t()) :: {:ok, [row()]} | {:error, term()}
  def timeline(server, sid) when is_binary(sid), do: read(server, {:timeline, sid})

  @doc """
  Substring search over `sid`, `label`, `headers` and `raw`, newest first.
  Options: `:limit` (default #{@default_search_limit}, capped at #{@max_limit}).

  Case-insensitive and unanchored — the caller has a phone number or a uuid and
  no idea which field the node put it in, which is the entire reason `raw` is
  stored.
  """
  @spec search(String.t(), keyword()) :: {:ok, [row()]} | {:error, term()}
  def search(q, opts \\ []) when is_binary(q), do: search(__MODULE__, q, opts)

  @spec search(GenServer.server(), String.t(), keyword()) :: {:ok, [row()]} | {:error, term()}
  def search(server, q, opts) when is_binary(q), do: read(server, {:search, q, opts})

  @doc """
  Whether the store currently has its file open, without calling the process.

  For health checks and anything else on a hot path — see `mark_open/1`.
  """
  @spec open?() :: boolean()
  def open?, do: :persistent_term.get({__MODULE__, :open?}, false)

  @doc """
  What this store is doing: `:open?`, `:count`, `:written`, `:errors`, `:path`.

  Also the one synchronous point in the API, so tests use it to wait for casts
  they just made — see `Connectix.EventsTest`.
  """
  @spec stats() :: map()
  def stats, do: stats(__MODULE__)

  @spec stats(GenServer.server()) :: map()
  def stats(server) do
    GenServer.call(server, :stats, 15_000)
  catch
    :exit, _ -> %{open?: false, count: 0, written: 0, errors: 0, path: nil}
  end

  defp read(server, request) do
    GenServer.call(server, request, 15_000)
  catch
    :exit, _ -> {:error, :unavailable}
  end

  # ── server ───────────────────────────────────────────────────────────────

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path) || default_path()

    case open(path) do
      {:ok, db, conn} ->
        Logger.info("events: storing to #{path}")
        mark_open(true)
        schedule_prune()
        {:ok, %__MODULE__{db: db, conn: conn, path: path}}

      {:error, reason} ->
        # Started, but inert. See the moduledoc: a broken store must not take
        # the realtime path with it. Logged once, here, and never again per
        # dropped write — a store that cannot open drops every frame, and one
        # line per frame is how a disk fills.
        mark_open(false)
        Logger.error("events: cannot open #{path} (#{inspect(reason)}) — retrying")
        {:ok, %__MODULE__{db: nil, conn: nil, path: path}, {:continue, :retry_open}}
    end
  end

  @impl true
  def handle_continue(:retry_open, state) do
    Process.send_after(self(), :retry_open, @reopen_after_ms)
    {:noreply, state}
  end

  @impl true
  def handle_info(:retry_open, %{conn: nil, path: path} = state) do
    case open(path) do
      {:ok, db, conn} ->
        Logger.info("events: storing to #{path} (opened on retry)")
        mark_open(true)
        schedule_prune()
        {:noreply, %{state | db: db, conn: conn}}

      {:error, _reason} ->
        # Quiet from here on. The first failure was logged at :error; repeating
        # it every few seconds turns a recoverable condition into noise.
        Process.send_after(self(), :retry_open, @reopen_after_ms)
        {:noreply, state}
    end
  end

  def handle_info(:retry_open, state), do: {:noreply, state}

  def handle_info(:prune, %{conn: nil} = state) do
    schedule_prune()
    {:noreply, state}
  end

  def handle_info(:prune, state) do
    schedule_prune()
    {:noreply, prune(state)}
  end

  @impl true
  def handle_cast(_request, %{conn: nil} = state), do: {:noreply, state}

  def handle_cast({:insert, ev}, state), do: {:noreply, write(state, normalize(ev))}

  def handle_cast({:record, source, event}, state),
    do: {:noreply, write(state, normalize(from_frame(source, event)))}

  @impl true
  def handle_call(:stats, _from, state) do
    {:reply,
     %{
       open?: state.conn != nil,
       count: stored_count(state),
       written: state.written,
       errors: state.errors,
       path: state.path
     }, state}
  end

  def handle_call(_request, _from, %{conn: nil} = state),
    do: {:reply, {:error, :not_storing}, state}

  def handle_call({:recent, opts}, _from, state) do
    {where, args} =
      case Keyword.get(opts, :src) do
        nil -> {"", []}
        src -> {"WHERE src = ?", [src]}
      end

    sql = select(where, "create_date DESC", limit(opts, @default_recent_limit))
    {:reply, rows(state.conn, sql, args), state}
  end

  def handle_call({:timeline, sid}, _from, state) do
    # No limit clause of its own beyond the cap: a timeline is the whole call,
    # and truncating the middle of one is worse than refusing to show it.
    sql = select("WHERE sid = ?", "create_date ASC", @max_limit)
    {:reply, rows(state.conn, sql, [sid]), state}
  end

  def handle_call({:search, q, opts}, _from, state) do
    pattern = "%" <> escape_like(q) <> "%"

    where =
      "WHERE sid ILIKE ? ESCAPE '!' OR label ILIKE ? ESCAPE '!' " <>
        "OR headers ILIKE ? ESCAPE '!' OR raw ILIKE ? ESCAPE '!'"

    sql = select(where, "create_date DESC", limit(opts, @default_search_limit))
    {:reply, rows(state.conn, sql, List.duplicate(pattern, 4)), state}
  end

  # ── writing ──────────────────────────────────────────────────────────────

  defp write(state, row) do
    # ON CONFLICT DO NOTHING: the node re-delivers the same frame many times.
    sql = """
    INSERT INTO #{@table} (id, src, sid, create_date, label, headers, raw)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO NOTHING
    """

    args = [row.id, row.src, row.sid, row.create_date, row.label, row.headers, row.raw]

    case Duckdbex.query(state.conn, sql, args) do
      {:ok, _} ->
        %{state | written: state.written + 1}

      {:error, reason} ->
        Logger.warning("events: insert failed — #{inspect(reason)}")
        %{state | errors: state.errors + 1}
    end
  end

  # A caller's map, in whatever completeness it arrived, turned into the seven
  # columns. `id` is the dedupe key: given one, it is honoured; otherwise it is
  # a digest of the *content* — never a random value, which would defeat the
  # dedupe entirely, and never one including `create_date`, see the moduledoc.
  defp normalize(ev) do
    src = string(ev["src"])
    sid = string(ev["sid"])
    label = string(ev["label"])
    headers = encode(ev["headers"])
    raw = raw_of(ev)

    %{
      id: string(ev["id"]) || digest([src, sid, label, headers, raw]),
      src: src,
      sid: sid,
      create_date: create_date(ev),
      label: label,
      headers: headers,
      raw: raw
    }
  end

  defp from_frame(source, event) do
    %{
      "src" => source,
      "sid" => sid_of(event),
      "label" => dig(event, "action") || dig(event, "event"),
      "headers" => Map.drop(event, @bulk_keys),
      "raw" => Jason.encode!(event),
      # The frame's identity, so a re-delivery is the same row.
      "id" => identity(event)
    }
  end

  # The call first — that is what makes `timeline/1` a call's story rather than
  # an agent's. Then the user, then the frame's own id, so an event is never
  # stored without something to group it by.
  defp sid_of(event) do
    dig(event, "call_uuid") || dig(event, ["data", "call_uuid"]) ||
      dig(event, "user_uuid") || dig(event, ["data", "user_uuid"]) ||
      identity(event)
  end

  defp identity(event) do
    dig(event, "event_id") || dig(event, "id") || dig(event, "uuid") ||
      digest([Jason.encode!(event)])
  end

  defp digest(parts) do
    :sha256
    |> :crypto.hash(parts |> Enum.map(&to_string/1) |> Enum.join("\0"))
    |> Base.encode16(case: :lower)
  end

  defp create_date(ev) do
    case ev["create_date"] do
      n when is_integer(n) -> n
      _absent_or_junk -> System.os_time(:microsecond)
    end
  end

  defp raw_of(ev) do
    case ev["raw"] do
      raw when is_binary(raw) -> raw
      nil -> encode(ev)
      other -> encode(other)
    end
  end

  defp encode(nil), do: "{}"
  defp encode(value) when is_binary(value), do: value
  defp encode(value), do: Jason.encode!(value)

  defp string(nil), do: nil
  defp string(value) when is_binary(value), do: if(value == "", do: nil, else: value)
  defp string(value) when is_integer(value), do: Integer.to_string(value)
  defp string(_value), do: nil

  defp dig(event, key) when is_binary(key), do: string(Map.get(event, key))
  defp dig(event, [key]), do: dig(event, key)

  defp dig(event, [head | rest]) do
    case Map.get(event, head) do
      %{} = nested -> dig(nested, rest)
      _ -> nil
    end
  end

  # ── reading ──────────────────────────────────────────────────────────────

  defp select(where, order, limit) do
    """
    SELECT #{Enum.join(@columns, ", ")}
    FROM #{@table}
    #{where}
    ORDER BY #{order}
    LIMIT #{limit}
    """
  end

  defp limit(opts, default) do
    case Keyword.get(opts, :limit, default) do
      n when is_integer(n) and n > 0 -> min(n, @max_limit)
      _not_a_positive_integer -> default
    end
  end

  # `_` and `%` in a search term are literals to the person typing them. `!` is
  # the escape character rather than `\` because a backslash inside a SQL string
  # literal is only sometimes an escape, depending on the dialect's mood.
  defp escape_like(q), do: String.replace(q, ["!", "%", "_"], &("!" <> &1))

  defp rows(conn, sql, args) do
    with {:ok, ref} <- Duckdbex.query(conn, sql, args) do
      {:ok, ref |> Duckdbex.fetch_all() |> Enum.map(&to_row/1)}
    end
  end

  defp to_row(values) do
    @columns
    |> Enum.zip(values)
    |> Map.new(fn
      {"headers", value} -> {"headers", decode(value)}
      {key, value} -> {key, render(value)}
    end)
  end

  # Written as text (see @schema) and handed back as a map, so a caller never
  # decodes JSON out of a JSON response.
  defp decode(value) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, %{} = map} -> map
      _not_an_object -> %{}
    end
  end

  defp decode(_value), do: %{}

  defp render(value) when is_binary(value) or is_integer(value) or is_float(value), do: value
  defp render(nil), do: nil
  defp render(value), do: inspect(value)

  defp stored_count(%{conn: nil}), do: 0

  defp stored_count(state) do
    with {:ok, ref} <- Duckdbex.query(state.conn, "SELECT count(*) FROM #{@table}", []),
         [[n]] <- Duckdbex.fetch_all(ref) do
      n
    else
      _unreadable -> 0
    end
  end

  # ── opening ──────────────────────────────────────────────────────────────

  # ── retention ────────────────────────────────────────────────────────────

  defp schedule_prune, do: Process.send_after(self(), :prune, @prune_every_ms)

  # Whether the store is writable, readable WITHOUT a call.
  #
  # `stats/0` answers the same question but is a GenServer call with a 15s
  # timeout, and this store demonstrably blocks: one `search/2` over the raw
  # column ran past 15s and every call queued behind it timed out, `stats/0`
  # included. A health endpoint polled every few seconds must not be able to
  # hang on a slow query — least of all to report that the thing it is
  # querying is unhealthy.
  defp mark_open(open?), do: :persistent_term.put({__MODULE__, :open?}, open?)

  # Drop everything past the window, then reclaim the file if enough of it is
  # now dead.
  #
  # DELETE alone does NOT give the disk back. Measured on a copy of the live
  # store, DuckDB v1.5.5: 39,865 real rows occupied 348MB, deleting half left
  # it at 348MB, and CHECKPOINT and VACUUM changed nothing. The space is reused
  # by later inserts, so deleting DOES bound growth at roughly
  # `retention_days` worth — but a store that has already ballooned stays
  # ballooned, and the only way back is to rewrite the file.
  defp prune(%{conn: conn, path: path} = state) do
    case Connectix.Config.events_retention_days() do
      0 ->
        state

      days ->
        cutoff = System.system_time(:microsecond) - days * 86_400 * 1_000_000

        with {:ok, _} <- Duckdbex.query(conn, "DELETE FROM events WHERE create_date < ?", [cutoff]),
             {:ok, _} <- Duckdbex.query(conn, "CHECKPOINT") do
          Logger.info("events: pruned rows older than #{days}d")
          maybe_compact(state)
        else
          {:error, reason} ->
            Logger.warning("events: prune failed (#{inspect(reason)}) — #{path}")
            state
        end
    end
  end

  # Rewrite the file when most of it is dead space.
  #
  # `CREATE TABLE ... AS SELECT` into a freshly attached file writes only live
  # rows, so the copy is the size the data actually needs. Swapping it in means
  # closing the current handles, renaming, and reopening — which is why this is
  # here in the owning process and nowhere else.
  defp maybe_compact(%{conn: conn, path: path} = state) do
    with {:ok, live} <- live_bytes(conn),
         {:ok, %{size: on_disk}} <- File.stat(path),
         true <- on_disk > @compact_min_bytes and on_disk > live * @compact_ratio do
      compact(state, on_disk, live)
    else
      _no_need -> state
    end
  end

  defp compact(%{conn: conn, path: path} = state, on_disk, live) do
    tmp = path <> ".compacting"
    File.rm(tmp)
    File.rm(tmp <> ".wal")

    Logger.info(
      "events: compacting #{path} — #{div(on_disk, 1_048_576)}MB on disk for " <>
        "#{div(live, 1_048_576)}MB of rows"
    )

    with {:ok, _} <- Duckdbex.query(conn, "ATTACH '#{tmp}' AS compacted"),
         {:ok, _} <- Duckdbex.query(conn, "CREATE TABLE compacted.events AS SELECT * FROM events"),
         {:ok, _} <- Duckdbex.query(conn, "CHECKPOINT compacted"),
         {:ok, _} <- Duckdbex.query(conn, "DETACH compacted") do
      # Drop the handles before moving the file underneath them.
      state = %{state | db: nil, conn: nil}
      :erlang.garbage_collect()

      File.rm(path <> ".wal")

      case File.rename(tmp, path) do
        :ok ->
          case open(path) do
            {:ok, db, conn} ->
              size = with {:ok, %{size: s}} <- File.stat(path), do: s
              Logger.info("events: compacted to #{div(size, 1_048_576)}MB")
              %{state | db: db, conn: conn}

            {:error, reason} ->
              # The file is intact; the handle is not. The retry loop reopens.
              Logger.error("events: compacted but could not reopen (#{inspect(reason)}) — retrying")
              Process.send_after(self(), :retry_open, @reopen_after_ms)
              state
          end

        {:error, reason} ->
          Logger.error("events: could not swap compacted file (#{inspect(reason)})")
          File.rm(tmp)
          Process.send_after(self(), :retry_open, @reopen_after_ms)
          state
      end
    else
      {:error, reason} ->
        Logger.warning("events: compaction failed (#{inspect(reason)}) — keeping the file as is")
        Duckdbex.query(conn, "DETACH compacted")
        File.rm(tmp)
        state
    end
  end

  defp live_bytes(conn) do
    case Duckdbex.query(conn, "SELECT sum(length(raw) + length(headers) + 80) FROM events") do
      {:ok, ref} ->
        case Duckdbex.fetch_all(ref) do
          # DuckDB hands back a HUGEINT as {high, low}.
          [[{_high, low}]] -> {:ok, low}
          [[n]] when is_integer(n) -> {:ok, n}
          _ -> :error
        end

      _ ->
        :error
    end
  end

  defp open(path) do
    with :ok <- File.mkdir_p(Path.dirname(path)),
         {:ok, db} <- Duckdbex.open(path),
         {:ok, conn} <- Duckdbex.connection(db),
         :ok <- validate_schema(conn),
         {:ok, _} <- Duckdbex.query(conn, @schema, []) do
      {:ok, db, conn}
    else
      {:error, reason} -> {:error, reason}
      other -> {:error, other}
    end
  end

  # An existing file written by another column set would survive
  # `CREATE TABLE IF NOT EXISTS` and then fail every INSERT. Refuse to open it
  # rather than silently dropping audit history; migration/reset is an explicit
  # operator decision.
  defp validate_schema(conn) do
    with {:ok, ref} <-
           Duckdbex.query(
             conn,
             "SELECT column_name FROM information_schema.columns WHERE table_name = '#{@table}'",
             []
           ) do
      case Duckdbex.fetch_all(ref) do
        [] ->
          :ok

        found ->
          columns = List.flatten(found)

          if Enum.sort(columns) == Enum.sort(@columns) do
            :ok
          else
            {:error, {:schema_mismatch, columns}}
          end
      end
    end
  end

  defp default_path do
    dir = Connectix.Config.events_dir()
    Connectix.Config.events_db() || Path.join(dir, "events.duckdb")
  end
end
