defmodule AgentsDemo.Conversations.FlowState do
  @moduledoc """
  Where a conversation is inside a deterministic flow: the current state
  name, the variables collected so far, and when the state was entered.
  Bounded and owned here; a flow engine reads and replaces it whole.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :state, :string
    field :vars, :map, default: %{}
    field :entered_at, :utc_datetime_usec
  end

  def changeset(flow_state, attrs) do
    flow_state
    |> cast(attrs, [:state, :vars, :entered_at])
    |> validate_required([:state])
  end
end
