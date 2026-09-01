defmodule AgentsDemo.Bots.Version.Behavior do
  @moduledoc """
  What the bot is told to be.

  `instructions` is the complete prompt. It replaces the platform default
  rather than extending it: someone who writes instructions means them, and a
  hidden prefix would make their text unpredictable. Skills may append their
  own instructions in a documented order (see `AgentsDemo.Bots.Compiler`).
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :instructions, :string
    field :purpose, :string
    field :audience_description, :string
    field :languages, {:array, :string}, default: ["en"]
    field :style, :string
  end

  def changeset(behavior, attrs) do
    behavior
    |> cast(attrs, [:instructions, :purpose, :audience_description, :languages, :style])
    |> validate_length(:instructions, max: 100_000)
    |> validate_length(:languages, min: 1)
  end
end
