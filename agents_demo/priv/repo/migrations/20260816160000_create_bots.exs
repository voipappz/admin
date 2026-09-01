defmodule AgentsDemo.Repo.Migrations.CreateBots do
  use Ecto.Migration

  @moduledoc """
  Bots as data, with immutable versions.

  A `bot` is the stable product identity — name, slug, lifecycle state. What
  it actually does lives in `bot_versions`: numbered, published exactly once,
  and never edited afterwards. A conversation pins one published version when
  it is created and keeps it for life, so a change to a bot can never rewrite
  a thread in progress, and any thread can be replayed against the exact
  configuration that answered it.

  Immutability is enforced here, in the database, and not only in changesets:
  a trigger refuses any change to a non-draft version other than its lifecycle
  columns, and refuses to turn a published version back into a draft. Skills
  attached to a published version cannot change or vanish either.

  Every conversation pins a version (`NOT NULL`). Rows created before this
  table existed cannot, and the project has no users, so they are removed.
  """

  def up do
    create table(:bots, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :slug, :string, null: false
      add :description, :text
      add :status, :string, null: false, default: "active"
      add :archived_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:bots, [:user_id])
    create unique_index(:bots, [:user_id, :name])
    create unique_index(:bots, [:user_id, :slug])
    create constraint(:bots, :bots_status_check, check: "status IN ('active', 'archived')")

    create table(:bot_versions, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :bot_id, references(:bots, on_delete: :delete_all, type: :binary_id), null: false
      add :number, :integer, null: false
      add :status, :string, null: false, default: "draft"

      # One column per configuration area. Each is a typed embedded schema in
      # `AgentsDemo.Bots.Version.*`, validated before publication; the column
      # is jsonb only because the shape is bounded and never queried by key.
      add :behavior, :map, null: false, default: %{}
      add :model, :map, null: false, default: %{}
      add :safety, :map, null: false, default: %{}
      add :knowledge, :map, null: false, default: %{}
      add :memory, :map, null: false, default: %{}
      add :output, :map, null: false, default: %{}
      add :handoff, :map, null: false, default: %{}
      add :voice, :map, null: false, default: %{}
      add :limits, :map, null: false, default: %{}
      add :availability, :map, null: false, default: %{}
      add :audiences, :map, null: false, default: %{}

      add :fingerprint, :string
      add :change_note, :text
      add :published_at, :utc_datetime_usec
      add :published_by_user_id, references(:users, on_delete: :nilify_all)
      add :retired_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:bot_versions, [:bot_id, :number])
    create index(:bot_versions, [:bot_id, :status])

    create constraint(:bot_versions, :bot_versions_status_check,
             check: "status IN ('draft', 'published', 'retired')"
           )

    create constraint(:bot_versions, :bot_versions_published_metadata_check,
             check: "status = 'draft' OR (published_at IS NOT NULL AND fingerprint IS NOT NULL)"
           )

    # Skills are relational so "which bots use skill X" is an indexed query,
    # not a scan through jsonb. `settings` is bounded and validated against
    # the skill's own schema before publication.
    create table(:bot_version_skills, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :bot_version_id, references(:bot_versions, on_delete: :delete_all, type: :binary_id),
        null: false

      add :skill_id, :string, null: false
      add :skill_version, :string, null: false
      add :settings, :map, null: false, default: %{}
      add :position, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:bot_version_skills, [:bot_version_id, :skill_id])
    create index(:bot_version_skills, [:skill_id])

    # The bot points at its versions and the versions at their bot, so the
    # two pointers are added once both tables exist. `current_version_id`
    # restricts deletion: a published version that answers conversations is
    # retired, never removed.
    alter table(:bots) do
      add :current_version_id,
          references(:bot_versions, on_delete: :restrict, type: :binary_id)

      add :draft_version_id, references(:bot_versions, on_delete: :nilify_all, type: :binary_id)
    end

    execute """
    CREATE FUNCTION bot_versions_immutable() RETURNS trigger AS $$
    BEGIN
      IF OLD.status = 'published' AND NEW.status = 'draft' THEN
        RAISE EXCEPTION 'bot_versions: % is published and cannot become a draft', OLD.id;
      END IF;

      IF OLD.status <> 'draft' AND
         (to_jsonb(NEW) - 'status' - 'retired_at' - 'updated_at') IS DISTINCT FROM
         (to_jsonb(OLD) - 'status' - 'retired_at' - 'updated_at') THEN
        RAISE EXCEPTION 'bot_versions: % is %, create a new draft instead', OLD.id, OLD.status;
      END IF;

      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """

    execute """
    CREATE TRIGGER bot_versions_immutable
    BEFORE UPDATE ON bot_versions
    FOR EACH ROW EXECUTE FUNCTION bot_versions_immutable();
    """

    execute """
    CREATE FUNCTION bot_version_skills_immutable() RETURNS trigger AS $$
    DECLARE
      parent_status text;
      version_id uuid;
    BEGIN
      version_id := COALESCE(NEW.bot_version_id, OLD.bot_version_id);
      SELECT status INTO parent_status FROM bot_versions WHERE id = version_id;

      IF parent_status IS NOT NULL AND parent_status <> 'draft' THEN
        RAISE EXCEPTION 'bot_version_skills: version % is %, create a new draft instead',
          version_id, parent_status;
      END IF;

      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END
    $$ LANGUAGE plpgsql;
    """

    execute """
    CREATE TRIGGER bot_version_skills_immutable
    BEFORE UPDATE OR DELETE ON bot_version_skills
    FOR EACH ROW EXECUTE FUNCTION bot_version_skills_immutable();
    """

    # Conversations pin a version. Nothing that exists can, and the project
    # has no users: see the moduledoc.
    execute "DELETE FROM sagents_conversations"

    alter table(:sagents_conversations) do
      add :bot_id, references(:bots, on_delete: :restrict, type: :binary_id), null: false

      add :bot_version_id, references(:bot_versions, on_delete: :restrict, type: :binary_id),
        null: false

      # Who answers: the bot, or a human who took the thread over. While a
      # human holds it the bot stands down; a message from a channel is
      # stored but never answered automatically.
      add :handler, :string, null: false, default: "bot"
      add :handed_off_at, :utc_datetime_usec
      add :last_user_message_at, :utc_datetime_usec

      # Position inside a deterministic flow, when the pinned version runs
      # one. Bounded, owned by `AgentsDemo.Conversations.FlowState`.
      add :flow_state, :map
    end

    create index(:sagents_conversations, [:bot_id])
    create index(:sagents_conversations, [:bot_version_id])
    create index(:sagents_conversations, [:handler])

    create constraint(:sagents_conversations, :sagents_conversations_handler_check,
             check: "handler IN ('bot', 'human')"
           )
  end

  def down do
    drop constraint(:sagents_conversations, :sagents_conversations_handler_check)

    alter table(:sagents_conversations) do
      remove :flow_state
      remove :last_user_message_at
      remove :handed_off_at
      remove :handler
      remove :bot_version_id
      remove :bot_id
    end

    execute "DROP TRIGGER bot_version_skills_immutable ON bot_version_skills"
    execute "DROP FUNCTION bot_version_skills_immutable()"
    execute "DROP TRIGGER bot_versions_immutable ON bot_versions"
    execute "DROP FUNCTION bot_versions_immutable()"

    alter table(:bots) do
      remove :draft_version_id
      remove :current_version_id
    end

    drop table(:bot_version_skills)
    drop table(:bot_versions)
    drop table(:bots)
  end
end
