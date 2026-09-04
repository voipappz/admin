defmodule Connectix.Bots.Version.Knowledge do
  @moduledoc "Approved sources of truth and how strictly the bot must stay on them."
  @derive Jason.Encoder
  defstruct grounding: "open", cite_sources: false, unavailable_source_behavior: nil

  @grounding ~w(open sources_only)
  @fields [:grounding, :cite_sources, :unavailable_source_behavior]

  def new(attrs \\ %{}) do
    m = Connectix.Bots.Version.take(attrs, %__MODULE__{}, @fields)
    m = %{m | grounding: m.grounding || "open"}
    errors = Connectix.Bots.Version.inclusion(%{}, :grounding, m.grounding, @grounding)
    Connectix.Bots.Version.done(errors, struct(__MODULE__, m))
  end
end
