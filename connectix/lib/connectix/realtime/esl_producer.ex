defmodule Connectix.Realtime.EslProducer do
  @moduledoc """
  Broadway producer for the FreeSWITCH Event Socket.

  Owns the ESL connection (`FreeSwitch.connect/1` runs in this process, so
  `switchx` delivers `{:switchx_event, _}` here), buffers events behind
  Broadway demand with a bounded queue that drops the OLDEST on overflow, and
  reconnects with exponential backoff (1 s → 30 s).

  Loss is noticed three ways, since the client library reports none of them
  to its owner: the connection process exits (monitored), the socket port
  closes (monitored; the library swallows `tcp_closed`), or a
  `text/disconnect-notice` arrives as an event.

  `status/0`, `last_message_at/0`, `subscribed_at/0` and `silent_ms/0` are
  `:persistent_term` / `:atomics` reads for `/health` and the deadman.
  `HEARTBEAT` moves the clock and is not emitted.

  Options: `:settings` (required; `FreeSwitch.settings/0`), `:connect`,
  `:disconnect` (test seams), `:max_buffer`.
  """

  use GenStage
  @behaviour Broadway.Producer

  require Logger

  alias Broadway.Message
  alias Connectix.Realtime.FreeSwitch
  alias Connectix.Telemetry

  @status_key {__MODULE__, :status}
  @pid_key {__MODULE__, :pid}
  @clock_key {__MODULE__, :clock}
  @last_slot 1
  @connected_slot 2
  @default_max_buffer 10_000
  @retry_base 1_000
  @retry_max 30_000

  @opts_schema [
    settings: [type: :map, required: true],
    connect: [type: {:fun, 1}, default: &FreeSwitch.connect/1],
    disconnect: [type: {:fun, 1}, default: &FreeSwitch.close/1],
    max_buffer: [type: :pos_integer, default: @default_max_buffer]
  ]

  @spec status() :: :not_started | :connecting | :disconnected | {:subscribed, [String.t()]}
  def status, do: :persistent_term.get(@status_key, :not_started)

  @spec last_message_at() :: integer() | nil
  def last_message_at, do: read(@last_slot)

  @spec subscribed_at() :: integer() | nil
  def subscribed_at, do: read(@connected_slot)

  @doc "Milliseconds since the later of the last event and the connection; nil when not connected."
  @spec silent_ms() :: non_neg_integer() | nil
  def silent_ms do
    with {:subscribed, _events} <- status(),
         since when is_integer(since) <- latest(last_message_at(), subscribed_at()) do
      max(System.system_time(:millisecond) - since, 0)
    else
      _ -> nil
    end
  end

  defp latest(nil, b), do: b
  defp latest(a, nil), do: a
  defp latest(a, b), do: max(a, b)

  defp read(slot) do
    case :persistent_term.get(@clock_key, nil) do
      nil -> nil
      clock -> case(:atomics.get(clock, slot), do: (0 -> nil; at -> at))
    end
  end

  @doc "Drop the connection and make it again (the cockpit's `c`)."
  @spec reconnect() :: :ok
  def reconnect do
    case pid() do
      p when is_pid(p) -> if Process.alive?(p), do: GenStage.cast(p, :reconnect), else: :ok
      _ -> :ok
    end
  catch
    :exit, _ -> :ok
  end

  @doc false
  def pid, do: :persistent_term.get(@pid_key, nil)

  @impl GenStage
  def init(opts) do
    # Broadway hands its producer the whole pipeline configuration under
    # `:broadway`; it is not one of ours and must not fail validation.
    {_broadway, opts} = Keyword.pop(opts, :broadway)
    opts = NimbleOptions.validate!(opts, @opts_schema)
    clock = :atomics.new(2, signed: false)

    state = %{
      settings: opts[:settings],
      connect: opts[:connect],
      disconnect: opts[:disconnect],
      max_buffer: opts[:max_buffer],
      link: nil,
      monitors: [],
      attempts: 0,
      demand: 0,
      queue: :queue.new(),
      size: 0,
      overflowing?: false,
      clock: clock
    }

    # Trapping exits is what makes terminate/2 run on a supervisor shutdown,
    # so a stopped pipeline cannot go on reporting `{:subscribed, _}`.
    Process.flag(:trap_exit, true)
    :persistent_term.put(@clock_key, clock)
    :persistent_term.put(@pid_key, self())
    put_status(:connecting)
    send(self(), :connect)
    {:producer, state}
  end

  @impl GenStage
  def handle_demand(incoming, state), do: dispatch(%{state | demand: state.demand + incoming})

  @impl GenStage
  def handle_cast(:reconnect, state) do
    state = drop_link(state)
    send(self(), :connect)
    {:noreply, [], %{state | attempts: 0}}
  end

  @impl GenStage
  def handle_info(:connect, %{link: nil} = state) do
    case state.connect.(state.settings) do
      {:ok, %{conn: conn} = link} ->
        Logger.info(
          "freeswitch: connected to #{FreeSwitch.address(state.settings)}, " <>
            "listening for #{Enum.join(state.settings.events, ", ")}"
        )

        :atomics.put(state.clock, @connected_slot, System.system_time(:millisecond))
        put_status({:subscribed, state.settings.events})
        {:noreply, [], %{state | link: link, monitors: watch(conn, link[:socket]), attempts: 0}}

      {:error, reason} ->
        Logger.warning("freeswitch: connect to #{FreeSwitch.address(state.settings)} failed — #{inspect(reason)}")
        {:noreply, [], schedule_retry(state)}
    end
  end

  # Already connected: a stale retry timer from before a reconnect.
  def handle_info(:connect, state), do: {:noreply, [], state}

  def handle_info({:DOWN, ref, _kind, _object, reason}, %{monitors: monitors} = state)
      when is_list(monitors) do
    if ref in monitors, do: lost(state, reason), else: {:noreply, [], state}
  end

  def handle_info({:switchx_event, %{headers: %{"Content-Type" => "text/disconnect-notice"}}}, state),
    do: lost(state, :disconnect_notice)

  def handle_info({:switchx_event, %{headers: %{"Event-Name" => "HEARTBEAT"}}}, state) do
    tick(state)
    {:noreply, [], state}
  end

  def handle_info({:switchx_event, %{headers: %{"Event-Name" => name} = headers}}, state) do
    tick(state)

    message = %Message{
      data: headers,
      metadata: %{
        event_name: name,
        subclass: Map.get(headers, "Event-Subclass"),
        received_at: System.system_time(:millisecond)
      },
      acknowledger: Broadway.NoopAcknowledger.init()
    }

    state |> enqueue(message) |> dispatch()
  end

  # Command replies and EXITs from a connection we already closed.
  def handle_info(_other, state), do: {:noreply, [], state}

  @impl GenStage
  def terminate(_reason, state) do
    drop_link(state)
    :persistent_term.put(@status_key, :not_started)
    :persistent_term.erase(@pid_key)
    :persistent_term.erase(@clock_key)
    :ok
  end

  @impl Broadway.Producer
  def prepare_for_draining(state) do
    state = drop_link(state)
    put_status(:disconnected)
    {:noreply, [], state}
  end

  # ── connection ───────────────────────────────────────────────────────────

  defp tick(state) do
    Telemetry.esl_event(:received)
    :atomics.put(state.clock, @last_slot, System.system_time(:millisecond))
  end

  defp watch(conn, socket) do
    [Process.monitor(conn)] ++ if(is_port(socket), do: [Port.monitor(socket)], else: [])
  end

  defp lost(state, reason) do
    Logger.warning("freeswitch: connection lost (#{inspect(reason)}) — reconnecting")
    state = drop_link(state)
    put_status(:disconnected)
    send(self(), :connect)
    {:noreply, [], state}
  end

  defp drop_link(%{link: nil} = state), do: state

  defp drop_link(%{link: link, monitors: monitors} = state) do
    Enum.each(monitors, &Process.demonitor(&1, [:flush]))

    try do
      state.disconnect.(link)
    catch
      :exit, _ -> :ok
    end

    %{state | link: nil, monitors: []}
  end

  defp schedule_retry(state) do
    attempts = state.attempts + 1
    delay = min(@retry_base * :math.pow(2, attempts - 1), @retry_max) |> trunc()
    Process.send_after(self(), :connect, delay)
    %{state | attempts: attempts}
  end

  # ── buffering ────────────────────────────────────────────────────────────

  defp enqueue(%{size: size, max_buffer: max} = state, message) when size >= max do
    Telemetry.esl_event(:dropped)

    unless state.overflowing? do
      Logger.warning("freeswitch: buffer full at #{max} events — dropping the oldest until the pipeline catches up")
    end

    {_dropped, queue} = :queue.out(state.queue)
    %{state | queue: :queue.in(message, queue), overflowing?: true}
  end

  defp enqueue(state, message),
    do: %{state | queue: :queue.in(message, state.queue), size: state.size + 1}

  defp dispatch(state), do: dispatch(state, [])
  defp dispatch(%{demand: 0} = state, acc), do: emit(state, acc)
  defp dispatch(%{size: 0} = state, acc), do: emit(state, acc)

  defp dispatch(state, acc) do
    {{:value, message}, queue} = :queue.out(state.queue)
    dispatch(%{state | queue: queue, size: state.size - 1, demand: state.demand - 1}, [message | acc])
  end

  # Hysteresis: the overflow flag clears at half the bound, not one under it.
  defp emit(state, acc) do
    state =
      if state.overflowing? and state.size <= div(state.max_buffer, 2) do
        Logger.info("freeswitch: buffer drained — no longer dropping")
        %{state | overflowing?: false}
      else
        state
      end

    {:noreply, Enum.reverse(acc), state}
  end

  defp put_status(status), do: :persistent_term.put(@status_key, status)
end
