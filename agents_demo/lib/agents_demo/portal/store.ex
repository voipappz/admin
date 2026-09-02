defmodule AgentsDemo.Portal.Store do
  @moduledoc """
  The portal's own persistent state, in Mnesia — no Ecto, no external database.

  This is what replaces Postgres for the portal. Mnesia ships inside the BEAM,
  so there is nothing to run beside the app: the data is a set of files under
  `MNESIA_DIR`, created on first boot and read back on every one after.

  ## Why a GenServer

  The setup — creating the schema, the tables, and the seed row — must run once,
  before anything serves a request, and must be idempotent across restarts. A
  supervised process whose `init/1` does that work is the simplest thing that
  gives both: the supervisor will not start the endpoint's siblings until this
  returns, and a second boot finds the tables already there and moves on.

  ## The node-name catch

  Mnesia's `disc_copies` — the on-disk tables that make this persistent — refuse
  to be created on `:nonode@nohost`. A `mix phx.server` in a container is exactly
  that unless told otherwise, so this names the node itself on the way up. A
  release already runs named, so there the branch is skipped. Without this the
  tables fall back to `ram_copies` and the portal quietly loses its dashboards on
  restart — which reads as "my boards vanished", not "the node was unnamed".
  """

  use GenServer

  require Logger

  @dashboards :portal_dashboards
  @widgets :portal_widgets

  # {uuid, name, position, updated_at}
  @dashboard_fields [:uuid, :name, :position, :updated_at]
  # {uuid, dashboard_uuid, definition, position, updated_at}
  @widget_fields [:uuid, :dashboard_uuid, :definition, :position, :updated_at]

  @default "default"

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(_opts) do
    ensure_named_node()
    set_dir()
    ensure_schema()
    :ok = start_mnesia()
    ensure_tables()
    :ok = :mnesia.wait_for_tables([@dashboards, @widgets], 10_000)
    seed_default()
    Logger.info("portal store: Mnesia ready (dir=#{:mnesia.system_info(:directory)})")
    {:ok, %{}}
  end

  # ── Dashboards ─────────────────────────────────────────────────────────────

  def list_dashboards do
    read(fn ->
      @dashboards
      |> match_all(@dashboard_fields)
      |> Enum.map(&to_dashboard/1)
      |> Enum.sort_by(&{&1.position, &1.name, &1.uuid})
    end)
  end

  def get_dashboard(uuid), do: read(fn -> one(@dashboards, uuid, @dashboard_fields, &to_dashboard/1) end)

  def create_dashboard(name) do
    row =
      %{
        uuid: uuid(),
        name: name,
        position: count(@dashboards),
        updated_at: now()
      }

    write(fn -> put(@dashboards, @dashboard_fields, row) end, to_dashboard(record(@dashboard_fields, row)))
  end

  def rename_dashboard(%{uuid: uuid, position: position}, name) do
    row = %{uuid: uuid, name: name, position: position, updated_at: now()}
    write(fn -> put(@dashboards, @dashboard_fields, row) end, to_dashboard(record(@dashboard_fields, row)))
  end

  @doc """
  Delete a board and its widgets in one transaction.

  The seeded `default` board is permanent — widgets default to it, so a widget
  created after it was gone would point at nothing. Callers get
  `{:error, :permanent}`, matching the Postgres context this replaces.
  """
  def delete_dashboard(@default), do: {:error, :permanent}

  def delete_dashboard(uuid) do
    :mnesia.transaction(fn ->
      case :mnesia.read(@dashboards, uuid) do
        [] ->
          :mnesia.abort(:not_found)

        [_row] ->
          # Widgets of this board, by the secondary index, deleted with it.
          @widgets
          |> :mnesia.index_read(uuid, :dashboard_uuid)
          |> Enum.each(fn w -> :mnesia.delete({@widgets, elem(w, 1)}) end)

          :mnesia.delete({@dashboards, uuid})
          :ok
      end
    end)
    |> case do
      {:atomic, :ok} -> {:ok, uuid}
      {:aborted, :not_found} -> {:error, :not_found}
      {:aborted, reason} -> {:error, reason}
    end
  end

  # ── Widgets ──────────────────────────────────────────────────────────────

  def list_widgets(dashboard_uuid \\ @default) do
    read(fn ->
      @widgets
      |> :mnesia.index_read(dashboard_uuid, :dashboard_uuid)
      |> Enum.map(&to_widget(&1, @widget_fields))
      |> Enum.sort_by(&{&1.position, &1.uuid})
    end)
  end

  def get_widget(uuid), do: read(fn -> one(@widgets, uuid, @widget_fields, &to_widget_struct/1) end)

  def create_widget(attrs, dashboard_uuid \\ @default) do
    attrs = stringify(attrs)

    row = %{
      uuid: uuid(),
      dashboard_uuid: field(attrs, "dashboard_uuid") || dashboard_uuid,
      position: field(attrs, "position") || default_position(),
      definition:
        Map.merge(%{"title" => "", "type" => "counter", "metric" => "total"}, definition_of(attrs)),
      updated_at: now()
    }

    write(fn -> put(@widgets, @widget_fields, row) end, to_widget_struct(row))
  end

  def update_widget(%{uuid: uuid, definition: definition, dashboard_uuid: dash, position: pos}, attrs) do
    attrs = stringify(attrs)

    row = %{
      uuid: uuid,
      dashboard_uuid: field(attrs, "dashboard_uuid") || dash,
      position: field(attrs, "position") || pos,
      definition: Map.merge(definition, definition_of(attrs)),
      updated_at: now()
    }

    write(fn -> put(@widgets, @widget_fields, row) end, to_widget_struct(row))
  end

  def delete_widget(uuid) do
    :mnesia.transaction(fn ->
      case :mnesia.read(@widgets, uuid) do
        [] -> :mnesia.abort(:not_found)
        [_] -> :mnesia.delete({@widgets, uuid})
      end
    end)
    |> case do
      {:atomic, :ok} -> {:ok, uuid}
      {:aborted, :not_found} -> {:error, :not_found}
      {:aborted, reason} -> {:error, reason}
    end
  end

  # ── Setup ────────────────────────────────────────────────────────────────

  # 127.0.0.1 AND LONGNAMES, not the hostname and :shortnames.
  #
  # Mnesia's schema is bound to the node name, so the name only has to be
  # stable and resolvable — it never has to be reachable by anyone else. This
  # is one node holding its own tables on disc, not a cluster.
  #
  # The hostname is neither reliable nor harmless. On a WSL host it resolves to
  # IPv6 LINK-LOCAL addresses ahead of 127.0.1.1:
  #
  #     $ getent hosts LT-7G19VF4
  #     fe80::96d:da56:f663:179    LT-7G19VF4
  #     …
  #
  # `Node.start/2` still answers {:ok, _} there — distribution "starts" — and
  # then `:mnesia.create_schema/1` blocks forever on a name that cannot be used.
  # The endpoint is never reached, because this store is started before it, so
  # the whole origin is gone: no login, no /ws/events, no SPA. And the only
  # trace is this function's own success line, which makes the naming step look
  # like the thing that WORKED.
  #
  # A loopback longname sidesteps the host's resolver entirely and cannot
  # change under the node between restarts, which a DHCP-renamed host can.
  defp ensure_named_node do
    if node() == :nonode@nohost do
      case Node.start(:"agents_demo@127.0.0.1", :longnames) do
        {:ok, _} ->
          Logger.info("portal store: named node #{node()} for disc persistence")

        {:error, reason} ->
          Logger.warning(
            "portal store: could not name node (#{inspect(reason)}) — Mnesia will be RAM-only"
          )
      end
    end
  end

  defp set_dir do
    dir = System.get_env("MNESIA_DIR") || Path.join(:code.priv_dir(:agents_demo), "mnesia")
    File.mkdir_p!(dir)
    Application.put_env(:mnesia, :dir, String.to_charlist(dir))
  end

  defp ensure_schema do
    # Only disc nodes get a schema; a RAM-only node (unnamed) runs schemaless.
    if node() != :nonode@nohost do
      # STOP FIRST. `create_schema/1` refuses while Mnesia is running, and this
      # GenServer can be started more than once in one BEAM — a crash here is
      # restarted by the supervisor, and the second attempt would find Mnesia
      # already up from the first with a RAM schema it cannot replace. Every
      # later `create_table(..., disc_copies)` then blocks forever inside
      # `mnesia_schema:schema_transaction/1` waiting for a disc-capable node
      # that does not exist. Stopping is a no-op on the first pass.
      :mnesia.stop()

      case :mnesia.create_schema([node()]) do
        :ok -> :ok
        {:error, {_, {:already_exists, _}}} -> :ok
        {:error, reason} -> Logger.warning("portal store: create_schema — #{inspect(reason)}")
      end
    end
  end

  defp start_mnesia do
    case :mnesia.start() do
      :ok -> :ok
      {:error, {:already_started, _}} -> :ok
    end
  end

  defp ensure_tables do
    # ASK MNESIA, do not infer from the node name. A named node is necessary for
    # a disc schema and not sufficient: if `create_schema/1` did not take — a
    # read-only directory, a half-started run, a dir set after Mnesia was
    # already up — Mnesia runs schemaless and `use_dir` is false.
    #
    # Creating a `disc_copies` table in that state does not fail. It HANGS, in
    # `mnesia_schema:schema_transaction/1`, and since this store is started
    # before the endpoint the whole origin never comes up: no login, no
    # /ws/events, no SPA, and the last log line is the one saying the node was
    # named successfully. Degrading to RAM keeps the portal serving and says so
    # once, which is a failure someone can actually see and act on.
    copies =
      cond do
        node() == :nonode@nohost -> :ram_copies
        :mnesia.system_info(:use_dir) -> :disc_copies
        true ->
          Logger.warning(
            "portal store: Mnesia has no disc schema (dir=#{:mnesia.system_info(:directory)}) " <>
              "— tables are RAM-ONLY and dashboards will not survive a restart"
          )

          :ram_copies
      end

    create_table(@dashboards, attributes: @dashboard_fields, type: :set, storage: copies)

    create_table(@widgets,
      attributes: @widget_fields,
      type: :set,
      storage: copies,
      index: [:dashboard_uuid]
    )
  end

  defp create_table(name, opts) do
    {storage, opts} = Keyword.pop!(opts, :storage)
    opts = Keyword.put(opts, storage, [node()])

    case :mnesia.create_table(name, opts) do
      {:atomic, :ok} -> :ok
      {:aborted, {:already_exists, ^name}} -> :ok
      {:aborted, reason} -> Logger.warning("portal store: create_table #{name} — #{inspect(reason)}")
    end
  end

  defp seed_default do
    :mnesia.transaction(fn ->
      case :mnesia.read(@dashboards, @default) do
        [] ->
          put(@dashboards, @dashboard_fields, %{
            uuid: @default,
            name: "Main dashboard",
            position: 0,
            updated_at: now()
          })

        [_] ->
          :ok
      end
    end)
  end

  # ── Mnesia helpers ─────────────────────────────────────────────────────────

  defp read(fun) do
    {:atomic, result} = :mnesia.transaction(fun)
    result
  end

  defp write(fun, built) do
    case :mnesia.transaction(fun) do
      {:atomic, _} -> {:ok, built}
      {:aborted, reason} -> {:error, reason}
    end
  end

  # A record is `{table, v1, v2, ...}` in `attributes` order.
  defp put(table, fields, map), do: :mnesia.write(record(table, fields, map))

  defp record(fields, map), do: record(:row, fields, map)
  defp record(table, fields, map), do: List.to_tuple([table | Enum.map(fields, &Map.fetch!(map, &1))])

  defp one(table, key, fields, to_struct) do
    case :mnesia.read(table, key) do
      [row] -> to_struct.(row_to_map(row, fields) |> tag(fields))
      [] -> nil
    end
  end

  defp match_all(table, fields) do
    pattern = List.to_tuple([table | List.duplicate(:_, length(fields))])
    :mnesia.match_object(pattern)
  end

  # {table, v1, v2, ...} → %{field => value}
  defp row_to_map(row, fields) do
    values = row |> Tuple.to_list() |> tl()
    fields |> Enum.zip(values) |> Map.new()
  end

  defp tag(map, _fields), do: map

  # ── Struct shaping ─────────────────────────────────────────────────────────

  defp to_dashboard(%AgentsDemo.Dashboards.Dashboard{} = d), do: d
  defp to_dashboard(row) when is_tuple(row), do: to_dashboard(row_to_map(row, @dashboard_fields))
  defp to_dashboard(%{} = m), do: struct(AgentsDemo.Dashboards.Dashboard, m)

  defp to_widget(row, fields) when is_tuple(row), do: to_widget_struct(row_to_map(row, fields))
  defp to_widget_struct(%{} = m), do: struct(AgentsDemo.Dashboards.Widget, m)

  # ── Value helpers ──────────────────────────────────────────────────────────

  defp uuid, do: Ecto.UUID.generate()
  defp now, do: DateTime.utc_now()
  defp count(table), do: :mnesia.table_info(table, :size)
  defp default_position, do: System.system_time(:millisecond) |> rem(1_000_000)

  defp definition_of(attrs),
    do: attrs |> stringify() |> Map.drop(["uuid", "dashboard_uuid", "position"])

  defp field(attrs, key), do: Map.get(attrs, key)

  defp stringify(attrs), do: Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
end
