defmodule Connectix.Realtime.ScreenPop do
  @moduledoc """
  Executes validated screen-pop instructions against Crystal call events.

  One supervised process owns the instruction cache and dedupe set for the
  whole portal. It receives the node-wide `CallEvents` stream once through the
  singleton `Realtime.ApiProxy` cable connection. A result is broadcast only
  when the event names a user with a currently connected, verified
  `/ws/events` process; PubSub does not persist or replay it.
  """

  use GenServer

  # Triggers, agent states, agent fields and the URL all come from
  # priv/pocketflow/screen_pop.yaml — see PopRule. Nothing about WHICH events
  # pop is compiled in any more; what a rule may DO still is.

  require Logger

  alias Connectix.Realtime.Instruction
  alias Connectix.Realtime.InstructionLoader
  alias Connectix.Realtime.PopRule
  alias Connectix.Telemetry

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
  # NO server parameter, deliberately. With both a leading `server \\ __MODULE__`
  # and a trailing `agent_ids \\ nil` the 3-arity call is ambiguous, and Elixir
  # binds it to (server, user_uuid, event) — so `CableClient`'s
  # `user_event(user_uuid, message, agent_ids)` passed the message as a uuid and
  # the ids as the event. It raised inside the cast, where nothing surfaced it.
  def user_event(user_uuid, event, agent_ids \\ nil),
    do: GenServer.cast(__MODULE__, {:user_event, user_uuid, event, agent_ids})

  @doc "Whether a verified `/ws/events` process is registered for this user and environment."
  def online?(user_uuid, environment_uuid)
      when is_binary(user_uuid) and user_uuid != "" and is_binary(environment_uuid) and
             environment_uuid != "" do
    Connectix.Realtime.SessionRegistry
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
    Registry.lookup(Connectix.Realtime.SessionRegistry, user_uuid) != []
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

  def handle_cast({:user_event, user_uuid, event, agent_ids}, state),
    do: {:noreply, process_user_event(state, user_uuid, event, &online_user?/1, agent_ids)}

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
              Connectix.PubSub,
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

  # Public only so a test can drive the routing decision without a GenServer,
  # the same reason `process_event/3` and `process_user_event/5` are. It is the
  # function that decides whether an event is anyone's, so it is the one worth
  # asserting on directly.
  @doc false
  def route_event(state, event) when is_map(event) do
    environment_uuid = event["environment_uuid"]
    Telemetry.screen_pop_event(:received)
    Connectix.Events.record("CallEvents", event)

    cond do
      MapSet.member?(state.loaded, environment_uuid) ->
        process_event(state, event)

      MapSet.member?(state.loading, environment_uuid) ->
        Telemetry.screen_pop_event(:queued)
        enqueue(state, environment_uuid, event)

      true ->
        # No instructions for this environment — and for a node-wide CallEvents
        # frame there usually IS no environment: the relayed callcenter payloads
        # carry an agent and a call, not an environment_uuid. That used to end
        # here, so every such frame was stored and dropped as `:unloaded`.
        #
        # The frame does name an AGENT, though, and a signed-in user's agent ids
        # are registered when their socket connects. If one of them owns this
        # agent, the event is theirs and the user-scoped path can answer it —
        # the same path a `state.user.<id>` frame takes, which needs no
        # environment because whose event it is was already settled.
        #
        # This is tighter than the environment gate it stands in for, not
        # looser: the agent id was resolved from that user's own verified token,
        # and they must have a live socket on THIS portal.
        pop_via_agent(state, event)
    end
  end

  def route_event(state, _event) do
    Telemetry.screen_pop_event(:received)
    Telemetry.screen_pop_event(:rejected)
    state
  end

  # A CallEvents frame handed to the user-scoped path, if it names an agent that
  # someone signed in here answers to.
  defp pop_via_agent(state, event) do
    case agent_uuid(event) do
      agent when is_binary(agent) and agent != "" ->
        case user_for_agent(agent) do
          {user_uuid, agent_ids} ->
            Logger.debug(fn ->
              "screen pop: CallEvents names agent #{agent} → user #{user_uuid}"
            end)

            pop_for_user(state, user_uuid, event, &online_user?/1, agent_ids)

          nil ->
            # The common case on a busy switch: the event belongs to an agent
            # who is not signed in to this portal. Debug, not info — this fires
            # for most frames.
            Telemetry.screen_pop_event(:unloaded)

            Logger.debug(fn ->
              "screen pop: no pop — agent #{agent} has no session here"
            end)

            state
        end

      _no_agent ->
        Telemetry.screen_pop_event(:unloaded)

        Logger.debug(fn ->
          "screen pop: no pop — event names no environment and no agent"
        end)

        state
    end
  end

  @doc """
  The signed-in user who answers to this agent id, and every id they answer to.

  `nil` when nobody here does. Registered by `RealtimeSocket` at connect and
  removed with the socket, so this cannot outlive the session it names.

  One registry lookup rather than a scan: a busy node delivers thousands of
  CallEvents frames a minute and every one of them asks this question.
  """
  @spec user_for_agent(String.t()) :: {String.t(), [String.t()]} | nil
  def user_for_agent(agent_id) when is_binary(agent_id) and agent_id != "" do
    case Registry.lookup(Connectix.Realtime.SessionRegistry, {:agent, agent_id}) do
      [{_pid, {user_uuid, agent_ids}} | _rest] -> {user_uuid, agent_ids}
      [] -> nil
    end
  catch
    :exit, _ -> nil
  end

  def user_for_agent(_agent_id), do: nil

  # A pop for the signed-in agent, from that agent's own state stream.
  #
  # The whole rule is: the event is one of the call-shaped state events, the
  # agent it names is the agent signed in here, and that agent has a live
  # socket. No environment gate — see `online_user?/1`.
  #
  # `agent_ids` is every id the switch may name this user by. The callcenter
  # uses the user's `powerlink_token` as `CC-Agent`, not the portal uuid, so
  # comparing against the uuid alone refused every real event. Defaults to the
  # uuid so an older caller keeps its old behaviour.
  @doc false
  def process_user_event(
        state,
        user_uuid,
        event,
        online? \\ &online_user?/1,
        agent_ids \\ nil
      ) do
    Telemetry.screen_pop_event(:received)
    Connectix.Events.record("StateChannel", event)
    pop_for_user(state, user_uuid, event, online?, agent_ids)
  end

  # The pop decision on its own — no store write, no `:received` count.
  #
  # Split out because `route_event` reaches it too, for a node-wide CallEvents
  # frame that names a connected agent. That frame has already been recorded
  # under `src: "CallEvents"` and counted; running the whole of
  # `process_user_event/5` again would count it twice and store it a SECOND
  # time, because the row id is a digest that includes `src` — so the same
  # event would appear once as CallEvents and once as StateChannel.
  defp pop_for_user(state, user_uuid, event, online?, agent_ids) do
    accepted = agent_ids || [user_uuid]

    with true <- is_map(event),
         name when is_binary(name) <- event_name(event),
         true <- name in PopRule.triggers(),
         true <- state_allowed?(event),
         agent when is_binary(agent) <- agent_uuid(event),
         true <- agent in accepted,
         true <- online?.(user_uuid) do
      dedupe_id = Enum.join(["state-screen-pop", name, agent, call_id(event) || ""], ":")

      if seen?(state, dedupe_id) do
        Telemetry.screen_pop_event(:duplicate)
        state
      else
        Phoenix.PubSub.broadcast(
          Connectix.PubSub,
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
              not state_allowed?(event) -> "agent state #{inspect(PopRule.dig(event, "user_state"))} is not one that pops"
              event_name(event) not in PopRule.triggers() -> "event #{inspect(event_name(event))} is not one of #{inspect(PopRule.triggers())}"
              is_nil(agent_uuid(event)) -> "event names no agent (no CC-Agent/user_uuid)"
              agent_uuid(event) not in accepted ->
                "event names agent #{agent_uuid(event)}, not one of #{inspect(accepted)}"
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
  defp agent_uuid(event) when is_map(event) do
    Enum.find_value(PopRule.agent_fields(), fn path -> PopRule.dig(event, path) end)
  end

  defp agent_uuid(_event), do: nil

  # An `agent-state-change` says which state it moved to, and only some of them
  # mean "on a call" — without this, going Idle pops a CRM tab. An empty list in
  # the rule means every state passes.
  defp state_allowed?(event) do
    case PopRule.agent_states() do
      [] ->
        true

      allowed ->
        case PopRule.dig(event, "user_state") || PopRule.dig(event, "meta.CC-Agent-State") do
          nil -> true
          state -> state in allowed
        end
    end
  end

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
    phone = caller_number(event) || PopRule.unknown_caller()

    PopRule.record_url()
    |> String.replace("{phone}", URI.encode_www_form(phone))
    |> String.replace("{call_id}", URI.encode_www_form(call_id(event) || ""))
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
