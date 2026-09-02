defmodule AgentsDemo.Skills.MemoryFiles do
  @moduledoc """
  A per-owner file store the bot can read and write — persistent memory
  across conversations. Wraps `Sagents.Middleware.FileSystem`.
  """

  @behaviour AgentsDemo.Skills.Skill

  alias AgentsDemo.Skills.Context

  defmodule Settings do
    @moduledoc false

    @all_tools ~w(list_files read_file create_file insert_file_lines find_in_file move_file delete_file)
    @default_tools ~w(list_files read_file create_file find_in_file move_file delete_file)

    defstruct enabled_tools: @default_tools

    def all_tools, do: @all_tools

    @doc "Build from attrs, returning `{:ok, struct}` or `{:error, %{field => [msg]}}`."
    def new(attrs \\ %{}) do
      %{enabled_tools: tools} =
        AgentsDemo.Bots.Version.take(attrs, %__MODULE__{}, [:enabled_tools])

      errors =
        cond do
          not is_list(tools) -> %{enabled_tools: ["is invalid"]}
          tools == [] -> %{enabled_tools: ["should have at least 1 item(s)"]}
          Enum.any?(tools, &(&1 not in @all_tools)) -> %{enabled_tools: ["has an invalid entry"]}
          true -> %{}
        end

      AgentsDemo.Bots.Version.done(errors, %__MODULE__{enabled_tools: tools})
    end
  end

  @impl true
  def id, do: "memory_files"
  @impl true
  def version, do: "1.0.0"
  @impl true
  def name, do: "Memory files"
  @impl true
  def description,
    do: "Read, write and organise files under /Memories that persist across conversations."

  @impl true
  def settings_schema, do: Settings

  @impl true
  def middleware(%Settings{} = settings, %Context{} = context) do
    [
      {Sagents.Middleware.FileSystem,
       [enabled_tools: settings.enabled_tools, filesystem_scope: context.filesystem_scope]}
    ]
  end
end
