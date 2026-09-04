defmodule Connectix.Bots.Version.Handoff do
  @moduledoc "When and how the bot hands a conversation to a person."
  @derive Jason.Encoder
  defstruct enabled: false, destination: "human_operator", stand_down: true, in_hours_text: nil, after_hours_text: nil

  @destinations ~w(human_operator)
  @fields [:enabled, :destination, :stand_down, :in_hours_text, :after_hours_text]

  def new(attrs \\ %{}) do
    m = Connectix.Bots.Version.take(attrs, %__MODULE__{}, @fields)
    m = %{m | destination: m.destination || "human_operator"}
    errors = Connectix.Bots.Version.inclusion(%{}, :destination, m.destination, @destinations)
    Connectix.Bots.Version.done(errors, struct(__MODULE__, m))
  end
end
