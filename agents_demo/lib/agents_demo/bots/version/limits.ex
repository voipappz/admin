defmodule AgentsDemo.Bots.Version.Limits do
  @moduledoc """
  Operational ceilings. `max_runs` bounds model calls per turn;
  `session_idle_timeout_seconds` is how long a thread may sit silent before a
  deterministic flow restarts from its entry.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :max_runs, :integer, default: 10
    field :tool_timeout_ms, :integer, default: 30_000
    field :session_idle_timeout_seconds, :integer
    field :max_session_seconds, :integer
    field :token_budget, :integer
  end

  def changeset(limits, attrs) do
    limits
    |> cast(attrs, [
      :max_runs,
      :tool_timeout_ms,
      :session_idle_timeout_seconds,
      :max_session_seconds,
      :token_budget
    ])
    |> validate_number(:max_runs, greater_than: 0, less_than_or_equal_to: 50)
    |> validate_number(:tool_timeout_ms, greater_than: 0)
    |> validate_number(:session_idle_timeout_seconds, greater_than: 0)
    |> validate_number(:max_session_seconds, greater_than: 0)
    |> validate_number(:token_budget, greater_than: 0)
  end
end
