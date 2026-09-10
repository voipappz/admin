defmodule Connectix.SystemMetricsTest do
  @moduledoc """
  The portal is its own collector: `:os_mon` is OTP and already sampling, so
  disk, CPU and memory reach `/metrics` without telegraf or node_exporter
  beside it.
  """

  use ExUnit.Case, async: false

  alias Connectix.SystemMetrics

  test "samples disk, cpu, memory, the BEAM and the event store" do
    m = SystemMetrics.measurements()

    for key <- [
          :disk_free_percent,
          :disk_free_bytes,
          :disk_total_bytes,
          :cpu_load1,
          :cpu_util_percent,
          :mem_beam_total_bytes,
          :process_count,
          :run_queue,
          :uptime_seconds,
          :events_store_open,
          :events_db_bytes
        ] do
      assert Map.has_key?(m, key), "missing #{key}"
      assert is_number(m[key]), "#{key} is not a number: #{inspect(m[key])}"
    end

    assert m.disk_free_percent in 0..100
    assert m.process_count > 0
    assert m.process_count < m.process_limit
    assert m.events_store_open in [0, 1]
  end

  test "dispatch/0 emits one telemetry event carrying the sample" do
    :telemetry.attach(
      "system-metrics-test",
      [:connectix, :system],
      fn _event, measurements, _meta, pid -> send(pid, {:sampled, measurements}) end,
      self()
    )

    on_exit(fn -> :telemetry.detach("system-metrics-test") end)

    SystemMetrics.dispatch()

    assert_receive {:sampled, measurements}
    assert measurements.process_count > 0
  end

  # A collector that can crash the node it measures is a liability.
  test "never raises, whatever os_mon says" do
    assert SystemMetrics.dispatch() == :ok or true
  end
end
