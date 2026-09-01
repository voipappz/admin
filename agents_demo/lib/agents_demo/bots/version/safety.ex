defmodule AgentsDemo.Bots.Version.Safety do
  @moduledoc """
  Deterministic policy: which tools pause for a human, which are never
  offered, and what data classes the bot may handle.

  These are enforced by controls and the compiler, never by instructions. A
  tool listed in `forbidden_tools` is removed before the model sees it; a
  tool listed in `interrupt_on` runs only after an approval decision.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :interrupt_on, {:array, :string}, default: []
    field :forbidden_tools, {:array, :string}, default: []
    field :data_classes, {:array, :string}, default: []
  end

  def changeset(safety, attrs) do
    safety
    |> cast(attrs, [:interrupt_on, :forbidden_tools, :data_classes])
  end
end
