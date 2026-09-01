defmodule AgentsDemo.Controls.BusinessHours do
  @moduledoc """
  Whether a bot is "in hours" — a deterministic control, never a model
  decision.

  Evaluated in the version's own time zone against its `Availability`
  windows. A version with no windows is always open. The pure two-argument
  form takes the clock, so tests pass fixed instants and DST edges are
  checked rather than assumed.
  """

  alias AgentsDemo.Bots.Version.Availability
  alias AgentsDemo.Bots.Version.Availability.Window

  @spec open?(Availability.t() | nil) :: boolean()
  def open?(availability), do: open?(availability, DateTime.utc_now())

  @spec open?(Availability.t() | nil, DateTime.t()) :: boolean()
  def open?(nil, _now), do: true
  def open?(%Availability{windows: []}, _now), do: true

  def open?(%Availability{time_zone: zone, windows: windows}, %DateTime{} = now) do
    case DateTime.shift_zone(now, zone || "UTC") do
      {:ok, local} ->
        day = local |> DateTime.to_date() |> Date.day_of_week()
        minute = local.hour * 60 + local.minute
        Enum.any?(windows, &matches?(&1, day, minute))

      {:error, _unknown_zone} ->
        false
    end
  end

  defp matches?(%Window{} = window, day, minute) do
    day in Window.day_numbers(window) and minute >= window.start_minute and
      minute < window.end_minute
  end
end
