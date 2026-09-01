defmodule AgentsDemo.Repo.Migrations.DenormalizeDisplayMessageToolCallId do
  @moduledoc """
  Denormalizes the tool-call id out of the `content` JSONB into a dedicated,
  indexed `tool_call_id` column on `sagents_display_messages`.

  This is the non-destructive upgrade path for an existing install that was
  generated on an earlier sagents RC (the shape created by the original
  `mix sagents.gen.persistence` migration). It mirrors the migration the
  sagents v0.8.0-rc.13 CHANGELOG advises RC adopters to add.

  Uses explicit `up`/`down` (not `change`) because the raw-SQL backfill and the
  index swap are not auto-reversible.
  """

  use Ecto.Migration

  def up do
    alter table(:sagents_display_messages) do
      add :tool_call_id, :string
    end

    flush()

    # Backfill from the existing JSONB content for BOTH row types.
    execute """
    UPDATE sagents_display_messages
    SET tool_call_id = content->>'call_id'
    WHERE content_type = 'tool_call'
    """

    execute """
    UPDATE sagents_display_messages
    SET tool_call_id = content->>'tool_call_id'
    WHERE content_type = 'tool_result'
    """

    drop_if_exists unique_index(
                     :sagents_display_messages,
                     [:conversation_id, "(content->>'call_id')"],
                     name: :unique_tool_call_per_conversation
                   )

    # add a single plain index (covers tool_call AND tool_result lookups).
    create index(:sagents_display_messages, [:tool_call_id])
  end

  def down do
    drop_if_exists index(:sagents_display_messages, [:tool_call_id])

    create unique_index(
             :sagents_display_messages,
             [:conversation_id, "(content->>'call_id')"],
             name: :unique_tool_call_per_conversation,
             where: "content_type = 'tool_call'"
           )

    alter table(:sagents_display_messages) do
      remove :tool_call_id
    end
  end
end
