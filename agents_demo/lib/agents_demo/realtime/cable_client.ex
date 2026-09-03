defmodule AgentsDemo.Realtime.CableClient do
  @moduledoc """
  ActionCable client — one connection per user, held SERVER-SIDE.

  Cable is the model: its channels, stream names and state-key semantics are
  the vocabulary the platform is written in. This app speaks it here so that
  browsers never have to, which matters for two reasons that are not style:

    * `Notifications#subscribed` used to stream from a CLIENT-SUPPLIED
      `user_uuid` (va-crystal `node/realtime/app.cr`), never compared against
      the verified identity on the connection; the node now derives the stream
      from the token, but a deployed node may predate that. Held here, the uuid
      comes from the token this app already verified either way.
    * `VaShared::CableAuth.decode_jwt` verifies the signature and never checks
      `exp`, so cable accepts expired tokens indefinitely. This app verifies
      through the mothership first (`TokenAuth`), which does reject them.

  A confirmed subscription is also the REGISTRATION: the node stamps
  `user:<uuid>:logged_in_at` when `DashboardUser#subscribed` lands. Presence is
  therefore a side effect of holding this connection, which is why it is opened
  for a user rather than once for the server — and why a rejected subscription
  is logged loudly rather than retried into silence.

  This is the per-user state/notification path. The node-wide CallEvents stream
  is held once by `Realtime.ApiProxy` and evaluated by `Realtime.ScreenPop`;
  adding it here would multiply every PBX event by the number of logged-in
  users.
  """

  use GenServer

  require Logger

  alias AgentsDemo.Realtime.ScreenPop
  alias AgentsDemo.Realtime.StateView
  alias AgentsDemo.Realtime.TokenAuth

  @subprotocol "actioncable-v1-json"
  # Cable pings on its own schedule; this only bounds a dead socket.
  @recv_timeout 60_000
  @reconnect_base 1_000
  @reconnect_max 30_000
  defstruct [
    :user_uuid,
    :environment_uuid,
    :token,
    :conn,
    :websocket,
    :ref,
    :uri,
    :identifiers,
    # The accumulated state picture. `fanout/3` reads AND writes it, so its
    # absence here was a KeyError on the first state message — which killed
    # this GenServer and took the Notifications subscription down with it, so
    # the visible symptom was screen pops silently stopping.
    view: nil,
    welcomed?: false,
    confirmed: MapSet.new(),
    attempts: 0
  ]

  # ── API ──────────────────────────────────────────────────────────────────

  def start_link(opts) do
    user_uuid = Keyword.fetch!(opts, :user_uuid)
    GenServer.start_link(__MODULE__, opts, name: via(user_uuid))
  end

  def via(user_uuid), do: {:via, Registry, {AgentsDemo.Realtime.CableRegistry, user_uuid}}

  @doc "Whether this user's cable subscriptions are confirmed (i.e. registered)."
  def registered?(user_uuid) do
    case Registry.lookup(AgentsDemo.Realtime.CableRegistry, user_uuid) do
      [{pid, _}] -> GenServer.call(pid, :registered?, 5_000)
      [] -> false
    end
  catch
    :exit, _ -> false
  end

  @doc "Cable's base URL, or nil when not configured — then this whole module is inert."
  def url, do: System.get_env("CABLE_URL")

  def enabled?, do: is_binary(url()) and url() != ""

  # ── GenServer ────────────────────────────────────────────────────────────

  @impl true
  def init(opts) do
    state = %__MODULE__{
      user_uuid: Keyword.fetch!(opts, :user_uuid),
      environment_uuid: Keyword.fetch!(opts, :environment_uuid),
      token: Keyword.fetch!(opts, :token),
      identifiers: identifiers_for(Keyword.fetch!(opts, :user_uuid))
    }

    {:ok, state, {:continue, :connect}}
  end

  @impl true
  def handle_continue(:connect, state), do: {:noreply, connect(state)}

  @impl true
  def handle_call(:registered?, _from, state),
    do: {:reply, MapSet.size(state.confirmed) > 0, state}

  @impl true
  def handle_info(:reconnect, state), do: {:noreply, connect(state)}

  def handle_info(message, %{conn: conn} = state) when not is_nil(conn) do
    case Mint.WebSocket.stream(conn, message) do
      {:ok, conn, responses} ->
        {:noreply, Enum.reduce(responses, %{state | conn: conn}, &handle_response/2)}

      {:error, conn, reason, _responses} ->
        Logger.warning("cable: stream error for #{state.user_uuid} — #{inspect(reason)}")
        {:noreply, schedule_reconnect(%{state | conn: conn})}

      :unknown ->
        {:noreply, state}
    end
  end

  def handle_info(_message, state), do: {:noreply, state}

  # ── connect ──────────────────────────────────────────────────────────────

  defp connect(state) do
    with true <- enabled?(),
         uri = URI.parse(url()),
         {:ok, conn} <- open(uri),
         {:ok, conn, ref} <- upgrade(conn, uri, state.token) do
      %{state | conn: conn, ref: ref, uri: uri, welcomed?: false, confirmed: MapSet.new()}
    else
      false ->
        # No CABLE_URL: inert by design, not an error. Events still flow over
        # NATS; only the registration side effect is absent.
        state

      {:error, reason} ->
        Logger.warning("cable: connect failed for #{state.user_uuid} — #{inspect(reason)}")
        schedule_reconnect(state)

      {:error, _conn, reason} ->
        Logger.warning("cable: upgrade failed for #{state.user_uuid} — #{inspect(reason)}")
        schedule_reconnect(state)
    end
  end

  defp open(%URI{} = uri) do
    {scheme, port} =
      case uri.scheme do
        "wss" -> {:https, uri.port || 443}
        _ -> {:http, uri.port || 80}
      end

    Mint.HTTP.connect(scheme, uri.host, port, protocols: [:http1])
  end

  defp upgrade(conn, uri, token) do
    # The token rides as a query parameter because that is what cable accepts
    # (`?token=`). It is a server-to-server hop on the internal network — the
    # browser never sees this URL, which is precisely why the browser is not
    # the one making it.
    path =
      (uri.path || "/cable") <>
        "?" <> URI.encode_query(token: token)

    Mint.WebSocket.upgrade(ws_scheme(uri), conn, path, [
      {"sec-websocket-protocol", @subprotocol}
    ])
  end

  defp ws_scheme(%URI{scheme: "wss"}), do: :wss
  defp ws_scheme(_), do: :ws

  # ── frames ───────────────────────────────────────────────────────────────

  defp handle_response({:status, ref, status}, %{ref: ref} = state),
    do: %{state | attempts: if(status == 101, do: 0, else: state.attempts)}

  defp handle_response({:headers, ref, headers}, %{ref: ref} = state) do
    case Mint.WebSocket.new(state.conn, ref, 101, headers) do
      {:ok, conn, websocket} ->
        %{state | conn: conn, websocket: websocket}

      {:error, conn, reason} ->
        Logger.warning("cable: handshake rejected for #{state.user_uuid} — #{inspect(reason)}")
        schedule_reconnect(%{state | conn: conn})
    end
  end

  defp handle_response({:data, ref, data}, %{ref: ref, websocket: ws} = state)
       when not is_nil(ws) do
    case Mint.WebSocket.decode(ws, data) do
      {:ok, websocket, frames} ->
        Enum.reduce(frames, %{state | websocket: websocket}, &handle_frame/2)

      {:error, websocket, reason} ->
        Logger.warning("cable: decode failed for #{state.user_uuid} — #{inspect(reason)}")
        %{state | websocket: websocket}
    end
  end

  defp handle_response({:done, _ref}, state), do: state
  defp handle_response(_other, state), do: state

  defp handle_frame({:text, text}, state), do: handle_cable_message(Jason.decode(text), state)
  defp handle_frame({:close, _code, _reason}, state), do: schedule_reconnect(state)
  defp handle_frame(_frame, state), do: state

  # ActionCable greets an ACCEPTED connection with `welcome`. A rejected one is
  # closed straight away with no welcome, which looks identical to a dead
  # network — so the greeting is tracked rather than assumed.
  defp handle_cable_message({:ok, %{"type" => "welcome"}}, state) do
    Enum.reduce(state.identifiers, %{state | welcomed?: true}, fn id, acc ->
      send_frame(acc, %{command: "subscribe", identifier: id})
    end)
  end

  defp handle_cable_message({:ok, %{"type" => "confirm_subscription", "identifier" => id}}, state) do
    # This is the registration: `user:<uuid>:logged_in_at` is stamped now.
    Logger.info("cable: subscribed #{state.user_uuid} → #{id}")
    %{state | confirmed: MapSet.put(state.confirmed, id), attempts: 0}
  end

  defp handle_cable_message({:ok, %{"type" => "reject_subscription", "identifier" => id}}, state) do
    # Retrying cannot fix wrong channel params, and a retry loop would hide it.
    Logger.error(
      "cable: subscription REJECTED for #{state.user_uuid} → #{id} (check channel params)"
    )

    state
  end

  defp handle_cable_message({:ok, %{"type" => type}}, state) when type in ["ping", "disconnect"],
    do: state

  defp handle_cable_message({:ok, %{"message" => message, "identifier" => id}}, state) do
    fanout(state, id, message)
  end

  defp handle_cable_message(_other, state), do: state

  defp send_frame(%{websocket: nil} = state, _payload), do: state

  defp send_frame(state, payload) do
    with {:ok, websocket, data} <-
           Mint.WebSocket.encode(state.websocket, {:text, Jason.encode!(payload)}),
         {:ok, conn} <- Mint.WebSocket.stream_request_body(state.conn, state.ref, data) do
      %{state | websocket: websocket, conn: conn}
    else
      {:error, %Mint.WebSocket{} = websocket, reason} ->
        Logger.warning("cable: encode failed — #{inspect(reason)}")
        %{state | websocket: websocket}

      {:error, conn, reason} ->
        Logger.warning("cable: send failed — #{inspect(reason)}")
        schedule_reconnect(%{state | conn: conn})
    end
  end

  # ── streams ──────────────────────────────────────────────────────────────

  # The subscriptions this app holds for a user. The uuid comes from the
  # verified token, never from anything a client sent. Nothing node-wide:
  # CallEvents belongs to the singleton application connection.
  @doc false
  def identifiers_for(user_uuid) do
    [
      Jason.encode!(%{channel: "DashboardUser", user_uuid: user_uuid}),
      Jason.encode!(%{channel: "Notifications", user_uuid: user_uuid}),
      # The agent's own state stream (`state.user.<uuid>`), which is where
      # `agent-state-change` actually lands — it is NOT on CallEvents, so
      # without this subscription a screen pop for a state change can never
      # fire, however the rule is written. Still user-scoped: the id is the
      # verified uuid, so this holds no more than the two above.
      Jason.encode!(%{channel: "StateChannel", scope: "user", id: user_uuid})
    ]
  end

  # Onto the user's own PubSub topic, in the frame shape the extension is
  # already tested against — clients cannot tell which upstream delivered a
  # message, which is what made replacing the bus with cable invisible to them.
  #
  # Public only so a test can drive it without standing up a WebSocket. It is
  # the function that decides what a client sees, so it is the one worth
  # asserting on directly.
  @doc false
  def fanout(state, identifier, message) do
    # Feed the evaluator, never decide here. This module relays what a client
    # sees; `ScreenPop` is the only thing allowed to turn an event into a
    # browser command, which is why this hands the event over rather than
    # broadcasting a notification of its own.
    if identifier =~ "StateChannel" do
      ScreenPop.user_event(state.user_uuid, message)
    end

    if identifier =~ "Notifications" do
      broadcast(state.user_uuid, %{type: "notification", message: message})
      state
    else
      # Fold server-side: the node sends deltas and keeps no totals, so a raw
      # relay leaves every client to accumulate — and none do. `view` is the
      # accumulated picture, so a reconnecting tab gets a whole one rather than
      # whatever happened next.
      view = StateView.apply_message(state.view || StateView.new(), message)

      broadcast(state.user_uuid, %{
        type: "user.state",
        user_uuid: state.user_uuid,
        event: message["event"],
        at: message["at"],
        view: view,
        message: message
      })

      %{state | view: view}
    end
  end

  defp broadcast(user_uuid, frame),
    do:
      Phoenix.PubSub.broadcast(
        AgentsDemo.PubSub,
        "realtime:user:#{user_uuid}",
        {:realtime, frame}
      )

  defp schedule_reconnect(state) do
    unless state.welcomed? do
      Logger.warning(
        "cable: closed before welcome for #{state.user_uuid} — connect params or auth refused"
      )
    end

    attempts = state.attempts + 1
    delay = min(@reconnect_base * :math.pow(2, attempts - 1), @reconnect_max) |> trunc()
    Process.send_after(self(), :reconnect, delay)

    %{state | conn: nil, websocket: nil, ref: nil, welcomed?: false, attempts: attempts}
  end

  @doc false
  def recv_timeout, do: @recv_timeout

  @doc false
  def token_auth_module, do: TokenAuth
end
