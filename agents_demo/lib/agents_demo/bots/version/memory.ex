defmodule AgentsDemo.Bots.Version.Memory do
  @moduledoc "What the bot may remember across conversations."
  @derive Jason.Encoder
  defstruct files_enabled: false, retention_days: nil

  @fields [:files_enabled, :retention_days]

  def new(attrs \\ %{}) do
    m = AgentsDemo.Bots.Version.take(attrs, %__MODULE__{}, @fields)
    errors = AgentsDemo.Bots.Version.range(%{}, :retention_days, m.retention_days, gt: 0)
    AgentsDemo.Bots.Version.done(errors, struct(__MODULE__, m))
  end
end
