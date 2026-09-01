defmodule AgentsDemo.Bots.Bot do
  @moduledoc """
  A bot's stable identity: what it is called, whether it is open for new
  conversations, and which version answers them.

  Everything the bot *does* is in `AgentsDemo.Bots.BotVersion`. The two
  pointers here are the whole lifecycle: `current_version` is the published
  one new conversations pin; `draft_version` is the one being edited, if any.

  Archiving closes the bot to new conversations. It never rewrites, retires
  or deletes anything a conversation already pinned.
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias AgentsDemo.Bots.BotVersion

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "bots" do
    belongs_to :user, AgentsDemo.Accounts.User, foreign_key: :user_id, type: :id
    belongs_to :current_version, BotVersion
    belongs_to :draft_version, BotVersion
    has_many :versions, BotVersion, preload_order: [desc: :number]

    field :name, :string
    field :slug, :string
    field :description, :string
    field :status, Ecto.Enum, values: [:active, :archived], default: :active
    field :archived_at, :utc_datetime_usec

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def create_changeset(owner_id, attrs) do
    %__MODULE__{}
    |> cast(attrs, [:name, :slug, :description])
    |> put_change(:user_id, owner_id)
    |> derive_slug()
    |> common_validations()
  end

  @doc false
  def changeset(%__MODULE__{} = bot, attrs) do
    bot
    |> cast(attrs, [:name, :description])
    |> common_validations()
  end

  @doc false
  def archive_changeset(%__MODULE__{} = bot, now) do
    change(bot, status: :archived, archived_at: now)
  end

  @doc false
  def unarchive_changeset(%__MODULE__{} = bot) do
    change(bot, status: :active, archived_at: nil)
  end

  @doc false
  def versions_changeset(%__MODULE__{} = bot, attrs) do
    cast(bot, attrs, [:current_version_id, :draft_version_id])
  end

  @doc "A URL-safe identifier derived from a name: `\"Nimbus Support\"` → `\"nimbus-support\"`."
  def slugify(name) when is_binary(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/u, "-")
    |> String.trim("-")
  end

  defp derive_slug(changeset) do
    case {get_change(changeset, :slug), get_change(changeset, :name)} do
      {nil, name} when is_binary(name) -> put_change(changeset, :slug, slugify(name))
      _no_slug_change -> changeset
    end
  end

  defp common_validations(changeset) do
    changeset
    |> validate_required([:user_id, :name, :slug])
    |> validate_length(:name, min: 1, max: 100)
    |> validate_format(:slug, ~r/^[a-z0-9]+(-[a-z0-9]+)*$/,
      message: "must be lowercase letters, digits and single dashes"
    )
    |> validate_length(:slug, max: 100)
    |> unique_constraint([:user_id, :name],
      error_key: :name,
      message: "you already have a bot with that name"
    )
    |> unique_constraint([:user_id, :slug],
      error_key: :slug,
      message: "you already have a bot with that slug"
    )
    |> foreign_key_constraint(:user_id)
  end
end
