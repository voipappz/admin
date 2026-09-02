defmodule AgentsDemo.Bots.BotVersionSkill do
  @moduledoc """
  One Skill selected by a version: a catalog id, the Skill version it was
  written against, and validated settings. A plain struct; validated against the
  trusted `AgentsDemo.Skills` catalog by `new/1`.
  """

  alias AgentsDemo.Skills

  @derive Jason.Encoder
  defstruct [:skill_id, :skill_version, position: 0, settings: %{}]

  def new(attrs) do
    attrs = Map.new(attrs, fn {k, v} -> {to_string(k), v} end)

    skill = %__MODULE__{
      skill_id: attrs["skill_id"],
      skill_version: attrs["skill_version"],
      settings: attrs["settings"] || %{},
      position: attrs["position"] || 0
    }

    with :ok <- required(skill),
         :ok <- in_catalog(skill),
         :ok <- compatible(skill),
         {:ok, settings} <- valid_settings(skill) do
      {:ok, %{skill | settings: settings}}
    end
  end

  defp required(%{skill_id: id, skill_version: v}) when is_binary(id) and is_binary(v), do: :ok
  defp required(_), do: {:error, %{skill_id: ["can't be blank"]}}

  defp in_catalog(%{skill_id: id}) do
    if id in Skills.ids(), do: :ok, else: {:error, %{skill_id: ["is not in the catalog"]}}
  end

  defp compatible(%{skill_id: id, skill_version: version}) do
    case Skills.fetch(id, version) do
      {:error, {:incompatible_skill_version, _id, current}} ->
        {:error, %{skill_version: ["is incompatible with the catalog's #{id} (#{current})"]}}

      _ok_or_unknown ->
        :ok
    end
  end

  defp valid_settings(%{skill_id: id, skill_version: v, settings: settings}) do
    case Skills.validate_settings(id, v, settings) do
      {:ok, typed} -> {:ok, typed}
      {:error, {:no_settings, ^id}} -> {:error, %{settings: ["#{id} takes no settings"]}}
      {:error, %{} = errors} -> {:error, %{settings: [inspect(errors)]}}
      {:error, _catalog} -> {:ok, settings}
    end
  end
end
