defmodule AgentsDemo.Controls.BusinessHoursTest do
  use ExUnit.Case, async: true

  alias AgentsDemo.Bots.Version.Availability
  alias AgentsDemo.Controls.BusinessHours

  # Nimbus Telecom's published hours: Sun–Thu 09:00–18:00, Fri 09:00–14:00.
  defp nimbus do
    %Availability{
      time_zone: "Asia/Jerusalem",
      windows:
        Enum.map(
          [:sunday, :monday, :tuesday, :wednesday, :thursday],
          &%Availability.Window{day: &1, start_minute: 540, end_minute: 1080}
        ) ++
          [%Availability.Window{day: :friday, start_minute: 540, end_minute: 840}]
    }
  end

  defp at(date, time) do
    {:ok, dt} = DateTime.new(date, time, "Asia/Jerusalem")
    dt
  end

  test "no availability, or no windows, is always open" do
    assert BusinessHours.open?(nil, DateTime.utc_now())
    assert BusinessHours.open?(%Availability{windows: []}, DateTime.utc_now())
  end

  test "weekday hours" do
    # 2026-08-30 is a Sunday.
    refute BusinessHours.open?(nimbus(), at(~D[2026-08-30], ~T[08:59:00]))
    assert BusinessHours.open?(nimbus(), at(~D[2026-08-30], ~T[09:00:00]))
    assert BusinessHours.open?(nimbus(), at(~D[2026-09-03], ~T[17:59:00]))
    refute BusinessHours.open?(nimbus(), at(~D[2026-09-03], ~T[18:00:00]))
  end

  test "friday closes early and saturday is closed" do
    assert BusinessHours.open?(nimbus(), at(~D[2026-09-04], ~T[13:59:00]))
    refute BusinessHours.open?(nimbus(), at(~D[2026-09-04], ~T[14:00:00]))
    refute BusinessHours.open?(nimbus(), at(~D[2026-09-05], ~T[11:00:00]))
  end

  test "the window is read in the bot's zone, not the server's" do
    # 07:30 UTC on a Sunday is 10:30 in Jerusalem: open there, before hours in UTC.
    utc = DateTime.new!(~D[2026-08-30], ~T[07:30:00], "Etc/UTC")
    assert BusinessHours.open?(nimbus(), utc)
    refute BusinessHours.open?(%{nimbus() | time_zone: "Etc/UTC"}, utc)
  end

  test "split shifts are two windows on one day" do
    availability = %Availability{
      time_zone: "Asia/Jerusalem",
      windows: [
        %Availability.Window{day: :monday, start_minute: 540, end_minute: 720},
        %Availability.Window{day: :monday, start_minute: 900, end_minute: 1080}
      ]
    }

    assert BusinessHours.open?(availability, at(~D[2026-08-31], ~T[10:00:00]))
    refute BusinessHours.open?(availability, at(~D[2026-08-31], ~T[13:00:00]))
    assert BusinessHours.open?(availability, at(~D[2026-08-31], ~T[16:00:00]))
  end

  test "an unknown time zone is closed rather than crashing" do
    refute BusinessHours.open?(%{nimbus() | time_zone: "Mars/Olympus"}, DateTime.utc_now())
  end
end
