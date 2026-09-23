defmodule ConnectixWeb.Telemetry do
  use Supervisor
  import Telemetry.Metrics

  def start_link(arg) do
    Supervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @impl true
  def init(_arg) do
    children = [
      # Telemetry poller will execute the given period measurements
      # every 10_000ms. Learn more here: https://hexdocs.pm/telemetry_metrics
      {:telemetry_poller, measurements: periodic_measurements(), period: 10_000},
      {TelemetryMetricsPrometheus.Core, metrics: prometheus_metrics(), name: :connectix_metrics}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  def metrics do
    [
      # Phoenix Metrics
      summary("phoenix.endpoint.start.system_time",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.endpoint.stop.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.start.system_time",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.exception.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.stop.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.socket_connected.duration",
        unit: {:native, :millisecond}
      ),
      sum("phoenix.socket_drain.count"),
      summary("phoenix.channel_joined.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.channel_handled_in.duration",
        tags: [:event],
        unit: {:native, :millisecond}
      ),

      # Database Metrics
      summary("connectix.repo.query.total_time",
        unit: {:native, :millisecond},
        description: "The sum of the other measurements"
      ),
      summary("connectix.repo.query.decode_time",
        unit: {:native, :millisecond},
        description: "The time spent decoding the data received from the database"
      ),
      summary("connectix.repo.query.query_time",
        unit: {:native, :millisecond},
        description: "The time spent executing the query"
      ),
      summary("connectix.repo.query.queue_time",
        unit: {:native, :millisecond},
        description: "The time spent waiting for a database connection"
      ),
      summary("connectix.repo.query.idle_time",
        unit: {:native, :millisecond},
        description:
          "The time the connection spent waiting before being checked out for the query"
      ),
      counter("connectix.screen_pop.events.count",
        event_name: [:connectix, :screen_pop, :event],
        tags: [:result],
        description: "Screen-pop events by processing outcome"
      ),
      counter("connectix.screen_pop.instruction_loads.count",
        event_name: [:connectix, :screen_pop, :instruction_load],
        tags: [:result],
        description: "Screen-pop instruction loads by outcome"
      ),
      counter("connectix.esl.events.count",
        event_name: [:connectix, :esl, :event],
        tags: [:result],
        description: "FreeSWITCH events by outcome: received, dropped (buffer full), undecodable"
      ),

      # A call has four places it can silently stop: RTP never arrives, the
      # bridge never forwards it, the transcriber drops the socket, or the
      # voice never comes back. Without these, all four present identically —
      # as a caller hearing nothing — and the only way to tell them apart was
      # to attach a console to a live call and guess. Each is a counter so the
      # question "where did the audio stop" is answerable after the fact.
      counter("connectix.call.audio.count",
        event_name: [:connectix, :call, :audio],
        tags: [:direction],
        description: "Call audio frames, inbound from SIP and outbound to it"
      ),
      counter("connectix.call.stt.count",
        event_name: [:connectix, :call, :stt],
        tags: [:event],
        description: "Speech-to-text lifecycle: connected, closed, transcript"
      ),
      counter("connectix.call.sip.count",
        event_name: [:connectix, :call, :sip],
        tags: [:event],
        description: "SIP call lifecycle by outcome"
      ),

      # HOST AND VM — the numbers an external monitor alerts on. `last_value`
      # rather than `summary`: a gauge is what "how full is the disk right
      # now" means, and averaging it across a scrape window hides the spike.
      last_value("connectix.system.disk_free_percent",
        description: "Free space on the data volume, percent"
      ),
      last_value("connectix.system.disk_free_bytes",
        description: "Free space on the data volume"
      ),
      last_value("connectix.system.disk_total_bytes", description: "Size of the data volume"),
      last_value("connectix.system.disk_used_percent", description: "Used space, percent"),
      last_value("connectix.system.cpu_load1", description: "1-minute load average"),
      last_value("connectix.system.cpu_load5", description: "5-minute load average"),
      last_value("connectix.system.cpu_load15", description: "15-minute load average"),
      last_value("connectix.system.cpu_util_percent", description: "CPU busy since last sample"),
      last_value("connectix.system.mem_system_total_bytes", description: "Host memory"),
      last_value("connectix.system.mem_system_free_bytes", description: "Host memory free"),
      last_value("connectix.system.mem_beam_total_bytes", description: "BEAM memory"),
      last_value("connectix.system.mem_beam_processes_bytes", description: "BEAM process memory"),
      last_value("connectix.system.mem_beam_binary_bytes", description: "BEAM binary memory"),
      last_value("connectix.system.mem_beam_ets_bytes", description: "BEAM ETS memory"),
      last_value("connectix.system.process_count", description: "Live processes"),
      last_value("connectix.system.process_limit", description: "Process limit"),
      last_value("connectix.system.port_count", description: "Open ports"),
      last_value("connectix.system.run_queue", description: "Total run queue length"),
      last_value("connectix.system.uptime_seconds", description: "Node uptime"),
      last_value("connectix.system.events_store_open",
        description: "1 when the DuckDB event store is open, 0 when it is not"
      ),
      last_value("connectix.system.events_db_bytes", description: "Size of the event store file"),

      # VM Metrics
      summary("vm.memory.total", unit: {:byte, :kilobyte}),
      summary("vm.total_run_queue_lengths.total"),
      summary("vm.total_run_queue_lengths.cpu"),
      summary("vm.total_run_queue_lengths.io")
    ]
  end

  def prometheus_metrics do
    Enum.filter(metrics(), fn metric ->
      match?([:connectix, :screen_pop | _rest], metric.name) or
        match?([:connectix, :esl | _rest], metric.name) or
        match?([:connectix, :call | _rest], metric.name) or
        match?([:connectix, :system | _rest], metric.name)
    end)
  end

  defp periodic_measurements do
    [
      # Host and VM sampling — disk, CPU, memory, BEAM counts, event store.
      # See `Connectix.SystemMetrics`: `:os_mon` is already measuring these on
      # its own timers, so this reads them rather than shelling out, and the
      # portal needs no telegraf or node_exporter beside it.
      {Connectix.SystemMetrics, :dispatch, []}
    ]
  end
end
