defmodule Connectix.Bots.Version.Availability.Window do
  @moduledoc "One span of open time on one day, in minutes since midnight."
  @derive Jason.Encoder
  defstruct [:day, :start_minute, :end_minute]

  @days ~w(monday tuesday wednesday thursday friday saturday sunday weekdays weekends everyday)a
  @day_numbers %{
    monday: [1], tuesday: [2], wednesday: [3], thursday: [4], friday: [5],
    saturday: [6], sunday: [7], weekdays: [1, 2, 3, 4, 5], weekends: [6, 7],
    everyday: [1, 2, 3, 4, 5, 6, 7]
  }

  def days, do: @days

  def new(attrs) do
    m = Connectix.Bots.Version.take(attrs, %__MODULE__{}, [:day, :start_minute, :end_minute])
    day = to_day(m.day)

    errors =
      %{}
      |> req(:day, day)
      |> req(:start_minute, m.start_minute)
      |> req(:end_minute, m.end_minute)
      |> Connectix.Bots.Version.range(:start_minute, m.start_minute, gte: 0, lte: 1439)
      |> Connectix.Bots.Version.range(:end_minute, m.end_minute, gt: 0, lte: 1440)
      |> order(m.start_minute, m.end_minute)

    Connectix.Bots.Version.done(errors, %__MODULE__{day: day, start_minute: m.start_minute, end_minute: m.end_minute})
  end

  @doc "ISO day numbers (Monday = 1) this window applies to."
  def day_numbers(%__MODULE__{day: day}), do: Map.fetch!(@day_numbers, day)

  defp to_day(day) when day in @days, do: day
  defp to_day(day) when is_binary(day) do
    atom = String.to_existing_atom(day)
    if atom in @days, do: atom, else: nil
  rescue
    ArgumentError -> nil
  end
  defp to_day(_), do: nil

  defp req(errors, field, value) when value in [nil, ""], do: Map.put(errors, field, ["can't be blank"])
  defp req(errors, _f, _v), do: errors

  defp order(errors, s, e) when is_integer(s) and is_integer(e) and s >= e,
    do: Map.put(errors, :end_minute, ["must be after start_minute"])
  defp order(errors, _s, _e), do: errors
end
