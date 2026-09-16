defmodule Connectix.Realtime.UserStreams do
  @moduledoc """
  What one signed-in user's own streams deliver to their browser.

  This is what a per-user WebSocket client used to do.  There is no connection here: every user's frames arrive on the one NATS
  subscription `Realtime.EventPipeline` holds, and this process only decides
  who each frame belongs to and what their browser should see.

  Losing the per-user connection removes two things worth naming:

    * **N sockets become none.** Fifty signed-in agents meant fifty upstream
      WebSockets, each reconnecting on its own backoff, each able to die
      silently. The broker subscription is one thing to watch.
    * **Presence is no longer a side effect.** The node stamped
      `user:<uuid>:logged_in_at` when `DashboardUser#subscribed` landed, so
      holding the connection *was* the registration. Nothing publishes that
      now — if the platform needs to know a portal user is signed in, it has
      to be told deliberately rather than inferred from a subscription.

  ## Whose frame is it

  A state frame arrives on `state.user.<id>`, and `<id>` is what the switch
  calls the agent — the user's `powerlink_token`, not the portal uuid. The
  same registry `ScreenPop` uses answers that (`user_for_agent/1`, populated by
  `ConnectixWeb.RealtimeSocket` from the verified claims), and an id nobody is
  signed in under is stored and dropped. That is not a failure: the broker
  carries every user on the node, and most of them are not here.

  ## The fold

  The node sends state as deltas and keeps no totals, so a raw relay leaves
  every client to accumulate and none do. The accumulated `view` is kept here,
  per user, so a reconnecting tab gets a whole picture rather than whatever
  happened next. It is memory only: a portal restart starts every view empty,
  exactly as a reconnecting client did.
  """

  use GenServer

  require Logger

  alias Connectix.Realtime.ScreenPop
  alias Connectix.Realtime.StateView

  @doc "One frame off a `state.<scope>.<id>` subject."
  def state_event(server \\ __MODULE__, scope, id, message)

  def state_event(server, scope, id, message) when is_map(message),
    do: GenServer.cast(server, {:state, scope, id, message})

  def state_event(_server, _scope, _id, _message), do: :ok

  @doc """
  One frame off a `dashboard_user:<user_uuid>` subject.

  Same delivery as a user-scoped state frame, without the lookup: this subject
  names its user, where `state.user.<id>` names the agent id the switch knows
  them by.
  """
  def user_state(server \\ __MODULE__, user_uuid, message)

  def user_state(server, user_uuid, message) when is_binary(user_uuid) and is_map(message),
    do: GenServer.cast(server, {:user_state, user_uuid, message})

  def user_state(_server, _user_uuid, _message), do: :ok

  @doc "One frame off a `notifications:<user_uuid>` subject."
  def notification(server \\ __MODULE__, user_uuid, message)

  def notification(server, user_uuid, message) when is_binary(user_uuid) and is_map(message),
    do: GenServer.cast(server, {:notification, user_uuid, message})

  def notification(_server, _user_uuid, _message), do: :ok

  @doc "The accumulated view for a user, or an empty one."
  def view(server \\ __MODULE__, user_uuid) do
    GenServer.call(server, {:view, user_uuid})
  catch
    :exit, _ -> StateView.new()
  end

  def start_link(opts) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, if(name, do: [name: name], else: []))
  end

  @impl true
  def init(opts) do
    {:ok,
     %{
       views: %{},
       resolve: Keyword.get(opts, :resolve, &ScreenPop.user_for_agent/1),
       screen_pop: Keyword.get(opts, :screen_pop, ScreenPop),
       events: Keyword.get(opts, :events, Connectix.Events)
     }}
  end

  @impl true
  def handle_call({:view, user_uuid}, _from, state),
    do: {:reply, Map.get(state.views, user_uuid, StateView.new()), state}

  @impl true
  def handle_cast({:state, scope, id, message}, state) do
    # Stored before it is interpreted, so what arrived is answerable later
    # without re-reading a log — and stored whether or not anyone is signed in
    # under this id, because "nobody was here" is itself the answer to "why did
    # nothing pop".
    Connectix.Events.record(state.events, "StateChannel", message)

    if scope == "user" do
      {:noreply, deliver_user_state(state, id, message)}
    else
      {:noreply, state}
    end
  end

  def handle_cast({:user_state, user_uuid, message}, state) do
    Connectix.Events.record(state.events, "DashboardUser", message)
    {:noreply, deliver(state, user_uuid, nil, message)}
  end

  def handle_cast({:notification, user_uuid, message}, state) do
    Connectix.Events.record(state.events, "Notifications", message)
    broadcast(user_uuid, %{type: "notification", message: message})
    {:noreply, state}
  end

  defp deliver_user_state(state, id, message) do
    case state.resolve.(id) do
      {user_uuid, agent_ids} when is_binary(user_uuid) ->
        deliver(state, user_uuid, agent_ids, message)

      _nobody_signed_in_under_that_id ->
        state
    end
  end

  defp deliver(state, user_uuid, agent_ids, message) do
    # Feed the evaluator, never decide here. This module relays what a client
    # sees; `ScreenPop` is the only thing allowed to turn an event into a
    # browser command.
    ScreenPop.user_event(state.screen_pop, user_uuid, message, agent_ids)

    view = StateView.apply_message(Map.get(state.views, user_uuid, StateView.new()), message)

    broadcast(user_uuid, %{
      type: "user.state",
      user_uuid: user_uuid,
      event: message["event"],
      at: message["at"],
      view: view,
      message: message
    })

    %{state | views: Map.put(state.views, user_uuid, view)}
  end

  # The frame shape the extension is already tested against. Clients cannot
  # tell which upstream delivered a message, which is what made replacing
  # one transport with another invisible to them.
  defp broadcast(user_uuid, frame),
    do:
      Phoenix.PubSub.broadcast(
        Connectix.PubSub,
        "realtime:user:#{user_uuid}",
        {:realtime, frame}
      )
end
