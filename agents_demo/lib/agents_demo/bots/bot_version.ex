defmodule AgentsDemo.Bots.BotVersion do
  @moduledoc """
  The complete, executable definition of a bot at one point in time.

  A version is mutable only while it is a draft. Publishing freezes it — in
  changesets here, and in the database by trigger — and stamps a fingerprint
  of its canonical content (`AgentsDemo.Bots.Snapshot`). Conversations pin a
  published version; a new version never moves them.

  Every configuration area is a typed embedded schema under
  `AgentsDemo.Bots.Version`. Nothing here is an unvalidated blob.
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias AgentsDemo.Bots.BotVersionSkill
  alias AgentsDemo.Bots.Version

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @areas ~w(behavior model safety knowledge memory output handoff voice limits availability audiences)a

  schema "bot_versions" do
    belongs_to :bot, AgentsDemo.Bots.Bot

    belongs_to :published_by, AgentsDemo.Accounts.User,
      foreign_key: :published_by_user_id,
      type: :id

    field :number, :integer
    field :status, Ecto.Enum, values: [:draft, :published, :retired], default: :draft
    field :fingerprint, :string
    field :change_note, :string
    field :published_at, :utc_datetime_usec
    field :retired_at, :utc_datetime_usec

    embeds_one :behavior, Version.Behavior, on_replace: :update
    embeds_one :model, Version.Model, on_replace: :update
    embeds_one :safety, Version.Safety, on_replace: :update
    embeds_one :knowledge, Version.Knowledge, on_replace: :update
    embeds_one :memory, Version.Memory, on_replace: :update
    embeds_one :output, Version.Output, on_replace: :update
    embeds_one :handoff, Version.Handoff, on_replace: :update
    embeds_one :voice, Version.Voice, on_replace: :update
    embeds_one :limits, Version.Limits, on_replace: :update
    embeds_one :availability, Version.Availability, on_replace: :update
    embeds_one :audiences, Version.Audiences, on_replace: :update

    has_many :skills, BotVersionSkill, on_replace: :delete, preload_order: [asc: :position]

    timestamps(type: :utc_datetime_usec)
  end

  @doc "The configuration areas, in the order they are presented."
  def areas, do: @areas

  @doc """
  A new draft with every area present at its defaults, so a version can
  always be compiled without nil checks.
  """
  def new_draft(bot_id, number) do
    %__MODULE__{
      bot_id: bot_id,
      number: number,
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
    }
  end

  @doc """
  Edits a draft. Refuses anything else before casting a single field, so the
  error a caller sees is "immutable", not a field error.
  """
  def draft_changeset(%__MODULE__{status: :draft} = version, attrs) do
    changeset = version |> cast(attrs, [:change_note]) |> validate_required([:number])

    @areas
    |> Enum.reduce(changeset, fn area, cs -> cast_embed(cs, area, required: true) end)
    |> cast_assoc(:skills, with: &BotVersionSkill.changeset/2, sort_param: :skills_sort)
    |> unique_constraint([:bot_id, :number])
  end

  def draft_changeset(%__MODULE__{status: status} = version, _attrs) do
    version
    |> change()
    |> add_error(:status, "is #{status}; published versions are immutable, create a new draft")
  end

  @doc false
  def publish_changeset(%__MODULE__{status: :draft} = version, user_id, fingerprint, now) do
    version
    |> change(
      status: :published,
      fingerprint: fingerprint,
      published_at: now,
      published_by_user_id: user_id
    )
    |> check_constraint(:status, name: :bot_versions_published_metadata_check)
  end

  @doc false
  def retire_changeset(%__MODULE__{status: :published} = version, now) do
    change(version, status: :retired, retired_at: now)
  end
end
