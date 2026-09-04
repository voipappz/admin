defmodule Connectix.Skills do
  @moduledoc """
  The trusted catalog of Skills a bot may select.

  A bot stores a Skill *id* and *version*, never a module name; this literal
  map is the only place an id turns into code. Customer data therefore cannot
  name a module, and adding a Skill is a code change that goes through
  review. `String.to_atom/1` and `Module.concat/1` never touch bot data.
  """

  alias Connectix.Skills.Skill

  @registry %{
    "memory_files" => Connectix.Skills.MemoryFiles,
    "web_lookup" => Connectix.Skills.WebLookup,
    "todo" => Connectix.Skills.Todo,
    "customer_lookup" => Connectix.Skills.CustomerLookup,
    "human_handoff" => Connectix.Skills.HumanHandoff
  }

  @doc "Every Skill id the catalog knows."
  def ids, do: Map.keys(@registry)

  @doc "The module for an id, or `nil`."
  def module(id) when is_binary(id), do: Map.get(@registry, id)

  @doc """
  The module for `id` when `version` is compatible with it — same major, as
  in semantic versioning — or why not.
  """
  @spec fetch(String.t(), String.t()) ::
          {:ok, module()}
          | {:error,
             {:unknown_skill, String.t()} | {:incompatible_skill_version, String.t(), String.t()}}
  def fetch(id, version) when is_binary(id) and is_binary(version) do
    case module(id) do
      nil ->
        {:error, {:unknown_skill, id}}

      mod ->
        if compatible?(mod.version(), version),
          do: {:ok, mod},
          else: {:error, {:incompatible_skill_version, id, mod.version()}}
    end
  end

  @doc "Whether two semantic versions share a major."
  def compatible?(current, requested) when is_binary(current) and is_binary(requested) do
    major(current) != nil and major(current) == major(requested)
  end

  @doc """
  Validates a Skill's settings through its settings struct's `new/1`,
  returning the typed struct or `{:error, %{field => [message]}}`. A Skill
  without a schema accepts only an empty map.
  """
  def validate_settings(id, version, settings) when is_map(settings) do
    with {:ok, mod} <- fetch(id, version) do
      case mod.settings_schema() do
        nil -> if settings == %{}, do: {:ok, %{}}, else: {:error, {:no_settings, id}}
        schema -> schema.new(settings)
      end
    end
  end

  @doc "The catalog as data, for the API and the Studio."
  def catalog do
    @registry
    |> Map.values()
    |> Enum.sort_by(& &1.id())
    |> Enum.map(fn mod ->
      settings =
        case mod.settings_schema() do
          nil -> %{}
          schema -> schema |> struct() |> Map.from_struct()
        end

      %{
        id: mod.id(),
        version: mod.version(),
        name: mod.name(),
        description: mod.description(),
        default_settings: settings,
        capabilities:
          mod |> Skill.capabilities(struct_or_map(mod)) |> Enum.map(&capability_badge/1)
      }
    end)
  end

  defp struct_or_map(mod) do
    case mod.settings_schema() do
      nil -> %{}
      schema -> struct(schema)
    end
  end

  defp capability_badge(capability) do
    Map.take(capability, [:id, :description, :risk, :approval, :idempotent, :timeout_ms])
  end

  defp major(version) do
    case String.split(version, ".") do
      [major | _rest] -> major
      _malformed -> nil
    end
  end
end
