defmodule AgentsDemo.Bots.Version.Behavior do
  @moduledoc "What the bot is told to be. `instructions` is the complete prompt."
  @derive Jason.Encoder
  defstruct instructions: nil, purpose: nil, audience_description: nil, languages: ["en"], style: nil

  @fields [:instructions, :purpose, :audience_description, :languages, :style]

  @doc "Build from attrs, returning `{:ok, struct}` or `{:error, %{field => [msg]}}`."
  def new(attrs \\ %{}) do
    m = AgentsDemo.Bots.Version.take(attrs, %__MODULE__{}, @fields)
    m = %{m | languages: m.languages || ["en"]}

    errors =
      %{}
      |> AgentsDemo.Bots.Version.max_len(:instructions, m.instructions, 100_000)
      |> AgentsDemo.Bots.Version.min_items(:languages, m.languages, 1)

    AgentsDemo.Bots.Version.done(errors, struct(__MODULE__, m))
  end
end
