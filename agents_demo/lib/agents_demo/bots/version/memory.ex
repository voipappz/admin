defmodule AgentsDemo.Bots.Version.Memory do
  @moduledoc """
  What the bot may remember across conversations.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :files_enabled, :boolean, default: false
    field :retention_days, :integer
  end

  def changeset(memory, attrs) do
    memory
    |> cast(attrs, [:files_enabled, :retention_days])
    |> validate_number(:retention_days, greater_than: 0)
  end
end
