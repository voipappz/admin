defmodule Connectix.Skills.Todo do
  @moduledoc """
  A task list the bot keeps for multi-step work, shown inline in the chat.
  Wraps `Sagents.Middleware.TodoList`.
  """

  @behaviour Connectix.Skills.Skill

  alias Connectix.Skills.Context

  defmodule Settings do
    @moduledoc false
    defstruct inline: true

    @doc "Build from attrs, returning `{:ok, struct}` or `{:error, %{field => [msg]}}`."
    def new(attrs \\ %{}) do
      %{inline: inline} = Connectix.Bots.Version.take(attrs, %__MODULE__{}, [:inline])

      if is_boolean(inline),
        do: {:ok, %__MODULE__{inline: inline}},
        else: {:error, %{inline: ["is invalid"]}}
    end
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
