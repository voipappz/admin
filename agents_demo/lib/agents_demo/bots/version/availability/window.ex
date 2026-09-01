defmodule AgentsDemo.Bots.Version.Availability.Window do
  @moduledoc """
  One span of open time on one day, in minutes since midnight.
  """

  use Ecto.Schema
  import Ecto.Changeset

  @days ~w(monday tuesday wednesday thursday friday saturday sunday weekdays weekends everyday)a

  @day_numbers %{
    monday: [1],
    tuesday: [2],
    wednesday: [3],
    thursday: [4],
    friday: [5],
    saturday: [6],
    sunday: [7],
    weekdays: [1, 2, 3, 4, 5],
    weekends: [6, 7],
    everyday: [1, 2, 3, 4, 5, 6, 7]
  }

  @primary_key false
  embedded_schema do
    field :day, Ecto.Enum, values: @days
    field :start_minute, :integer
    field :end_minute, :integer
  end

  def changeset(window, attrs) do
    window
    |> cast(attrs, [:day, :start_minute, :end_minute])
    |> validate_required([:day, :start_minute, :end_minute])
    |> validate_number(:start_minute, greater_than_or_equal_to: 0, less_than: 1440)
    |> validate_number(:end_minute, greater_than: 0, less_than_or_equal_to: 1440)
    |> validate_order()
  end

  @doc "ISO day numbers (Monday = 1) this window applies to."
  def day_numbers(%__MODULE__{day: day}), do: Map.fetch!(@day_numbers, day)

  defp validate_order(changeset) do
    start_minute = get_field(changeset, :start_minute)
    end_minute = get_field(changeset, :end_minute)

    if is_integer(start_minute) and is_integer(end_minute) and start_minute >= end_minute do
      add_error(changeset, :end_minute, "must be after start_minute")
    else
      changeset
    end
  end
end
