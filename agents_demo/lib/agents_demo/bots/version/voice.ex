defmodule AgentsDemo.Bots.Version.Voice do
  @moduledoc """
  Voice profile for a future realtime adapter. Provider profiles are
  references; secrets stay in the environment.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :enabled, :boolean, default: false
    field :locale, :string
    field :voice_profile, :string
    field :greeting, :string
    field :max_call_seconds, :integer
  end

  def changeset(voice, attrs) do
    voice
    |> cast(attrs, [:enabled, :locale, :voice_profile, :greeting, :max_call_seconds])
    |> validate_number(:max_call_seconds, greater_than: 0)
  end
end
