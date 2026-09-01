defmodule AgentsDemo.Conversations.Conversation do
  @moduledoc """
  Schema for conversations.

  A conversation represents a series of interactions between a user and an AI agent.
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias __MODULE__
  alias AgentsDemo.Conversations.AgentState
  alias AgentsDemo.Conversations.DisplayMessage

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "sagents_conversations" do
    belongs_to :user, AgentsDemo.Accounts.User, foreign_key: :user_id, type: :id

    # Which bot answers this conversation, and the exact published version it
    # was created against. Both are set by `AgentsDemo.Conversations` when the
    # row is inserted and never change: a newer version only affects
    # conversations created after it.
    belongs_to :bot, AgentsDemo.Bots.Bot, type: :binary_id
    belongs_to :bot_version, AgentsDemo.Bots.BotVersion, type: :binary_id
    has_one :agent_state, AgentState
    has_many :display_messages, DisplayMessage

    field :title, :string
    field :version, :integer, default: 1
    field :metadata, :map, default: %{}

    # The channel this conversation arrived on: "chat" for the LiveView UI,
    # "whatsapp" for the WhatsApp channel. See `AgentsDemo.Channels`.
    field :source, :string, default: "chat"

    # Who answers: the bot, or a person who took the thread over. While a
    # human holds it, inbound messages are stored and nothing is generated.
    field :handler, Ecto.Enum, values: [:bot, :human], default: :bot
    field :handed_off_at, :utc_datetime_usec
    field :last_user_message_at, :utc_datetime_usec

    embeds_one :flow_state, AgentsDemo.Conversations.FlowState, on_replace: :update

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def create_changeset(owner_id, attrs, %{bot_id: bot_id, bot_version_id: bot_version_id}) do
    %Conversation{}
    |> cast(attrs, [:title, :version, :metadata, :source])
    |> put_change(:user_id, owner_id)
    |> put_change(:bot_id, bot_id)
    |> put_change(:bot_version_id, bot_version_id)
    |> common_validations()
    |> foreign_key_constraint(:bot_id)
    |> foreign_key_constraint(:bot_version_id)
  end

  @doc false
  def changeset(%Conversation{} = conversation, attrs) do
    conversation
    |> cast(attrs, [:title, :version, :metadata, :source, :last_user_message_at])
    |> cast_embed(:flow_state)
    |> common_validations()
  end

  @doc false
  def handler_changeset(%Conversation{} = conversation, :human, now) do
    change(conversation, handler: :human, handed_off_at: now)
  end

  def handler_changeset(%Conversation{} = conversation, :bot, _now) do
    conversation
    |> change(handler: :bot, handed_off_at: nil)
    |> put_embed(:flow_state, nil)
  end

  defp common_validations(changeset) do
    changeset
    |> validate_owner()
    |> validate_required([:bot_id, :bot_version_id])
    |> validate_length(:title, max: 255)
    |> foreign_key_constraint(:user_id)
  end

  # A conversation started in the app belongs to the signed-in user. One that
  # arrived over a channel has no user: the sender is a phone number, kept in
  # `metadata`, and requiring `user_id` would make inbound messages impossible.
  defp validate_owner(changeset) do
    case get_field(changeset, :source) do
      "chat" -> validate_required(changeset, [:user_id])
      _channel -> changeset
    end
  end
end
