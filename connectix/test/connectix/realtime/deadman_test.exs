defmodule Connectix.Realtime.DeadmanTest do
  @moduledoc """
  The alarm for the failure that reports itself as healthy.

  `evaluate/2` is pure, so every case here is the decision itself rather than a
  broker, a clock and a process arranged to produce it.
  """

  use ExUnit.Case, async: true

  alias Connectix.Realtime.Deadman

  describe "evaluate/2" do
    test "silence under the threshold is not an alarm" do
      assert Deadman.evaluate(0, 900_000) == :ok
      assert Deadman.evaluate(899_999, 900_000) == :ok
    end

    test "silence past the threshold alarms" do
      assert {:alarm, _message} = Deadman.evaluate(900_000, 900_000)
      assert {:alarm, _message} = Deadman.evaluate(3_600_000, 900_000)
    end

    test "no subscription is not silence, and must not alarm" do
      # `silent_ms/0` answers nil when nothing is subscribed. The subscription
      # check already reports that, and an outage that fires two alarms reads
      # as two faults — so this one stands down.
      assert Deadman.evaluate(nil, 900_000) == :ok
    end

    test "a zero threshold disables it, however long the silence" do
      assert Deadman.evaluate(86_400_000, 0) == :ok
    end

    test "the message says how long, on which subjects, and what it costs" do
      # It is pushed to Uptime Kuma verbatim and read by somebody who was not
      # looking at the portal when it fired, so it has to stand on its own.
      {:alarm, message} = Deadman.evaluate(1_800_000, 900_000)

      assert message =~ "30m"
      assert message =~ "15m"
      assert message =~ "Screen pops are not firing"
    end
  end

  describe "humanize/1" do
    test "reads as a duration rather than a number of milliseconds" do
      assert Deadman.humanize(45_000) == "45s"
      assert Deadman.humanize(960_000) == "16m"
      assert Deadman.humanize(3_600_000) == "1h"
      assert Deadman.humanize(3_840_000) == "1h 4m"
    end

    test "a whole number of hours does not print a trailing 0m" do
      assert Deadman.humanize(7_200_000) == "2h"
    end
  end
end
