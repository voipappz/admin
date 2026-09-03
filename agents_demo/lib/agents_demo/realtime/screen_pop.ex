defmodule AgentsDemo.Realtime.ScreenPop do
  @moduledoc """
  Executes validated screen-pop instructions against Crystal call events.

  One supervised process owns the instruction cache and dedupe set for the
  whole portal. It receives the node-wide `CallEvents` stream once through the
  singleton `Realtime.ApiProxy` cable connection. A result is broadcast only
  when the event names a user with a currently connected, verified
  `/ws/events` process; PubSub does not persist or replay it.
  """

  use GenServer

  require Logger

  alias AgentsDemo.Realtime.Instruction
  alias AgentsDemo.Realtime.InstructionLoader
  alias AgentsDemo.Telemetry

  @seen_max 256
  @seen_ttl_ms 60_000
  @pending_max 256

  defstruct instructions: %{},
            loaded: MapSet.new(),
            loading: MapSet.new(),
            pending: %{},
            seen: %{},
            loader: nil

  def start_link(opts) do
    name = Keyword.get(opts, :name, __MODULE__)
    options = if name, do: [name: name], else: []
    GenServer.start_link(__MODULE__, opts, options)
  end

  @doc "Start loading one environment's instructions once without blocking event processing."
  def load_environment(server \\ __MODULE__, environment_uuid)

  def load_environment(server, environment_uuid) do
    GenServer.call(server, {:load_environment, environment_uuid, false})
  catch
    :exit, _ -> {:error, :unavailable}
  end

  @doc "Explicitly refresh one environment's cached instructions."
  def refresh_environment(server \\ __MODULE__, environment_uuid)

  def refresh_environment(server, environment_uuid) do
    GenServer.call(server, {:load_environment, environment_uuid, true})
  catch
    :exit, _ -> {:error, :unavailable}
  end

  @doc "Deliver one normalized Crystal event for matching and execution."
  def handle_event(server \\ __MODULE__, event)

  def handle_event(server, event), do: GenServer.cast(server, {:event, event})

  def loaded?(server \\ __MODULE__, environment_uuid),
    do: GenServer.call(server, {:loaded?, environment_uuid})

  @doc "Whether a verified `/ws/events` process is registered for this user and environment."
  def online?(user_uuid, environment_uuid)
      when is_binary(user_uuid) and user_uuid != "" and is_binary(environment_uuid) and
             environment_uuid != "" do
    AgentsDemo.Realtime.SessionRegistry
    |> Registry.lookup(user_uuid)
    |> Enum.any?(fn {_pid, registered_environment} ->
      registered_environment == environment_uuid
    end)
  catch
    :exit, _ -> false
  end

  def online?(_user_uuid, _environment_uuid), do: false

  @impl true
  def init(opts) do
    loader = Keyword.get(opts, :loader, &InstructionLoader.load/1)
    {:ok, %__MODULE__{loader: loader}}
  end

  @impl true
  def handle_cast({:event, event}, state),
    do: {:noreply, route_event(state, event)}

  @impl true
  def handle_call({:load_environment, environment_uuid, refresh?}, _from, state),
    do: {:reply, :ok, begin_load(state, environment_uuid, refresh?)}

  def handle_call({:loaded?, environment_uuid}, _from, state),
    do: {:reply, MapSet.member?(state.loaded, environment_uuid), state}

  @impl true
  def handle_info({:instructions_loaded, environment_uuid, result}, state),
    do: {:noreply, finish_load(state, environment_uuid, result)}

  @doc false
  def process_event(state, event, online? \\ &online?/2) do
    environment_uuid = if is_map(event), do: event["environment_uuid"], else: nil
    instructions = Map.get(state.instructions, environment_uuid, [])

    case Instruction.match(instructions, event) do
      {:ok, dedupe_id, user_uuid, command} ->
        cond do
          seen?(state, dedupe_id) ->
            Telemetry.screen_pop_event(:duplicate)
            state

          not online?.(user_uuid, environment_uuid) ->
            Telemetry.screen_pop_event(:offline)
            state

          true ->
            Phoenix.PubSub.broadcast(
              AgentsDemo.PubSub,
              "realtime:user:#{user_uuid}",
              {:realtime, %{type: "notification", message: command}}
            )

            Telemetry.screen_pop_event(:dispatched)
            remember(state, dedupe_id)
        end

      {:error, _reason} ->
        Telemetry.screen_pop_event(:rejected)
        state
    end
  end

  defp route_event(state, event) when is_map(event) do
    environment_uuid = event["environment_uuid"]
    Telemetry.screen_pop_event(:received)

    cond do
      MapSet.member?(state.loaded, environment_uuid) ->
        process_event(state, event)

      MapSet.member?(state.loading, environment_uuid) ->
        Telemetry.screen_pop_event(:queued)
        enqueue(state, environment_uuid, event)

      true ->
        Telemetry.screen_pop_event(:unloaded)
        state
    end
  end

  defp route_event(state, _event) do
    Telemetry.screen_pop_event(:received)
    Telemetry.screen_pop_event(:rejected)
    state
  end

  defp begin_load(state, environment_uuid, refresh?)
       when is_binary(environment_uuid) and environment_uuid != "" do
    if MapSet.member?(state.loading, environment_uuid) or
         (not refresh? and MapSet.member?(state.loaded, environment_uuid)) do
      state
    else
      owner = self()
      loader = state.loader

      Task.start(fn ->
        result =
          try do
            loader.(environment_uuid)
          rescue
            error -> {:error, error}
          catch
            kind, reason -> {:error, {kind, reason}}
          end

        send(owner, {:instructions_loaded, environment_uuid, result})
      end)

      Telemetry.instruction_load(:started)
      %{state | loading: MapSet.put(state.loading, environment_uuid)}
    end
  end

  defp begin_load(state, _environment_uuid, _refresh?), do: state

  defp finish_load(state, environment_uuid, {:ok, payload}) do
    Telemetry.instruction_load(:loaded)
    instructions = Instruction.load(payload, environment_uuid)
    events = state.pending |> Map.get(environment_uuid, []) |> Enum.reverse()

    state = %{
      state
      | instructions: Map.put(state.instructions, environment_uuid, instructions),
        loaded: MapSet.put(state.loaded, environment_uuid),
        loading: MapSet.delete(state.loading, environment_uuid),
        pending: Map.delete(state.pending, environment_uuid)
    }

    Enum.reduce(events, state, &process_event(&2, &1))
  end

  defp finish_load(state, environment_uuid, {:error, reason}) do
    Telemetry.instruction_load(:failed)

    Logger.warning(
      "screen pop: instruction load failed for environment #{environment_uuid} — #{inspect(reason)}"
    )

    %{
      state
      | loading: MapSet.delete(state.loading, environment_uuid),
        pending: Map.delete(state.pending, environment_uuid)
    }
  end

  defp finish_load(state, environment_uuid, other),
    do: finish_load(state, environment_uuid, {:error, {:unexpected, other}})

  defp enqueue(state, environment_uuid, event) do
    pending = Map.get(state.pending, environment_uuid, [])
    pending = [event | Enum.take(pending, @pending_max - 1)]
    %{state | pending: Map.put(state.pending, environment_uuid, pending)}
  end

  defp seen?(%{seen: seen}, id) do
    case Map.fetch(seen, id) do
      {:ok, at} -> now_ms() - at < @seen_ttl_ms
      :error -> false
    end
  end

  defp remember(state, id) do
    now =
      state.seen
      |> Map.values()
      |> then(fn timestamps ->
        max(now_ms(), Enum.max(timestamps, fn -> now_ms() - 1 end) + 1)
      end)

    seen =
      state.seen
      |> Enum.reject(fn {_id, at} -> now - at >= @seen_ttl_ms end)
      |> Map.new()

    seen =
      if map_size(seen) >= @seen_max do
        {oldest, _at} = Enum.min_by(seen, fn {_id, at} -> at end)
        Map.delete(seen, oldest)
      else
        seen
      end

    %{state | seen: Map.put(seen, id, now)}
  end

  defp now_ms, do: System.monotonic_time(:millisecond)

  @doc false
  def seen_max, do: @seen_max

  @doc false
  def seen_ttl_ms, do: @seen_ttl_ms
end
