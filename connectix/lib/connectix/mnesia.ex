defmodule Connectix.Mnesia do
  @moduledoc """
  The one place Mnesia is set up and talked to — the replacement for Ecto/Repo.

  Everything the app persists lives in Mnesia now: no Postgres, no external
  database, no ORM. This module is the shared machinery the per-table stores
  (`Connectix.Accounts.Store`, `Bots.Store`, …) build on, so transaction
  boilerplate, table creation, and the record⇄map conversion are written once.

  ## Records are `{table, v1, v2, …}` in `attributes` order

  Mnesia stores tuples, not maps. A table declares its `attributes` (the field
  names, in order); a row is a tuple of the table name followed by those values.
  `to_record/3` and `to_map/2` convert between that tuple and a plain map so the
  rest of the app deals in maps and structs, never tuples.

  ## This app is STATELESS by default — `ram_copies`

  Persistence is opt-in, and only `MNESIA_DIR` opts in. Set it, and the tables
  are `disc_copies` in that directory and the node is named so they can be;
  unset, everything is RAM and dies with the process.

  That is not a downgrade, it is the truth being written down. On nimbus the
  portal has no mounted volume, so `disc_copies` were written to a path INSIDE
  the container and thrown away by the next deploy — paying for a named node, a
  disc schema and fsync to lose the data anyway. A store that is discarded on
  every deploy is a cache; calling it a database only means nobody is warned.

  Being RAM-only also removes two failures that were entirely self-inflicted:
  the named node made a second BEAM on the same box (`mix test` beside a running
  server) collide on `connectix@127.0.0.1`, and a disc schema on WSL is the
  documented hang. Neither happens to a node that never asks for a name.

  Mount a volume and set `MNESIA_DIR` to it when the data has to survive.
  """

  require Logger

  @doc """
  Bring Mnesia up: name the node, create the schema, start the engine.

  Call once at boot before any table is created. Idempotent — a second call
  finds everything already there.
  """
  def ensure_started do
    if :persistent_term.get({__MODULE__, :ready}, false) and
         :mnesia.system_info(:is_running) == :yes do
      :ok
    else
      ensure_named_node()
      # `:mnesia` is an OTP application dependency, so releases may have
      # started it before this application's supervision tree. Its directory
      # and disc schema can only be selected while it is stopped.
      :stopped = :mnesia.stop()
      set_dir()
      ensure_schema()
      start()
      # The shared integer-sequence table (replaces `bigserial`), created
      # directly — not via `ensure_table/2`, which calls back into here.
      seq_storage = storage_type()

      case :mnesia.create_table(:connectix_seq, [
             {:attributes, [:name, :value]},
             {:type, :set},
             {seq_storage, [node()]}
           ]) do
        {:atomic, :ok} -> :ok
        {:aborted, {:already_exists, _}} -> :ok
        {:aborted, reason} -> Logger.warning("mnesia: seq table — #{inspect(reason)}")
      end

      :ok = :mnesia.wait_for_tables([:connectix_seq], 10_000)
      :persistent_term.put({__MODULE__, :ready}, true)
      :ok
    end
  end

  @doc """
  Create a table if absent, replicate it across the cluster, then wait for it.

  `disc_copies` on a named node, `ram_copies` otherwise (tests, unnamed dev).
  When other BEAM nodes are already connected, the table is copied onto each of
  them too (`replicate/1`), so a cluster shares one consistent copy with no
  external database — Mnesia's native distribution, the OTP-idiomatic answer to
  "distributed". Single node → simply local disc storage.

  Bootstraps Mnesia (`ensure_started/0`) on first use, so any store's `init`
  can call this without an ordering dependency on a separate setup step.
  """
  def ensure_table(name, opts) do
    ensure_started()
    do_create(name, opts)
  end

  defp do_create(name, opts) do
    storage = storage_type()
    opts = Keyword.put(opts, storage, [node()])

    case :mnesia.create_table(name, opts) do
      {:atomic, :ok} -> :ok
      {:aborted, {:already_exists, ^name}} -> :ok
      {:aborted, reason} -> Logger.warning("mnesia: create_table #{name} — #{inspect(reason)}")
    end

    replicate(name)
    :ok = :mnesia.wait_for_tables([name], 10_000)
  end

  @doc """
  Add a `disc_copies` replica of `table` on every connected node that does not
  already hold one. Idempotent and best-effort — a node that cannot take a copy
  is logged, not fatal. No-op on a single node.
  """
  def replicate(table) do
    if storage_type() == :disc_copies do
      have = :mnesia.table_info(table, :disc_copies)

      for peer <- Node.list(), peer not in have do
        case :mnesia.add_table_copy(table, peer, :disc_copies) do
          {:atomic, :ok} ->
            Logger.info("mnesia: replicated #{table} to #{peer}")

          {:aborted, {:already_exists, _, _}} ->
            :ok

          {:aborted, reason} ->
            Logger.warning("mnesia: replicate #{table}→#{peer} — #{inspect(reason)}")
        end
      end
    end

    :ok
  end

  @doc "Run `fun` in a transaction, returning its value (raises on abort)."
  def transaction!(fun) do
    {:atomic, result} = :mnesia.transaction(fun)
    result
  end

  @doc """
  Run `fun` in a transaction. `:mnesia.abort(reason)` inside becomes
  `{:error, reason}`; anything else returned becomes `{:ok, value}`.
  """
  def transaction(fun) do
    case :mnesia.transaction(fun) do
      {:atomic, value} -> {:ok, value}
      {:aborted, reason} -> {:error, reason}
    end
  end

  @doc "Read one row by key inside a transaction, as a map (or nil)."
  def get(table, fields, key) do
    transaction!(fn -> read(table, fields, key) end)
  end

  @doc "Read one row by key — call INSIDE a transaction. Returns a map or nil."
  def read(table, fields, key) do
    case :mnesia.read(table, key) do
      [row] -> to_map(row, fields)
      [] -> nil
    end
  end

  @doc "Every row of a table as maps — call inside a transaction."
  def all(table, fields) do
    pattern = List.to_tuple([table | List.duplicate(:_, length(fields))])

    :mnesia.match_object(pattern)
    |> Enum.map(&to_map(&1, fields))
  end

  @doc "Rows whose `index` column equals `value` — call inside a transaction."
  def index_read(table, fields, value, index) do
    :mnesia.index_read(table, value, index)
    |> Enum.map(&to_map(&1, fields))
  end

  @doc "Write a map as a row — call inside a transaction. Returns the map."
  def write(table, fields, map) do
    :mnesia.write(to_record(table, fields, map))
    map
  end

  @doc "Delete by key — call inside a transaction."
  def delete(table, key), do: :mnesia.delete({table, key})

  @doc "Next value of a per-table integer sequence (for `:id`-style keys)."
  def next_id(table) do
    :mnesia.dirty_update_counter(:connectix_seq, table, 1)
  end

  @doc """
  A random v4 UUID string — replaces `Ecto.UUID.generate/0` for `:binary_id`
  keys now that Ecto is gone. Same canonical `8-4-4-4-12` hex form the API and
  the clients already expect.
  """
  def uuid do
    <<a::32, b::16, c::16, d::16, e::48>> = :crypto.strong_rand_bytes(16)
    # Set the version (4) and variant (10xx) bits, per RFC 4122.
    c = Bitwise.bor(Bitwise.band(c, 0x0FFF), 0x4000)
    d = Bitwise.bor(Bitwise.band(d, 0x3FFF), 0x8000)

    :io_lib.format(~c"~8.16.0b-~4.16.0b-~4.16.0b-~4.16.0b-~12.16.0b", [a, b, c, d, e])
    |> List.to_string()
  end

  # ── record ⇄ map ───────────────────────────────────────────────────────────

  def to_record(table, fields, map),
    do: List.to_tuple([table | Enum.map(fields, &Map.get(map, &1))])

  def to_map(row, fields) do
    values = row |> Tuple.to_list() |> tl()
    fields |> Enum.zip(values) |> Map.new()
  end

  # ── setup internals ──────────────────────────────────────────────────────

  # Whether this deployment asked to persist at all. Only an explicit MNESIA_DIR
  # counts: `Config.mnesia_dir/0` always returns a path (it defaults under the
  # data dir), so asking it cannot distinguish "configured" from "defaulted" —
  # and that difference is exactly what decides between a database and a cache.
  # The test clause is not a nicety. `MNESIA_DIR` is set on the container, so
  # `MIX_ENV=test` in that same container would otherwise adopt the SAME disc
  # schema the dev server is using — and the suite's own setup calls
  # `reset_domain_for_test!/0`, which clears conversations, users and the id
  # sequence. Running the tests would silently destroy the developer's data,
  # and did: conversations vanished and duplicate operator users accumulated
  # while a test run happened to be in flight. Tests always get RAM-only.
  defp persist?, do: Connectix.Config.env("MNESIA_DIR") != nil and not Connectix.Config.test?()

  defp storage_type do
    cond do
      not persist?() ->
        :ram_copies

      node() == :nonode@nohost ->
        :ram_copies

      :mnesia.system_info(:use_dir) ->
        :disc_copies

      true ->
        Logger.warning(
          "mnesia: no disc schema at #{:mnesia.system_info(:directory)} — tables are RAM-only"
        )

        :ram_copies
    end
  end

  # ALWAYS, and not because of Mnesia — `set_dir` decides storage now, and a
  # RAM-only node needs no name for it.
  #
  # The name is what makes the running system reachable: `--rpc-eval` and
  # `--remsh` need one, and they are how anyone asks a live portal which
  # streams it confirmed or how many events it has stored. Dropping it made the
  # node stateless and unobservable in the same stroke, which traded a real
  # problem for a worse one.
  #
  # A second BEAM wanting the same name — `mix test` beside a running server —
  # is handled by failing to name and carrying on: that path is only dangerous
  # when it also shares a disc schema, and it no longer can.
  defp ensure_named_node do
    if node() == :nonode@nohost do
      # A stable loopback longname avoids hostname/IPv6 resolver drift (notably
      # on WSL) while still giving Mnesia the named node disc_copies requires.
      case Node.start(:"connectix@127.0.0.1", :longnames) do
        {:ok, _} ->
          Logger.info("mnesia: named node #{node()}")

        {:error, reason} ->
          Logger.warning("mnesia: node not named (#{inspect(reason)}) — RAM-only")
      end
    end
  end

  # ONLY when persisting, and the "only" is load-bearing. Pointing Mnesia at a
  # directory makes it adopt whatever schema is already there — and a box that
  # ran an earlier build has one, written by the named node
  # `connectix@127.0.0.1`. A RAM-only node is `nonode@nohost`, so that schema
  # names a node it is not: Mnesia loads it, cannot load the tables it lists,
  # and `wait_for_tables` times out. The app then refuses to boot over data it
  # was never going to use.
  #
  # Left unset, Mnesia keeps its schema in RAM and a stale directory on disk is
  # simply ignored.
  defp set_dir do
    if persist?() do
      dir = Connectix.Config.mnesia_dir()
      File.mkdir_p!(dir)
      Application.put_env(:mnesia, :dir, String.to_charlist(dir))

      # How much an ungraceful stop is allowed to cost. Mnesia folds
      # `LATEST.LOG` into the tables every 1000 writes or 3 minutes by default,
      # and anything since the last fold dies with the VM.
      #
      # `Connectix.Drain` flushes on a graceful shutdown, which covers the
      # release. It does NOT cover dev: `mix phx.server` does not turn SIGTERM
      # into an OTP shutdown, so no `terminate/2` runs and `docker compose
      # restart` simply kills the node. These thresholds are what actually
      # protects a developer's data — at most 10 writes or 5 seconds of it.
      # Cheap here because this is a low-write store; the tables holding real
      # volume are DuckDB's, not Mnesia's.
      Application.put_env(:mnesia, :dump_log_write_threshold, 10)
      Application.put_env(:mnesia, :dump_log_time_threshold, :timer.seconds(5))
    end
  end

  defp ensure_schema do
    if node() != :nonode@nohost do
      case :mnesia.create_schema([node()]) do
        :ok -> :ok
        {:error, {_, {:already_exists, _}}} -> :ok
        {:error, reason} -> Logger.warning("mnesia: create_schema — #{inspect(reason)}")
      end
    end
  end

  defp start do
    case :mnesia.start() do
      :ok -> :ok
      {:error, {:already_started, _}} -> :ok
    end
  end

  @doc "Clear the named tables. Intended for deterministic test setup."
  def clear_tables!(tables) when is_list(tables) do
    Enum.each(tables, fn table ->
      case :mnesia.clear_table(table) do
        {:atomic, :ok} -> :ok
        {:aborted, {:no_exists, ^table}} -> :ok
        {:aborted, reason} -> raise "could not clear Mnesia table #{table}: #{inspect(reason)}"
      end
    end)

    :ok
  end

  @doc false
  def reset_domain_for_test! do
    clear_tables!([
      :users_tokens,
      :sagents_display_messages,
      :sagents_agent_states,
      :sagents_conversations,
      :bot_versions,
      :bots,
      :users,
      :connectix_seq
    ])
  end
end
