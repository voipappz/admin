defmodule Connectix.Realtime.NatsProducer do
  @moduledoc """
  A Broadway producer fed by core NATS subscriptions.

  Core NATS is fire-and-forget: the broker pushes every message on a subject
  to every subscriber the moment it is published, and there is nothing to
  acknowledge or replay. So this producer is the buffer between a firehose
  that will not wait and a pipeline that pulls on demand:

    * a message arriving while a processor is asking for one is handed over
      at once;
    * otherwise it is queued until the next demand;
    * and the queue is bounded (`:max_buffer`, default #{10_000}). When the
      pipeline cannot keep up, the OLDEST queued message is dropped and
      counted (`connectix_nats_messages_count{result="dropped"}`), because a
      screen pop for a call that ended a minute ago is worth less than one
      for the call ringing now — and an unbounded queue is a slow way to run
      out of memory that presents as pops arriving later and later.

  ## Subscriptions follow the connection

  A NATS subscription belongs to the connection process that made it, and
  `Gnat.ConnectionSupervisor` replaces that process on every reconnect. The
  producer monitors the connection and re-subscribes when it goes down; at
  boot it retries until the connection has registered its name. Either way a
  message published while there was no subscription is gone. JetStream is how
  that is fixed when it matters; a core subscription cannot.

  `status/0` is a `:persistent_term` read so `/health` can ask without a call
  into a process that may be busy draining a burst.

  ## Options

    * `:subjects` — required, the subjects to subscribe to (wildcards allowed);
    * `:connection` — the `Gnat` connection name or pid, default
      `Realtime.Nats.connection/0`;
    * `:subscribe` / `:unsubscribe` — functions standing in for `Gnat.sub/3`
      and `Gnat.unsub/2`, for tests;
    * `:max_buffer` — the bound on queued messages.
  """

  use GenStage
  @behaviour Broadway.Producer

  require Logger

  alias Broadway.Message
  alias Connectix.Telemetry

  @status_key {__MODULE__, :status}
  @default_max_buffer 10_000
  @retry_base 1_000
  @retry_max 30_000

  @doc """
  `:not_started`, `:connecting`, `{:subscribed, subjects}` or `:disconnected`.
  """
  @spec status() :: :not_started | :connecting | :disconnected | {:subscribed, [String.t()]}
  def status, do: :persistent_term.get(@status_key, :not_started)

  @doc """
  Drop the current subscription and take it again.

  For the cockpit, and for the case the status says subscribed while the
  broker disagrees — there is no frame that reports that, so the only move is
  to ask again.
  """
  @spec resubscribe(GenServer.server()) :: :ok
  def resubscribe(server \\ __MODULE__) do
    GenStage.cast(server, :resubscribe)
  catch
    :exit, _ -> :ok
  end

  @impl GenStage
  def init(opts) do
    subjects = Keyword.fetch!(opts, :subjects)

    # Named so the cockpit and /health can reach it without knowing Broadway's
    # generated name. `:ignore` when a test runs a second one.
    try do
      Process.register(self(), __MODULE__)
    rescue
      ArgumentError -> :already_named
    end

    state = %{
      subjects: subjects,
      connection: Keyword.get(opts, :connection, Connectix.Realtime.Nats.connection()),
      subscribe: Keyword.get(opts, :subscribe, &Gnat.sub/3),
      unsubscribe: Keyword.get(opts, :unsubscribe, &Gnat.unsub/2),
      max_buffer: Keyword.get(opts, :max_buffer, @default_max_buffer),
      demand: 0,
      queue: :queue.new(),
      size: 0,
      sids: [],
      conn: nil,
      monitor: nil,
      attempts: 0,
      # Set while the buffer is full so the overflow is one warning per
      # episode, not one per dropped message — at firehose rates the log
      # would otherwise be the thing that cannot keep up.
      overflowing?: false
    }

    put_status(:connecting)
    send(self(), :subscribe)
    {:producer, state}
  end

  @impl GenStage
  def handle_demand(incoming, state) do
    dispatch(%{state | demand: state.demand + incoming})
  end

  @impl GenStage
  def handle_cast(:resubscribe, state) do
    unsubscribe(state)
    send(self(), :subscribe)
    {:noreply, [], %{state | sids: [], attempts: 0}}
  end

  @impl GenStage
  def handle_info(:subscribe, state) do
    case GenServer.whereis(state.connection) do
      pid when is_pid(pid) ->
        # A name never resolves to a dead process, but a pid handed in
        # directly (tests) can be one.
        if Process.alive?(pid) do
          subscribe_all(pid, state)
        else
          {:noreply, [], schedule_retry(state)}
        end

      _not_registered ->
        # The connection supervisor registers the name only once the socket
        # is up, so at boot — or while the broker is away — this is expected.
        {:noreply, [], schedule_retry(state)}
    end
  end

  def handle_info({:DOWN, ref, :process, _pid, reason}, %{monitor: ref} = state) do
    Logger.warning("nats: connection lost (#{inspect(reason)}) — re-subscribing when it returns")
    put_status(:disconnected)
    send(self(), :subscribe)
    {:noreply, [], %{state | conn: nil, monitor: nil, sids: []}}
  end

  def handle_info({:msg, %{topic: subject, body: body} = msg}, state) do
    Telemetry.nats_message(:received)

    message = %Message{
      data: body,
      metadata: %{
        subject: subject,
        reply_to: Map.get(msg, :reply_to),
        headers: Map.get(msg, :headers)
      },
      acknowledger: Broadway.NoopAcknowledger.init()
    }

    state
    |> enqueue(message)
    |> dispatch()
  end

  def handle_info(_other, state), do: {:noreply, [], state}

  # Broadway calls this on shutdown so no new message enters a pipeline that
  # is finishing what it has. Core NATS has nothing to nack, so unsubscribing
  # is the whole of it.
  @impl Broadway.Producer
  def prepare_for_draining(state) do
    unsubscribe(state)
    {:noreply, [], %{state | sids: []}}
  end

  # ── subscribing ──────────────────────────────────────────────────────────

  defp subscribe_all(pid, state) do
    results = Enum.map(state.subjects, &{&1, state.subscribe.(pid, self(), &1)})

    case Enum.find(results, fn {_subject, result} -> not match?({:ok, _}, result) end) do
      nil ->
        sids = Enum.map(results, fn {_subject, {:ok, sid}} -> sid end)
        Logger.info("nats: consuming #{Enum.join(state.subjects, ", ")}")
        put_status({:subscribed, state.subjects})

        {:noreply, [],
         %{state | conn: pid, monitor: Process.monitor(pid), sids: sids, attempts: 0}}

      {subject, error} ->
        Logger.warning("nats: subscribe to #{subject} failed — #{inspect(error)}")
        {:noreply, [], schedule_retry(state)}
    end
  catch
    # `Gnat.sub` is a call into the connection; a connection that dies between
    # `whereis` and the call exits the caller. The retry covers it.
    :exit, reason ->
      Logger.warning("nats: subscribe failed — #{inspect(reason)}")
      {:noreply, [], schedule_retry(state)}
  end

  defp unsubscribe(%{conn: pid, sids: sids} = state) when is_pid(pid) do
    for sid <- sids do
      try do
        state.unsubscribe.(pid, sid)
      catch
        :exit, _ -> :ok
      end
    end

    :ok
  end

  defp unsubscribe(_state), do: :ok

  defp schedule_retry(state) do
    attempts = state.attempts + 1
    delay = min(@retry_base * :math.pow(2, attempts - 1), @retry_max) |> trunc()
    Process.send_after(self(), :subscribe, delay)
    %{state | attempts: attempts}
  end

  # ── buffering ────────────────────────────────────────────────────────────

  defp enqueue(%{size: size, max_buffer: max} = state, message) when size >= max do
    Telemetry.nats_message(:dropped)

    unless state.overflowing? do
      Logger.warning(
        "nats: buffer full at #{max} messages — dropping the oldest until the pipeline catches up"
      )
    end

    {_dropped, queue} = :queue.out(state.queue)
    %{state | queue: :queue.in(message, queue), overflowing?: true}
  end

  defp enqueue(state, message) do
    %{state | queue: :queue.in(message, state.queue), size: state.size + 1}
  end

  defp dispatch(state), do: dispatch(state, [])

  defp dispatch(%{demand: 0} = state, acc), do: emit(state, acc)
  defp dispatch(%{size: 0} = state, acc), do: emit(state, acc)

  defp dispatch(state, acc) do
    {{:value, message}, queue} = :queue.out(state.queue)

    dispatch(
      %{state | queue: queue, size: state.size - 1, demand: state.demand - 1},
      [message | acc]
    )
  end

  defp emit(state, acc) do
    state =
      if state.overflowing? and state.size < state.max_buffer do
        Logger.info("nats: buffer draining — no longer dropping")
        %{state | overflowing?: false}
      else
        state
      end

    {:noreply, Enum.reverse(acc), state}
  end

  defp put_status(status), do: :persistent_term.put(@status_key, status)
end
