defmodule AgentsDemo.Repo.Migrations.AddConversationSource do
  use Ecto.Migration

  @moduledoc """
  Lets a conversation belong to someone who is not a registered user.

  A WhatsApp message comes from a phone number, so `user_id` can no longer be
  required. Who the sender is lives in the `metadata` map the table already
  has (`%{"phone" => "+972..."}`) rather than in a new table — a channel needs
  a handle to reply to, not a customer record.

  `source` names the channel the conversation arrived on. Channel modules
  match on it to decide whether a message is theirs to deliver.
  """

  def up do
    alter table(:sagents_conversations) do
      add :source, :string, default: "chat", null: false
    end

    create index(:sagents_conversations, [:source])

    execute "ALTER TABLE sagents_conversations ALTER COLUMN user_id DROP NOT NULL"
  end

  def down do
    execute "DELETE FROM sagents_conversations WHERE user_id IS NULL"
    execute "ALTER TABLE sagents_conversations ALTER COLUMN user_id SET NOT NULL"

    drop index(:sagents_conversations, [:source])

    alter table(:sagents_conversations) do
      remove :source
    end
  end
end
