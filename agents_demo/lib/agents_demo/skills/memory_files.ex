defmodule AgentsDemo.Skills.MemoryFiles do
  @moduledoc """
  A per-owner file store the bot can read and write — persistent memory
  across conversations. Wraps `Sagents.Middleware.FileSystem`.
  """

  @behaviour AgentsDemo.Skills.Skill

  alias AgentsDemo.Skills.Context

  defmodule Settings do
    @moduledoc false
    use Ecto.Schema
    import Ecto.Changeset

    @all_tools ~w(list_files read_file create_file insert_file_lines find_in_file move_file delete_file)
    @default_tools ~w(list_files read_file create_file find_in_file move_file delete_file)

    @primary_key false
    embedded_schema do
      field :enabled_tools, {:array, :string}, default: @default_tools
    end

    def all_tools, do: @all_tools

    def changeset(settings, attrs) do
      settings
      |> cast(attrs, [:enabled_tools])
      |> validate_subset(:enabled_tools, @all_tools)
      |> validate_length(:enabled_tools, min: 1)
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
