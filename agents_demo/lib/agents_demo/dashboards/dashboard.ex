defmodule AgentsDemo.Dashboards.Dashboard do
  @moduledoc """
  A named board the builder groups widgets under.

  String primary keys, not `:binary_id`: the uuids are minted by whoever creates
  the row and the seeded board's id is the literal `"default"`, which is not a
  UUID and never was. Typing the column as `uuid` would make that row
  unrepresentable and every widget's `dashboard_uuid` default invalid.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:uuid, :string, autogenerate: false}
  @derive {Jason.Encoder, only: [:uuid, :name, :position]}
  schema "portal_dashboards" do
    field :name, :string
    field :position, :integer, default: 0
    field :updated_at, :utc_datetime_usec
  end

  def changeset(dashboard, attrs) do
    dashboard
    |> cast(attrs, [:uuid, :name, :position])
    |> update_change(:name, &String.trim/1)
    |> validate_required([:uuid, :name])
    |> validate_length(:name, min: 1, max: 200)
    |> put_change(:updated_at, DateTime.utc_now())
  end
end
