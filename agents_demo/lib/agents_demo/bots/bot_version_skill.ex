defmodule AgentsDemo.Bots.BotVersionSkill do
  @moduledoc """
  One Skill selected by a version: a catalog id, the Skill version it was
  written against, and validated settings. Relational rather than jsonb so
  "which bots use this Skill" is an indexed query.
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias AgentsDemo.Skills

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "bot_version_skills" do
    belongs_to :bot_version, AgentsDemo.Bots.BotVersion

    field :skill_id, :string
    field :skill_version, :string
    field :settings, :map, default: %{}
    field :position, :integer, default: 0

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(skill, attrs) do
    skill
    |> cast(attrs, [:skill_id, :skill_version, :settings, :position])
    |> validate_required([:skill_id, :skill_version])
    |> validate_inclusion(:skill_id, Skills.ids(), message: "is not in the catalog")
    |> validate_compatible_version()
    |> validate_settings()
    |> validate_number(:position, greater_than_or_equal_to: 0)
    |> unique_constraint([:bot_version_id, :skill_id])
  end

  defp validate_compatible_version(changeset) do
    id = get_field(changeset, :skill_id)
    version = get_field(changeset, :skill_version)

    case is_binary(id) and is_binary(version) and Skills.fetch(id, version) do
      {:error, {:incompatible_skill_version, _id, current}} ->
        add_error(
          changeset,
          :skill_version,
          "is incompatible with the catalog's #{id} (#{current})"
        )

      _ok_or_unknown_id ->
        changeset
    end
  end

  defp validate_settings(changeset) do
    id = get_field(changeset, :skill_id)
    version = get_field(changeset, :skill_version)
    settings = get_field(changeset, :settings) || %{}

    if changeset.valid? and is_binary(id) and is_binary(version) do
      case Skills.validate_settings(id, version, settings) do
        {:ok, _typed} ->
          changeset

        {:error, %Ecto.Changeset{} = errors} ->
          message =
            errors
            |> traverse_errors(fn {msg, _opts} -> msg end)
            |> Enum.map_join("; ", fn {field, msgs} -> "#{field} #{Enum.join(msgs, ", ")}" end)

          add_error(changeset, :settings, message)

        {:error, {:no_settings, _id}} ->
          add_error(changeset, :settings, "#{id} takes no settings")

        {:error, _catalog} ->
          changeset
      end
    else
      changeset
    end
  end
end
