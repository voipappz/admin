defmodule Connectix.SystemMetrics do
  @moduledoc """
  Host and VM measurements, sampled on the telemetry poller.

  The portal already exposes `/metrics`, but only what it does — screen pops,
  calls, VM memory. Nothing said how much disk was left, and that is the number
  that ends a deployment: the DuckDB event store and Mnesia share one volume,
  a live switch writes ~556MB of raw JSON a day, and when the volume fills the
  conversation store goes with the events. nimbus-connectix sat at 71% used
  with `/health/ready` answering 200, which it would also have done at 99%.

  This is a collector rather than an agent on purpose. `:os_mon` is OTP — it is
  already sampling disk, memory and CPU on its own timers — so reading it costs
  a table lookup and needs no telegraf, no node_exporter, and nothing else to
  install, upgrade or watch. An external monitor scrapes `/metrics`, or polls
  `/health` and reads the same numbers as JSON.
  """

  @doc """
  Sample everything and emit it as one telemetry event.

  Called by `:telemetry_poller`; see `ConnectixWeb.Telemetry`.
  """
  def dispatch do
    :telemetry.execute([:connectix, :system], measurements(), %{})
  rescue
    # A metrics collector must never be the thing that takes the node down.
    _ -> :ok
  catch
    _, _ -> :ok
  end

  @doc "The current sample, also used by `/health` so both agree."
  @spec measurements() :: map()
  def measurements do
    Map.merge(%{}, disk())
    |> Map.merge(cpu())
    |> Map.merge(memory())
    |> Map.merge(beam())
    |> Map.merge(events())
  end

  defp disk do
    case Connectix.Disk.usage() do
      nil ->
        %{}

      %{total_bytes: total, free_bytes: free, free_percent: pct, used_percent: used} ->
        %{
          disk_total_bytes: total,
          disk_free_bytes: free,
          disk_free_percent: pct,
          disk_used_percent: used
        }
    end
  end

  defp cpu do
    # `avg1/5/15` are the load averages scaled by 256, and `util/0` is the
    # percentage busy SINCE THE LAST CALL — which is why it belongs on a timer
    # rather than being sampled inside a request.
    %{
      cpu_load1: :cpu_sup.avg1() / 256,
      cpu_load5: :cpu_sup.avg5() / 256,
      cpu_load15: :cpu_sup.avg15() / 256,
      cpu_util_percent: cpu_util()
    }
  rescue
    _ -> %{}
  catch
    _, _ -> %{}
  end

  defp cpu_util do
    case :cpu_sup.util() do
      util when is_float(util) -> util
      util when is_integer(util) -> util * 1.0
      _ -> 0.0
    end
  rescue
    _ -> 0.0
  catch
    _, _ -> 0.0
  end

  defp memory do
    system =
      try do
        Map.new(:memsup.get_system_memory_data())
      rescue
        _ -> %{}
      catch
        _, _ -> %{}
      end

    beam = :erlang.memory()

    %{
      mem_system_total_bytes: Map.get(system, :total_memory, 0),
      mem_system_free_bytes: Map.get(system, :free_memory, 0),
      mem_beam_total_bytes: Keyword.get(beam, :total, 0),
      mem_beam_processes_bytes: Keyword.get(beam, :processes, 0),
      mem_beam_binary_bytes: Keyword.get(beam, :binary, 0),
      mem_beam_ets_bytes: Keyword.get(beam, :ets, 0)
    }
  end

  defp beam do
    %{
      process_count: :erlang.system_info(:process_count),
      process_limit: :erlang.system_info(:process_limit),
      port_count: :erlang.system_info(:port_count),
      run_queue: :erlang.statistics(:total_run_queue_lengths),
      uptime_seconds: div(elem(:erlang.statistics(:wall_clock), 0), 1000)
    }
  end

  # The store's own health, without a GenServer call — `stats/0` can block for
  # its full 15s timeout behind a slow query, and a collector on a 10s timer
  # must not queue up behind that.
  defp events do
    path =
      Connectix.Config.events_db() ||
        Path.join(Connectix.Config.events_dir(), "events.duckdb")

    size =
      case File.stat(path) do
        {:ok, %{size: s}} -> s
        _ -> 0
      end

    %{
      events_store_open: if(Connectix.Events.open?(), do: 1, else: 0),
      events_db_bytes: size
    }
  end
end
