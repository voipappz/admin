defmodule AgentsDemo.Bots.Version.Model do
  @moduledoc """
  Which model answers, and how it is asked.

  Only a provider *reference* lives here. Credentials are runtime environment
  (`AgentsDemo.Config`), never bot data. A nil `name` means the deployment's
  default model.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @providers ~w(anthropic)

  @primary_key false
  embedded_schema do
    field :provider, :string, default: "anthropic"
    field :name, :string
    field :temperature, :float
    field :thinking_budget_tokens, :integer
    field :max_output_tokens, :integer
  end

  def providers, do: @providers

  def changeset(model, attrs) do
    model
    |> cast(attrs, [:provider, :name, :temperature, :thinking_budget_tokens, :max_output_tokens])
    |> validate_inclusion(:provider, @providers)
    |> validate_number(:temperature, greater_than_or_equal_to: 0, less_than_or_equal_to: 1)
    |> validate_number(:thinking_budget_tokens, greater_than_or_equal_to: 1024)
    |> validate_number(:max_output_tokens, greater_than: 0)
  end
end
