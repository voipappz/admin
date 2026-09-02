defmodule AgentsDemo.Bots.Version.Limits do
  @moduledoc "Operational ceilings. `max_runs` bounds model calls per turn."
  @derive Jason.Encoder
  defstruct max_runs: 10, tool_timeout_ms: 30_000, session_idle_timeout_seconds: nil,
            max_session_seconds: nil, token_budget: nil

  @fields [:max_runs, :tool_timeout_ms, :session_idle_timeout_seconds, :max_session_seconds, :token_budget]

  def new(attrs \\ %{}) do
    m = AgentsDemo.Bots.Version.take(attrs, %__MODULE__{}, @fields)
    m = %{m | max_runs: m.max_runs || 10, tool_timeout_ms: m.tool_timeout_ms || 30_000}

    errors =
      %{}
      |> AgentsDemo.Bots.Version.range(:max_runs, m.max_runs, gt: 0, lte: 50)
      |> AgentsDemo.Bots.Version.range(:tool_timeout_ms, m.tool_timeout_ms, gt: 0)
      |> AgentsDemo.Bots.Version.range(:session_idle_timeout_seconds, m.session_idle_timeout_seconds, gt: 0)
      |> AgentsDemo.Bots.Version.range(:max_session_seconds, m.max_session_seconds, gt: 0)
      |> AgentsDemo.Bots.Version.range(:token_budget, m.token_budget, gt: 0)

    AgentsDemo.Bots.Version.done(errors, struct(__MODULE__, m))
  end
end
