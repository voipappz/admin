defmodule AgentsDemo.Bots.Version.Safety do
  @moduledoc "Deterministic policy: tools that pause for approval, tools never offered, data classes."
  @derive Jason.Encoder
  defstruct interrupt_on: [], forbidden_tools: [], data_classes: []

  @fields [:interrupt_on, :forbidden_tools, :data_classes]

  def new(attrs \\ %{}) do
    m = AgentsDemo.Bots.Version.take(attrs, %__MODULE__{}, @fields)
    m = Map.new(m, fn {k, v} -> {k, v || []} end)
    {:ok, struct(__MODULE__, m)}
  end
end
