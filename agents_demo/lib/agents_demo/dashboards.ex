defmodule AgentsDemo.Dashboards do
  @moduledoc """
  Boards and their widget definitions — the dashboard builder's storage.

  Ported from the Deno BFF's DuckDB store (`api/event_store.ts`) when that
  service was retired. Postgres rather than DuckDB because it is already a
  dependency and already deployed beside this app; these are ordinary indexed
  lookups over a small table, not the column scans DuckDB exists for.

  **This is configuration, not events.** A widget definition says what to show;
  the values it shows come from the event projection, which has not moved yet.
  So a board can be built and saved here while its widgets render empty — the
  two halves are deliberately independent, and that is what made this half
  portable on its own.
  """

  import Ecto.Query, warn: false

  alias AgentsDemo.Dashboards.{Dashboard, Widget}
  alias AgentsDemo.Repo

  @default_dashboard "default"

  @doc "Every board, in builder order."
  def list_dashboards do
    Repo.all(from d in Dashboard, order_by: [asc: d.position, asc: d.name, asc: d.uuid])
  end

  def get_dashboard(uuid), do: Repo.get(Dashboard, uuid)

  @doc """
  Create a board. Its position is the current count, so a new board lands last.
  """
  def create_dashboard(name) do
    %Dashboard{}
    |> Dashboard.changeset(%{
      uuid: Ecto.UUID.generate(),
      name: name,
      position: Repo.aggregate(Dashboard, :count, :uuid)
    })
    |> Repo.insert()
  end

  @doc "Rename a board, keeping its position."
  def rename_dashboard(%Dashboard{} = dashboard, name) do
    dashboard
    |> Dashboard.changeset(%{name: name})
    |> Repo.update()
  end

  @doc """
  Delete a board and everything on it.

  The seeded `default` board is permanent — the widget table's `dashboard_uuid`
  defaults to it, so a widget created after it was deleted would point at
  nothing. Callers get `{:error, :permanent}` rather than a silent no-op.
  """
  def delete_dashboard(@default_dashboard), do: {:error, :permanent}

  def delete_dashboard(uuid) do
    case get_dashboard(uuid) do
      nil ->
        {:error, :not_found}

      dashboard ->
        # One transaction: a board that loses its widgets but survives the
        # delete leaves rows nothing can reach or clean up.
        Repo.transaction(fn ->
          Repo.delete_all(from w in Widget, where: w.dashboard_uuid == ^uuid)
          Repo.delete!(dashboard)
          :ok
        end)
    end
  end

  @doc "One board's widgets, in display order."
  def list_widgets(dashboard_uuid \\ @default_dashboard) do
    Repo.all(
      from w in Widget,
        where: w.dashboard_uuid == ^dashboard_uuid,
        order_by: [asc: w.position, asc: w.uuid]
    )
  end

  def get_widget(uuid), do: Repo.get(Widget, uuid)

  @doc """
  Create a widget from the client's flat body.

  Defaults match the store this replaces: a widget saved with an empty body is
  a `counter` on `total`, which is what the builder's "add widget" button sends
  before anything is configured.
  """
  def create_widget(attrs, dashboard_uuid \\ @default_dashboard) do
    %Widget{}
    |> Widget.changeset(split(attrs, Ecto.UUID.generate(), dashboard_uuid, default_position()))
    |> Repo.insert()
  end

  @doc """
  Patch a widget.

  A merge, not a replace: the builder sends only the field it changed, and
  replacing the definition would silently drop everything else on the widget.
  """
  def update_widget(%Widget{} = widget, attrs) do
    merged = Map.merge(widget.definition, definition_of(attrs))

    widget
    |> Widget.changeset(%{
      definition: merged,
      position: field(attrs, "position") || widget.position,
      dashboard_uuid: field(attrs, "dashboard_uuid") || widget.dashboard_uuid
    })
    |> Repo.update()
  end

  def delete_widget(uuid) do
    case get_widget(uuid) do
      nil -> {:error, :not_found}
      widget -> Repo.delete(widget)
    end
  end

  # Position is only an ordering hint and the client usually omits it, so a new
  # widget gets a monotonic-enough value that lands it after the existing ones.
  defp default_position, do: System.system_time(:millisecond) |> rem(1_000_000)

  # The client sends one flat object. The columns come off the top; whatever is
  # left is the definition.
  defp split(attrs, uuid, dashboard_uuid, position) do
    %{
      uuid: uuid,
      dashboard_uuid: field(attrs, "dashboard_uuid") || dashboard_uuid,
      position: field(attrs, "position") || position,
      definition: Map.merge(%{"title" => "", "type" => "counter", "metric" => "total"}, definition_of(attrs))
    }
  end

  defp definition_of(attrs),
    do: attrs |> stringify() |> Map.drop(["uuid", "dashboard_uuid", "position"])

  defp field(attrs, key), do: attrs |> stringify() |> Map.get(key)

  defp stringify(attrs) do
    Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
  end
end
