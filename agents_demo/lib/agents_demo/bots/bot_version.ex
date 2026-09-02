defmodule AgentsDemo.Bots.BotVersion do
  @moduledoc """
  The complete definition of a bot at one point in time — a plain struct.

  Mutable only while a draft; publishing freezes it (enforced in
  `AgentsDemo.Bots`, not a database trigger) and stamps a fingerprint. Every
  configuration area is a typed struct under `AgentsDemo.Bots.Version.*`;
  `skills` is a list of `BotVersionSkill`. Stored whole as one Mnesia row.
  """

  alias AgentsDemo.Bots.BotVersionSkill
  alias AgentsDemo.Bots.Version

  @areas ~w(behavior model safety knowledge memory output handoff voice limits availability audiences)a

  @area_mod %{
    behavior: Version.Behavior,
    model: Version.Model,
    safety: Version.Safety,
    knowledge: Version.Knowledge,
    memory: Version.Memory,
    output: Version.Output,
    handoff: Version.Handoff,
    voice: Version.Voice,
    limits: Version.Limits,
    availability: Version.Availability,
    audiences: Version.Audiences
  }

  @derive Jason.Encoder
  defstruct [
    :id,
    :bot_id,
    :number,
    :fingerprint,
    :change_note,
    :published_at,
    :published_by_user_id,
    :retired_at,
    :inserted_at,
    :updated_at,
    status: :draft,
    behavior: %Version.Behavior{},
    model: %Version.Model{},
    safety: %Version.Safety{},
    knowledge: %Version.Knowledge{},
    memory: %Version.Memory{},
    output: %Version.Output{},
    handoff: %Version.Handoff{},
    voice: %Version.Voice{},
    limits: %Version.Limits{},
    availability: %Version.Availability{},
    audiences: %Version.Audiences{},
    skills: []
  ]

  @doc "The configuration areas, in presentation order."
  def areas, do: @areas

  @doc "A new draft with every area at its defaults."
  def new_draft(bot_id, number) do
    %__MODULE__{bot_id: bot_id, number: number, status: :draft}
  end

  @doc """
  Apply draft edits, returning `{:ok, version}` or `{:error, %{area => errors}}`.

  Each area in `attrs` is rebuilt through its `new/1`; `skills` through
  `BotVersionSkill.new/1`. Errors from every area are collected.
  """
  def apply_draft(%__MODULE__{status: :draft} = version, attrs) do
    attrs = Map.new(attrs, fn {k, v} -> {to_string(k), v} end)

    {version, errors} =
      Enum.reduce(@areas, {version, %{}}, fn area, {v, errs} ->
        case Map.fetch(attrs, Atom.to_string(area)) do
          {:ok, area_attrs} ->
            case @area_mod[area].new(area_attrs || %{}) do
              {:ok, built} -> {Map.put(v, area, built), errs}
              {:error, e} -> {v, Map.put(errs, area, e)}
            end

          :error ->
            {v, errs}
        end
      end)

    version = %{version | change_note: Map.get(attrs, "change_note", version.change_note)}

    case build_skills(attrs["skills"]) do
      {:ok, skills} when map_size(errors) == 0 ->
        {:ok, %{version | skills: skills || version.skills}}

      {:error, skill_errors} ->
        {:error, Map.put(errors, :skills, skill_errors)}

      _ ->
        {:error, errors}
    end
  end

  def apply_draft(%__MODULE__{status: status}, _attrs),
    do: {:error, %{status: ["is #{status}; published versions are immutable, create a new draft"]}}

  defp build_skills(nil), do: {:ok, nil}

  defp build_skills(list) when is_list(list) do
    list
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {attrs, i}, {:ok, acc} ->
      attrs = Map.put_new(Map.new(attrs, fn {k, v} -> {to_string(k), v} end), "position", i)

      case BotVersionSkill.new(attrs) do
        {:ok, skill} -> {:cont, {:ok, [skill | acc]}}
        {:error, e} -> {:halt, {:error, e}}
      end
    end)
    |> case do
      {:ok, skills} -> {:ok, Enum.sort_by(Enum.reverse(skills), & &1.position)}
      other -> other
    end
  end
end
