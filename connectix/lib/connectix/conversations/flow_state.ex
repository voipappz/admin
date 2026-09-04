defmodule Connectix.Conversations.FlowState do
  @moduledoc "Deterministic flow position for a conversation (plain struct, no Ecto)."
  @derive Jason.Encoder
  defstruct [:state, :entered_at, vars: %{}]

  def new(attrs) when is_map(attrs) do
    attrs = Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
    %__MODULE__{state: attrs["state"], vars: attrs["vars"] || %{}, entered_at: attrs["entered_at"]}
  end

  def new(nil), do: nil
end
