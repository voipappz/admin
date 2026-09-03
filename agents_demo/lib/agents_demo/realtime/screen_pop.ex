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

  # The state events that mean "this agent is on a call". Crystal maps
  # `agent-state-change` to `user.state_change` (sessions.cr), and the ringing
  # and answer pair come from `agent-offering` / `bridge-agent-start`.
  @pop_events ["user.state_change", "user.ringing", "user.answer"]

  # Overridable so a deployment points at its own CRM without a rebuild.
  @pop_url_default "https://pardeshk.moked-binaa.co.il/ims/system/?view=custom&module=moked-add"

  @unknown_caller "0000"

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

  @doc """
  One event from a single user's own `state.user.<uuid>` stream.

  Separate from `handle_event/2` because the two streams answer different
  questions. A CallEvents event names an environment and any of its users, so it
  is matched against that environment's loaded instructions. A user-scoped state
  event names nobody but the user whose stream it arrived on — so there is no
  environment to gate on, and the only question worth asking is whether the
  agent the event is about is the agent who is signed in here.
  """
  def user_event(server \\ __MODULE__, user_uuid, event)

  def user_event(server, user_uuid, event),
    do: GenServer.cast(server, {:user_event, user_uuid, event})

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

  @doc """
  Whether a verified `/ws/events` process is registered for this user at all.

  `online?/2` also compares the environment, which is right for an event that
  names one. A `state.user.<uuid>` event does not name an environment, and
  requiring one would drop every pop for a user whose session registered a
  different environment than the call happens to belong to.
  """
  def online_user?(user_uuid) when is_binary(user_uuid) and user_uuid != "" do
    Registry.lookup(AgentsDemo.Realtime.SessionRegistry, user_uuid) != []
  catch
    :exit, _ -> false
  end

  def online_user?(_user_uuid), do: false

  @impl true
  def init(opts) do
    loader = Keyword.get(opts, :loader, &InstructionLoader.load/1)
    {:ok, %__MODULE__{loader: loader}}
  end

  @impl true
  def handle_cast({:event, event}, state),
    do: {:noreply, route_event(state, event)}

  def handle_cast({:user_event, user_uuid, event}, state),
    do: {:noreply, process_user_event(state, user_uuid, event)}

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

  # A pop for the signed-in agent, from that agent's own state stream.
  #
  # The whole rule is: the event is one of the call-shaped state events, the
  # agent it names is the agent signed in here, and that agent has a live
  # socket. No environment gate — see `online_user?/1`.
  @doc false
  def process_user_event(state, user_uuid, event, online? \\ &online_user?/1) do
    Telemetry.screen_pop_event(:received)

    with true <- is_map(event),
         name when name in @pop_events <- event_name(event),
         agent when is_binary(agent) <- agent_uuid(event),
         true <- agent == user_uuid,
         true <- online?.(user_uuid) do
      dedupe_id = Enum.join(["state-screen-pop", name, agent, call_id(event) || ""], ":")

      if seen?(state, dedupe_id) do
        Telemetry.screen_pop_event(:duplicate)
        state
      else
        Phoenix.PubSub.broadcast(
          AgentsDemo.PubSub,
          "realtime:user:#{user_uuid}",
          {:realtime,
           %{type: "notification", message: %{"action" => "tab:new", "url" => pop_url(event)}}}
        )

        Telemetry.screen_pop_event(:dispatched)

        Logger.info(
          "screen pop: state pop for #{user_uuid} on #{name} -> tab:new #{pop_url(event)}"
        )

        remember(state, dedupe_id)
      end
    else
      reason ->
        Telemetry.screen_pop_event(:rejected)

        # Say WHICH precondition failed. Every one of them is silence otherwise,
        # and they are the four questions anyone debugging a missing pop asks.
        Logger.debug(fn ->
          "screen pop: no state pop for #{user_uuid} — " <>
            cond do
              not is_map(event) -> "event is not a map"
              event_name(event) not in @pop_events -> "event #{inspect(event_name(event))} is not one of #{inspect(@pop_events)}"
              is_nil(agent_uuid(event)) -> "event names no agent (no CC-Agent/user_uuid)"
              agent_uuid(event) != user_uuid -> "event names agent #{agent_uuid(event)}, not this one"
              true -> "agent has no live /ws/events socket (#{inspect(reason)})"
            end
        end)

        state
    end
  end

  # StateChannel payloads name the event in "event"; a raw callcenter frame
  # names it in "action". Both are read so this does not depend on which hop
  # normalized the frame.
  defp event_name(%{"event" => name}) when is_binary(name), do: name
  defp event_name(%{"action" => name}) when is_binary(name), do: name
  defp event_name(_event), do: nil

  # The agent an event is about. Crystal carries the uuid under more than one
  # name depending on the frame: `meta["CC-Agent"]` is FreeSWITCH's own
  # callcenter field, `user_uuid` is the node's normalization of it, and a
  # folded state frame nests it under "data". All three are read so a pop does
  # not depend on which shape arrived.
  defp agent_uuid(%{"meta" => %{"CC-Agent" => uuid}}) when is_binary(uuid) and uuid != "",
    do: uuid

  defp agent_uuid(%{"user_uuid" => uuid}) when is_binary(uuid) and uuid != "", do: uuid

  defp agent_uuid(%{"data" => %{"user_uuid" => uuid}}) when is_binary(uuid) and uuid != "",
    do: uuid

  defp agent_uuid(_event), do: nil

  defp call_id(%{"call_uuid" => id}) when is_binary(id) and id != "", do: id
  defp call_id(%{"data" => %{"call_uuid" => id}}) when is_binary(id) and id != "", do: id
  defp call_id(%{"id" => id}) when is_binary(id) and id != "", do: id
  defp call_id(_event), do: nil

  defp caller_number(%{"caller_id_number" => n}) when is_binary(n) and n != "", do: n

  defp caller_number(%{"data" => %{"caller_id_number" => n}}) when is_binary(n) and n != "",
    do: n

  defp caller_number(_event), do: nil

  # The CRM record to open. `search_phone` and `callId` come from the EVENT, not
  # from the user's profile — the profile token selects WHICH crm, which is not
  # modelled yet. The number falls back to @unknown_caller rather than being
  # omitted, because the CRM opens a blank search on an empty phone and a blank
  # form is a clearer "no number" than a silent no-pop.
  defp pop_url(event) do
    base = System.get_env("SCREEN_POP_URL") || @pop_url_default
    phone = caller_number(event) || @unknown_caller
    joiner = if String.contains?(base, "?"), do: "&", else: "?"

    base <>
      joiner <>
      "search_phone=" <>
      URI.encode_www_form(phone) <> "&callId=" <> URI.encode_www_form(call_id(event) || "")
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
