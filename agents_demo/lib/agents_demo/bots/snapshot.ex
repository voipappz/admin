defmodule AgentsDemo.Bots.Snapshot do
  @moduledoc """
  The canonical content of a version, and its fingerprint.

  Identical behaviour must produce an identical fingerprint, so the snapshot
  holds only what changes behaviour: the configuration areas and the
  selected skills. Row ids, version numbers, timestamps and lifecycle state
  are excluded; keys are strings sorted at every level; skills are ordered by
  position then id.

  Borrowed from VoipAppz's `Mediators::Bot::Snapshot`, where the same idea
  makes a deployment reproducible.
  """

  alias AgentsDemo.Bots.BotVersion

  @schema_version 1

  @doc "The canonical, JSON-safe map for a version."
  def canonical(%BotVersion{} = version) do
    areas =
      Map.new(BotVersion.areas(), fn area ->
        {Atom.to_string(area), version |> Map.fetch!(area) |> area()}
      end)

    skills =
      version.skills
      |> Enum.sort_by(&{&1.position, &1.skill_id})
      |> Enum.map(fn skill ->
        %{
          "skill_id" => skill.skill_id,
          "skill_version" => skill.skill_version,
          "settings" => plain(skill.settings)
        }
      end)

    %{"schema_version" => @schema_version, "areas" => areas, "skills" => skills}
  end

  @doc "`\"sha256:<hex>\"` of the canonical JSON."
  def fingerprint(%BotVersion{} = version) do
    digest =
      version
      |> canonical()
      |> encode()
      |> then(&:crypto.hash(:sha256, &1))
      |> Base.encode16(case: :lower)

    "sha256:" <> digest
  end

  @doc "Canonical JSON: sorted keys at every level, no whitespace."
  def encode(term), do: term |> ordered() |> Jason.encode!()

  # Structs (embedded schemas) become maps of their fields. A nil *area* is an
  # empty map so a version created before an area existed hashes the same as
  # one carrying that area's defaults; a nil field inside an area stays nil.
  defp area(nil), do: %{}
  defp area(struct), do: plain(struct)

  defp plain(%_module{} = struct),
    do: struct |> Map.from_struct() |> Map.delete(:__meta__) |> plain()

  defp plain(map) when is_map(map),
    do: Map.new(map, fn {key, value} -> {to_string(key), plain(value)} end)

  defp plain(list) when is_list(list), do: Enum.map(list, &plain/1)

  defp plain(atom) when is_atom(atom) and not is_boolean(atom) and not is_nil(atom),
    do: to_string(atom)

  defp plain(other), do: other

  defp ordered(map) when is_map(map) do
    map
    |> Enum.sort_by(fn {key, _value} -> key end)
    |> Enum.map(fn {key, value} -> {key, ordered(value)} end)
    |> Jason.OrderedObject.new()
  end

  defp ordered(list) when is_list(list), do: Enum.map(list, &ordered/1)
  defp ordered(other), do: other
end
