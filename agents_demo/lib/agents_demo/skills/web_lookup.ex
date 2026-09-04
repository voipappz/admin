defmodule Connectix.Skills.WebLookup do
  @moduledoc """
  Search the web and read the best source. Wraps
  `Connectix.Middleware.WebToolMiddleware`, which runs the lookup as a
  bounded sub-agent.
  """

  @behaviour Connectix.Skills.Skill

  alias Connectix.Skills.Context

  defmodule Settings do
    @moduledoc false
    defstruct timeout_ms: 120_000

    @doc "Build from attrs, returning `{:ok, struct}` or `{:error, %{field => [msg]}}`."
    def new(attrs \\ %{}) do
      %{timeout_ms: timeout} = Connectix.Bots.Version.take(attrs, %__MODULE__{}, [:timeout_ms])

      errors =
        if is_integer(timeout),
          do: Connectix.Bots.Version.range(%{}, :timeout_ms, timeout, gt: 1_000, lte: 600_000),
          else: %{timeout_ms: ["is invalid"]}

      Connectix.Bots.Version.done(errors, %__MODULE__{timeout_ms: timeout})
    end
  end

  @impl true
  def id, do: "web_lookup"
  @impl true
  def version, do: "1.0.0"
  @impl true
  def name, do: "Web lookup"
  @impl true
  def description, do: "Search the web for current information and cite the source."
  @impl true
  def settings_schema, do: Settings

  @impl true
  def middleware(%Settings{} = settings, %Context{} = context) do
    [
      {Connectix.Middleware.WebToolMiddleware,
       [agent_id: context.agent_id, model: context.model, timeout: settings.timeout_ms]}
    ]
  end
end
