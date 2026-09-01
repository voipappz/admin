defmodule AgentsDemo.Repo.Migrations.CreatePortalEventStore do
  @moduledoc """
  The portal's event store, ported from the Deno BFF's DuckDB file
  (api/event_store.ts) so the dashboard routes can move to this app and Deno
  can be retired.

  Postgres rather than DuckDB: it is already a dependency here and already
  deployed alongside the app, whereas DuckDB has no Elixir driver worth
  depending on. The trade is analytical speed for one less runtime — and these
  are ordinary indexed lookups over a modest table, not the column-store scans
  DuckDB is for.

  Deliberate differences from the DuckDB original:

    * `payload`/`raw_payload`/`definition` are `jsonb`, not `json` — the
      DuckDB source stores text it re-parses on every read.
    * `occurred_at` is `timestamptz`. DuckDB's naive TIMESTAMP is what makes a
      dashboard shift by hours when the server's zone is not UTC.
    * `occurred_at_epoch` is kept even though it duplicates `occurred_at`: the
      replay cursor orders on it, and dropping it would change the ordering
      contract of a page boundary.
  """

  use Ecto.Migration

  def change do
    create table(:portal_events, primary_key: false) do
      add :event_id, :string, primary_key: true
      add :call_id, :string
      add :event_type, :string, null: false
      add :action, :string, null: false
      add :occurred_at, :utc_datetime_usec
      add :occurred_at_epoch, :bigint
      add :payload, :map, null: false
      add :raw_payload, :map
      add :received_at, :utc_datetime_usec, default: fragment("now()")
    end

    create index(:portal_events, [:call_id])
    create index(:portal_events, [:occurred_at])
    create index(:portal_events, [:action])

    create table(:portal_event_sync_state, primary_key: false) do
      add :source, :string, primary_key: true
      add :cursor_event_id, :string
      add :head_event_id, :string
      add :caught_up, :boolean, null: false, default: false
      add :last_reconciled_at, :utc_datetime_usec
      add :last_error, :text
    end

    create table(:portal_dashboards, primary_key: false) do
      add :uuid, :string, primary_key: true
      add :name, :string, null: false
      add :position, :integer, null: false, default: 0
      add :updated_at, :utc_datetime_usec, default: fragment("now()")
    end

    create table(:portal_dashboard_widgets, primary_key: false) do
      add :uuid, :string, primary_key: true
      add :definition, :map, null: false
      add :position, :integer, null: false, default: 0
      # NOT NULL with a default, as in the source: widgets predate multiple
      # dashboards and every existing one belongs to the default board.
      add :dashboard_uuid, :string, null: false, default: "default"
      add :updated_at, :utc_datetime_usec, default: fragment("now()")
    end

    create index(:portal_dashboard_widgets, [:dashboard_uuid])

    # The default dashboard, which the widget table's default references. The
    # Deno store created this on every boot; a migration is the right place for
    # it here, so the row exists before any code reads it.
    execute(
      """
      INSERT INTO portal_dashboards (uuid, name, position, updated_at)
      VALUES ('default', 'Main dashboard', 0, now())
      ON CONFLICT (uuid) DO NOTHING
      """,
      "DELETE FROM portal_dashboards WHERE uuid = 'default'"
    )
  end
end
