defmodule AgentsDemo.Dashboards.Widget do
  @moduledoc """
  One widget definition on a board.

  Everything but the four indexed columns lives in `definition`, a jsonb blob.
  That is deliberate and carried over from the store this replaces: a widget
  gains fields as the builder grows chart types, and a column per field would
  make every such addition a migration and a deploy.

  A definition says only WHAT to show. The values come from the event
  projection, which is why nothing here validates a `metric` against a list —
  the reader owns that vocabulary, and a widget naming a metric that does not
  exist yet must survive being saved.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:uuid, :string, autogenerate: false}
  schema "portal_dashboard_widgets" do
    field :definition, :map, default: %{}
    field :position, :integer, default: 0
    field :dashboard_uuid, :string, default: "default"
    field :updated_at, :utc_datetime_usec
  end

  def changeset(widget, attrs) do
    widget
    |> cast(attrs, [:uuid, :definition, :position, :dashboard_uuid])
    |> validate_required([:uuid, :dashboard_uuid])
    |> put_change(:updated_at, DateTime.utc_now())
  end

  @doc """
  The wire shape: the definition flattened back up, with the columns on top.

  The client reads `uuid`, `position` and `dashboard_uuid` as ordinary widget
  fields — they are columns here only because they are indexed or ordered on.
  Putting them last means a stale copy inside `definition` can never win.
  """
  def to_wire(%__MODULE__{} = widget) do
    widget.definition
    |> Map.merge(%{
      "uuid" => widget.uuid,
      "dashboard_uuid" => widget.dashboard_uuid,
      "position" => widget.position
    })
  end
end
