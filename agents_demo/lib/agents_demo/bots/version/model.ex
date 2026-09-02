defmodule AgentsDemo.Bots.Version.Model do
  @moduledoc "Which model answers. Only a provider reference; credentials stay in the environment."
  @derive Jason.Encoder
  defstruct provider: "anthropic", name: nil, temperature: nil, thinking_budget_tokens: nil, max_output_tokens: nil

  @providers ~w(anthropic)
  @fields [:provider, :name, :temperature, :thinking_budget_tokens, :max_output_tokens]

  def providers, do: @providers

  def new(attrs \\ %{}) do
    m = AgentsDemo.Bots.Version.take(attrs, %__MODULE__{}, @fields)
    m = %{m | provider: m.provider || "anthropic"}

    errors =
      %{}
      |> AgentsDemo.Bots.Version.inclusion(:provider, m.provider, @providers)
      |> AgentsDemo.Bots.Version.range(:temperature, m.temperature, gte: 0, lte: 1)
      |> AgentsDemo.Bots.Version.range(:thinking_budget_tokens, m.thinking_budget_tokens, gte: 1024)
      |> AgentsDemo.Bots.Version.range(:max_output_tokens, m.max_output_tokens, gt: 0)

    AgentsDemo.Bots.Version.done(errors, struct(__MODULE__, m))
  end
end
