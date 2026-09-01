defmodule AgentsDemo.Bots.Version.Knowledge do
  @moduledoc """
  Approved sources of truth and how strictly the bot must stay on them.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @grounding ~w(open sources_only)

  @primary_key false
  embedded_schema do
    field :grounding, :string, default: "open"
    field :cite_sources, :boolean, default: false
    field :unavailable_source_behavior, :string
  end

  def changeset(knowledge, attrs) do
    knowledge
    |> cast(attrs, [:grounding, :cite_sources, :unavailable_source_behavior])
    |> validate_inclusion(:grounding, @grounding)
  end
end
