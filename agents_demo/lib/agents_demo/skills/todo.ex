defmodule AgentsDemo.Skills.Todo do
  @moduledoc """
  A task list the bot keeps for multi-step work, shown inline in the chat.
  Wraps `Sagents.Middleware.TodoList`.
  """

  @behaviour AgentsDemo.Skills.Skill

  alias AgentsDemo.Skills.Context

  defmodule Settings do
    @moduledoc false
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    embedded_schema do
      field :inline, :boolean, default: true
    end

    def changeset(settings, attrs), do: cast(settings, attrs, [:inline])
  end

  @impl true
  def id, do: "todo"
  @impl true
  def version, do: "1.0.0"
  @impl true
  def name, do: "Task list"
  @impl true
  def description, do: "Plan multi-step work as a visible task list."
  @impl true
  def settings_schema, do: Settings

  @impl true
  def middleware(%Settings{} = settings, %Context{}) do
    [{Sagents.Middleware.TodoList, [inline: settings.inline]}]
  end
end
