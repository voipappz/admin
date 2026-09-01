defmodule AgentsDemo.Bots.Version.Availability do
  @moduledoc """
  When the bot counts as "in hours".

  Borrowed from Papercups' account working hours: a time zone plus windows of
  `{day, start_minute, end_minute}`. Unlike Papercups, *any* window matching
  the day counts, so a split shift is two windows on the same day. No
  windows means always open. The predicate lives in
  `AgentsDemo.Controls.BusinessHours`; this module only holds the data.
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias __MODULE__.Window

  @primary_key false
  embedded_schema do
    field :time_zone, :string, default: "UTC"
    embeds_many :windows, Window, on_replace: :delete
  end

  def changeset(availability, attrs) do
    availability
    |> cast(attrs, [:time_zone])
    |> validate_time_zone()
    |> cast_embed(:windows)
  end

  defp validate_time_zone(changeset) do
    validate_change(changeset, :time_zone, fn :time_zone, zone ->
      case DateTime.now(zone) do
        {:ok, _now} -> []
        {:error, _unknown} -> [time_zone: "is not a known IANA time zone"]
      end
    end)
  end
end
