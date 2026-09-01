defmodule AgentsDemo.Bots.Version.Output do
  @moduledoc """
  The shape of a reply: free text or a structured schema, and any
  presentation rules per channel.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @formats ~w(text json)

  @primary_key false
  embedded_schema do
    field :format, :string, default: "text"
    field :json_schema, :map
    field :max_reply_chars, :integer
  end

  def changeset(output, attrs) do
    output
    |> cast(attrs, [:format, :json_schema, :max_reply_chars])
    |> validate_inclusion(:format, @formats)
    |> validate_number(:max_reply_chars, greater_than: 0)
  end
end
