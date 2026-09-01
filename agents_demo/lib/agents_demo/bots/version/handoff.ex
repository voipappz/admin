defmodule AgentsDemo.Bots.Version.Handoff do
  @moduledoc """
  When and how the bot hands a conversation to a person.

  `stand_down` is the important flag: once a human holds the thread the bot
  stores what arrives and answers nothing until the thread is returned.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @destinations ~w(human_operator)

  @primary_key false
  embedded_schema do
    field :enabled, :boolean, default: false
    field :destination, :string, default: "human_operator"
    field :stand_down, :boolean, default: true
    field :in_hours_text, :string
    field :after_hours_text, :string
  end

  def changeset(handoff, attrs) do
    handoff
    |> cast(attrs, [:enabled, :destination, :stand_down, :in_hours_text, :after_hours_text])
    |> validate_inclusion(:destination, @destinations)
  end
end
