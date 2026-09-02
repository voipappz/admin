defmodule AgentsDemo.Logging.Influx.Writer do
  @moduledoc """
  Buffers log lines and POSTs them to InfluxDB in batches — the portal's
  equivalent of the node's single drain fiber in `node/influx/writer.cr`.

  Starting this process is what installs the `:influx` `:logger` handler, and
  stopping it removes the handler again, so "the writer is up" and "log lines
  are being captured" are one fact rather than two that can drift: a handler
  with no writer behind it would cast into the void, and a writer with no
  handler would flush nothing forever. Only `AgentsDemo.Logging.Influx.children/0`
  puts it in the tree, and only when `VA_MONITOR_TOKEN` is set.

  A batch goes out every `flush_ms` (2 s) or at `max_lines` (500), whichever
  comes first: big batches under load, bounded latency in a lull. One POST per
  batch, not per line — a request per log line at Phoenix's request-log rate
  is a second web server's worth of connections to keep alive for no reason.

  Best effort, deliberately. A batch that fails is DROPPED, not retried: the
  next one is already forming behind it, and a queue that grows while
  InfluxDB is down is a process that grows until the box swaps. The failure
  is reported ONCE per streak, at warning, and recovery once at info. Warning
  on every failed flush would write a line into the very log this process is
  failing to ship, every two seconds, for the whole outage — a dead InfluxDB
  must not be able to fill the portal's stdout.
  """

  use GenServer

  alias AgentsDemo.Config
  alias AgentsDemo.Logging.Influx

  require Logger

  @default_flush_ms 2_000
  @default_max_lines 500

  # ── API ─────────────────────────────────────────────────────────────────────

  @doc """
  Options — every one has the production default, so the app passes none:

    * `:name` — registered name (default `#{inspect(__MODULE__)}`)
    * `:handler_id` — the `:logger` handler to install (default `:influx`);
      `nil` installs none, for a test that feeds lines directly
    * `:flush_ms`, `:max_lines` — the batch bounds
  """
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  @doc """
  Hand one line-protocol line to the writer. A cast, so it returns at once
  whatever the writer is doing — including not existing, which is the state
  of every process for part of every shutdown.
  """
  @spec enqueue(GenServer.name() | pid(), String.t()) :: :ok
  def enqueue(writer \\ __MODULE__, line) when is_binary(line) do
    GenServer.cast(writer, {:enqueue, line})
  end

  @doc "Flush whatever is buffered now, synchronously. For tests and shutdown."
  @spec flush(GenServer.name() | pid()) :: :ok
  def flush(writer \\ __MODULE__), do: GenServer.call(writer, :flush)

  # ── GenServer ───────────────────────────────────────────────────────────────

  @impl true
  def init(opts) do
    # Trapping exits is what makes terminate/2 run on a supervisor shutdown —
    # and terminate/2 is where the handler is removed and the tail is flushed.
    Process.flag(:trap_exit, true)

    host = Config.influxdb_host()
    port = Config.influxdb_port()
    base = "http://#{host}:#{port}"

    query = URI.encode_query(db: Config.influxdb_database(), precision: "nanosecond")

    state = %{
      name: Keyword.get(opts, :name, __MODULE__),
      handler_id: Keyword.get(opts, :handler_id, Influx.handler_id()),
      flush_ms: Keyword.get(opts, :flush_ms, @default_flush_ms),
      max_lines: Keyword.get(opts, :max_lines, @default_max_lines),
      endpoint: "#{host}:#{port}",
      write_url: base <> "/api/v3/write_lp?" <> query,
      health_url: base <> "/health",
      headers: [{"authorization", "Bearer #{Config.monitor_token()}"}],
      # Newest first; reversed at flush. Prepending is O(1), and 500 lines
      # reversed every two seconds is nothing.
      lines: [],
      count: 0,
      timer: nil,
      failing: false
    }

    install_handler(state)

    # The reachability probe waits for `handle_continue`, after init has
    # returned: a 2-second timeout inside init/1 would hold the supervisor —
    # and every child after this one, the Endpoint included — for those two
    # seconds on every boot where InfluxDB is down.
    {:ok, state, {:continue, :probe}}
  end

  # `{:error, {:already_exist, _}}` is the double-start case — a restart of
  # this process while :logger still holds the previous registration — and is
  # as good as `:ok`: the handler is there, pointed at this name.
  defp install_handler(%{handler_id: nil}), do: :ok

  defp install_handler(%{handler_id: id, name: name}) do
    case :logger.add_handler(id, Influx, %{config: %{writer: name}}) do
      :ok ->
        :ok

      {:error, {:already_exist, ^id}} ->
        :ok

      {:error, reason} ->
        Logger.warning("Influx: could not install log handler: #{inspect(reason)}")
    end
  end

  @impl true
  def handle_continue(:probe, state) do
    # Modelled on the node's `StartupChecks.check_influxdb!`: one probe, one
    # clear line, never fatal. InfluxDB 3 answers `/health` with 200. The
    # message names the endpoint and the variable, because the failure that
    # actually happens is the compose default `influxdb` inside a host-network
    # container, where nothing resolves it — and that reads as "the write is
    # broken", not as "the host is wrong".
    case http().get(state.health_url, timeout: 2_000) do
      {:ok, 200} ->
        Logger.info("Influx: InfluxDB OK (#{state.endpoint})")

      {:ok, status} ->
        Logger.warning(
          "Influx: InfluxDB NOT healthy at #{state.endpoint} — /health answered #{status}. " <>
            "Portal log lines will drop until fixed (check VA_INFLUXDB_HOST / VA_INFLUXDB_PORT)."
        )

      {:error, reason} ->
        Logger.warning(
          "Influx: InfluxDB NOT reachable at #{state.endpoint} — #{describe(reason)}. " <>
            "Portal log lines will drop until fixed (set VA_INFLUXDB_HOST correctly)."
        )
    end

    {:noreply, state}
  end

  @impl true
  def handle_cast({:enqueue, line}, state) do
    state = %{state | lines: [line | state.lines], count: state.count + 1}

    cond do
      state.count >= state.max_lines ->
        {:noreply, do_flush(state)}

      state.timer == nil ->
        # The clock starts with the first line, not on a fixed tick, so a lone
        # line never waits longer than `flush_ms` and an idle process runs no
        # timer at all.
        {:noreply, %{state | timer: Process.send_after(self(), :flush, state.flush_ms)}}

      true ->
        {:noreply, state}
    end
  end

  @impl true
  def handle_info(:flush, state), do: {:noreply, do_flush(%{state | timer: nil})}

  # Anything else — a late `{:EXIT, _, _}` from a linked port, say — is not
  # a reason to crash the log shipper.
  def handle_info(_other, state), do: {:noreply, state}

  @impl true
  def handle_call(:flush, _from, state), do: {:reply, :ok, do_flush(state)}

  @impl true
  def terminate(_reason, state) do
    # Order matters: remove the handler first so the flush's own log lines are
    # not cast at a process that is about to be gone, then ship the tail. Both
    # are best effort — terminate/2 is not a place to fail from.
    if state.handler_id, do: :logger.remove_handler(state.handler_id)
    do_flush(state)
    :ok
  end

  # ── Flushing ────────────────────────────────────────────────────────────────

  defp do_flush(%{count: 0} = state), do: cancel_timer(state)

  defp do_flush(state) do
    state = cancel_timer(state)
    body = state.lines |> Enum.reverse() |> Enum.join("\n")

    failing =
      case post(state.write_url, state.headers, body) do
        :ok ->
          if state.failing, do: Logger.info("Influx: writes to #{state.endpoint} resumed")
          false

        {:error, reason} ->
          unless state.failing do
            Logger.warning(
              "Influx: write to #{state.endpoint} failed — #{reason}. Dropping this batch " <>
                "and each one after it, quietly, until a write succeeds."
            )
          end

          true
      end

    %{state | lines: [], count: 0, failing: failing}
  end

  defp post(url, headers, body) do
    case http().post(url, headers, body, connect_timeout: 2_000, receive_timeout: 5_000) do
      {:ok, status} when status in [200, 204] -> :ok
      {:ok, status} -> {:error, "HTTP #{status}"}
      {:error, reason} -> {:error, describe(reason)}
    end
  rescue
    # The HTTP module is injectable, and a stub — or a Req option we did not
    # foresee — must not take the writer down with the batch.
    error -> {:error, Exception.message(error)}
  end

  defp cancel_timer(%{timer: nil} = state), do: state

  defp cancel_timer(%{timer: ref} = state) do
    Process.cancel_timer(ref)
    %{state | timer: nil}
  end

  defp describe(%{__exception__: true} = error), do: Exception.message(error)
  defp describe(other), do: inspect(other)

  # Test seam, in the shape this project uses for every outbound dependency
  # (`:api_relay`, `:whatsapp_adapter`): a stub that records the call.
  defp http, do: Application.get_env(:agents_demo, :influx_http, Influx.HTTP)
end
