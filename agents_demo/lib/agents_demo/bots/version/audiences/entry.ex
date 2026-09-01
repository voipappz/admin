defmodule AgentsDemo.Bots.Version.Audiences.Entry do
  @moduledoc false

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :phone, :string
    field :audience_id, :string
    field :name, :string
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:phone, :audience_id, :name])
    |> validate_required([:phone, :audience_id])
    |> validate_format(:phone, ~r/^\+?[0-9][0-9 \-]{5,}$/, message: "must be a phone number")
    |> validate_format(:audience_id, ~r/^[a-z][a-z0-9_]*$/)
  end
end
