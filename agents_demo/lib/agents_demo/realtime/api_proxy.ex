defmodule AgentsDemo.Realtime.ApiProxy do
  @moduledoc """
  The credential-carrying half of this app's talk to the platform, over cable.

      Chrome ──> Elixir ──cable──> va-crystal ──HTTP──> Ruby API

  `Realtime.Bus` is the ASK path (NATS request/reply) and `Realtime.CableClient`
  is the LISTEN path (one connection per signed-in user). This is the third:
  `/auth`, `/api/` and `/tasks/` relayed over ONE connection held for the whole
  server, so the transport rule — cable or NATS, never HTTP — covers login too.

  The node half is `va-crystal node/realtime/api_proxy_channel.cr`, and it is
  the authority on this contract; the frames below are copied from it.

  ## Why the browser's credential never opens this

  A credential is needed to open cable, so a login cannot be the thing that
  obtains one — which is a paradox only if the *browser's* token is what opens
  the connection. It isn't. This app opens one connection with its own account
  credential (`CableToken.account/0`), and every user's login then rides over
  that already-authenticated socket as an ordinary proxied request. A browser
  credential never reaches the node.

  ## The frame contract

  Both `identifier` and `data` are JSON **strings**, not objects — the vendored
  shard reads them with `read_string` and `as_s?` respectively
  (`node/lib/cable/src/cable/payload.cr`), and an object in either position is
  silently parsed as "no data", which reaches the channel as a request with no
  `id` and is then dropped without a reply. That failure is a hang, not an
  error, so it is worth getting right the first time.

      %{command: "message",
        identifier: ~s({"channel":"ApiProxy"}),
        data: ~s({"action":"request","id":"…","method":"POST",
                  "path":"/auth/user_login","body":"email=…&password=…",
                  "content_type":"application/x-www-form-urlencoded"})}

  The reply arrives in the ordinary ActionCable envelope:

      %{"identifier" => ~s({"channel":"ApiProxy"}),
        "message" => %{"id" => "…", "status" => 200,
                       "content_type" => "application/json", "body" => "…"}}

  **`id` is what makes a reply a reply.** One connection carries every user's
  requests concurrently and cable is asynchronous, so correlation is by `id`
  alone. An implementation without it passes a single-request test and
  interleaves wrongly the moment two people log in at once — which is why every
  in-flight request is held in `pending` under its own id and answered from
  there, never by "the next frame that arrives".

  ## Why the socket plumbing looks like CableClient's

  Because it is the same plumbing, deliberately duplicated rather than shared.
  The two connections have different identities (the app's account vs. a user's),
  different channels, and opposite directions — one streams in, this one asks and
  waits. Folding them into a common socket would couple a request/reply timeout
  map to a per-user presence registration, and the shared part is ~60 lines of
  Mint boilerplate that neither owns.

  Inert without `CABLE_URL`. Callers get `{:error, :disabled}`, and
  `Plugs.EngineProxy` falls back to HTTP — see there for when that is right.
  """

  use GenServer

  require Logger

  alias AgentsDemo.Realtime.CableToken

  @subprotocol "actioncable-v1-json"
  @identifier Jason.encode!(%{channel: "ApiProxy"})

  # Matches the node's own default (`CABLE_API_PROXY_TIMEOUT`, 30s) and
  # `engine_proxy.ex`'s `receive_timeout`. A caller that waits longer than the
  # node is willing to wait learns nothing extra.
  @timeout 30_000

  @reconnect_base 1_000
  @reconnect_max 30_000

  # How long a subscribe may go unanswered before it is called a failure.
  #
  # A node WITHOUT the channel does not reject — `Cable::Connection#subscribe`
  # raises `Missing hash key: "ApiProxy"` looking it up in CHANNELS, so nothing
  # is transmitted back at all. That is the likeliest failure in the field (the
  # channel ships in an image, and old images are everywhere) and it is the one
  # the protocol has no frame for, so silence has to be timed instead of waited
  # on. Without this the symptom is only that logins quietly take the HTTP path.
  @subscribe_timeout 5_000

  defstruct [
    :conn,
    :websocket,
    :ref,
    :uri,
    subscribed?: false,
    pending: %{},
    attempts: 0
  ]

  # ── API ──────────────────────────────────────────────────────────────────

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @doc """
  Child specs for the supervision tree — empty when this is not configured, so
  an unconfigured deployment starts no process rather than one that fails.
  """
  def children do
    if enabled?(), do: [__MODULE__], else: []
  end

  @doc "True when a cable URL is configured and a credential can be minted for it."
  def enabled? do
    url = System.get_env("CABLE_URL")
    is_binary(url) and url != "" and is_binary(CableToken.account())
  end

  @doc """
  Relay one request to the API over cable.

  Returns `{:ok, status, body, content_type}`, or `{:error, reason}` — the
  latter meaning this hop failed, NOT that the API refused. An API refusal is a
  successful relay of a 401, and the difference is the whole reason the caller
  can fall back on one and must not on the other.
  """
  def request(method, path, body, content_type, timeout \\ @timeout) do
    if enabled?() do
      # +1s so the GenServer's own timer is the one that fires: it replies with
      # a named error and cleans `pending` up, where a caller-side exit would
      # leave the entry to be answered into a dead process.
      GenServer.call(
        __MODULE__,
        {:request, method, path, body, content_type, timeout},
        timeout + 1_000
      )
    else
      {:error, :disabled}
    end
  catch
    :exit, reason -> {:error, {:exit, reason}}
  end

  # ── GenServer ────────────────────────────────────────────────────────────

  @impl true
  def init(_opts), do: {:ok, %__MODULE__{}, {:continue, :connect}}

  @impl true
  def handle_continue(:connect, state), do: {:noreply, connect(state)}

  @impl true
  def handle_call({:request, _m, _p, _b, _ct, _t}, _from, %{subscribed?: false} = state) do
    # Refusing while the subscription is unconfirmed is deliberate. A frame sent
    # before `confirm_subscription` is routed to a channel that does not exist
    # yet (`connection.cr#message` looks the channel up and returns quietly when
    # it is missing), so it produces no reply at all — the caller would wait the
    # full timeout for a request the node never saw.
    {:reply, {:error, :not_connected}, state}
  end

  def handle_call({:request, method, path, body, content_type, timeout}, from, state) do
    id = Base.url_encode64(:crypto.strong_rand_bytes(12), padding: false)

    data =
      %{action: "request", id: id, method: method, path: path}
      |> maybe_put(:body, body)
      |> maybe_put(:content_type, content_type)
      |> Jason.encode!()

    state = send_frame(state, %{command: "message", identifier: @identifier, data: data})

    timer = Process.send_after(self(), {:timeout, id}, timeout)
    {:noreply, %{state | pending: Map.put(state.pending, id, {from, timer})}}
  end

  @impl true
  def handle_info(:reconnect, state), do: {:noreply, connect(state)}

  def handle_info(:subscribe_deadline, %{subscribed?: true} = state), do: {:noreply, state}

  def handle_info(:subscribe_deadline, state) do
    # Named causes, in the order they are worth checking. Neither is visible
    # from here — the node answered the connection and then said nothing — so
    # the diagnosis has to be carried in the message.
    Logger.error(
      "api proxy: the node never confirmed the ApiProxy subscription. Either it " <>
        "predates the channel (check its log for `Missing hash key: \"ApiProxy\"`) " <>
        "or CABLE_API_PROXY is unset on it. Logins are taking the HTTP fallback."
    )

    {:noreply, state}
  end

  def handle_info({:timeout, id}, state) do
    # The node transmits a reply on every failure path it knows about, so
    # reaching here means the frame or its answer was lost in between — a
    # dropped socket, or a node restart mid-flight.
    case Map.pop(state.pending, id) do
      {nil, _} ->
        {:noreply, state}

      {{from, _timer}, pending} ->
        Logger.warning("api proxy: no reply for #{id} within the timeout")
        GenServer.reply(from, {:error, :timeout})
        {:noreply, %{state | pending: pending}}
    end
  end

  def handle_info(message, %{conn: conn} = state) when not is_nil(conn) do
    case Mint.WebSocket.stream(conn, message) do
      {:ok, conn, responses} ->
        {:noreply, Enum.reduce(responses, %{state | conn: conn}, &handle_response/2)}

      {:error, conn, reason, _responses} ->
        Logger.warning("api proxy: stream error — #{inspect(reason)}")
        {:noreply, schedule_reconnect(%{state | conn: conn})}

      :unknown ->
        {:noreply, state}
    end
  end

  def handle_info(_message, state), do: {:noreply, state}

  # ── connect ──────────────────────────────────────────────────────────────

  defp connect(state) do
    with url when is_binary(url) <- System.get_env("CABLE_URL"),
         token when is_binary(token) <- CableToken.account(),
         uri = URI.parse(url),
         {:ok, conn} <- open(uri),
         {:ok, conn, ref} <- upgrade(conn, uri, token) do
      %{state | conn: conn, ref: ref, uri: uri, subscribed?: false}
    else
      nil ->
        state

      {:error, reason} ->
        Logger.warning("api proxy: connect failed — #{inspect(reason)}")
        schedule_reconnect(state)

      {:error, _conn, reason} ->
        Logger.warning("api proxy: upgrade failed — #{inspect(reason)}")
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
    path = (uri.path || "/cable") <> "?" <> URI.encode_query(token: token)

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
        Logger.warning("api proxy: handshake rejected — #{inspect(reason)}")
        schedule_reconnect(%{state | conn: conn})
    end
  end

  defp handle_response({:data, ref, data}, %{ref: ref, websocket: ws} = state)
       when not is_nil(ws) do
    case Mint.WebSocket.decode(ws, data) do
      {:ok, websocket, frames} ->
        Enum.reduce(frames, %{state | websocket: websocket}, &handle_frame/2)

      {:error, websocket, reason} ->
        Logger.warning("api proxy: decode failed — #{inspect(reason)}")
        %{state | websocket: websocket}
    end
  end

  defp handle_response({:done, _ref}, state), do: state
  defp handle_response(_other, state), do: state

  defp handle_frame({:text, text}, state), do: handle_cable_message(Jason.decode(text), state)
  defp handle_frame({:close, _code, _reason}, state), do: schedule_reconnect(state)
  defp handle_frame(_frame, state), do: state

  defp handle_cable_message({:ok, %{"type" => "welcome"}}, state) do
    Process.send_after(self(), :subscribe_deadline, @subscribe_timeout)
    send_frame(state, %{command: "subscribe", identifier: @identifier})
  end

  defp handle_cable_message({:ok, %{"type" => "confirm_subscription"}}, state) do
    Logger.info("api proxy: cable relay ready (#{System.get_env("CABLE_URL")})")
    %{state | subscribed?: true, attempts: 0}
  end

  defp handle_cable_message({:ok, %{"type" => "reject_subscription"}}, state) do
    # The node rejects this channel when CABLE_API_PROXY is not set — the one
    # cause worth naming, because everything else about the connection is fine
    # and the symptom is only that logins quietly take the HTTP path instead.
    Logger.error(
      "api proxy: subscription REJECTED — the node has CABLE_API_PROXY unset, " <>
        "so it is not relaying API requests"
    )

    %{state | subscribed?: false}
  end

  defp handle_cable_message({:ok, %{"type" => type}}, state) when type in ["ping", "disconnect"],
    do: state

  defp handle_cable_message({:ok, %{"message" => %{"id" => id} = message}}, state) do
    case Map.pop(state.pending, id) do
      {nil, _} ->
        # A reply whose request already timed out, or a duplicate. Dropping it
        # is right; logging it is what says the timeout was the node being slow
        # rather than the frame never arriving.
        Logger.debug("api proxy: reply for unknown id #{id}")
        state

      {{from, timer}, pending} ->
        Process.cancel_timer(timer)

        GenServer.reply(
          from,
          {:ok, message["status"] || 502, message["body"] || "", message["content_type"]}
        )

        %{state | pending: pending}
    end
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
        Logger.warning("api proxy: encode failed — #{inspect(reason)}")
        %{state | websocket: websocket}

      {:error, conn, reason} ->
        Logger.warning("api proxy: send failed — #{inspect(reason)}")
        schedule_reconnect(%{state | conn: conn})
    end
  end

  # ── reconnect ────────────────────────────────────────────────────────────

  defp schedule_reconnect(state) do
    # Every in-flight request is answered before the socket is dropped. They
    # cannot survive the reconnect — their replies were addressed to a
    # connection that no longer exists — and a caller waiting on a frame that
    # can never arrive is the failure this whole module is arranged to avoid.
    for {_id, {from, timer}} <- state.pending do
      Process.cancel_timer(timer)
      GenServer.reply(from, {:error, :disconnected})
    end

    attempts = state.attempts + 1
    delay = min(@reconnect_base * :math.pow(2, attempts - 1), @reconnect_max) |> trunc()
    Process.send_after(self(), :reconnect, delay)

    %{
      state
      | conn: nil,
        websocket: nil,
        ref: nil,
        subscribed?: false,
        pending: %{},
        attempts: attempts
    }
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, _key, ""), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
