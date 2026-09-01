defmodule AgentsDemo.Skills.WebLookup do
  @moduledoc """
  Search the web and read the best source. Wraps
  `AgentsDemo.Middleware.WebToolMiddleware`, which runs the lookup as a
  bounded sub-agent.
  """

  @behaviour AgentsDemo.Skills.Skill

  alias AgentsDemo.Skills.Context

  defmodule Settings do
    @moduledoc false
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    embedded_schema do
      field :timeout_ms, :integer, default: 120_000
    end

    def changeset(settings, attrs) do
      settings
      |> cast(attrs, [:timeout_ms])
      |> validate_number(:timeout_ms, greater_than: 1_000, less_than_or_equal_to: 600_000)
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
      {AgentsDemo.Middleware.WebToolMiddleware,
       [agent_id: context.agent_id, model: context.model, timeout: settings.timeout_ms]}
    ]
  end
end
