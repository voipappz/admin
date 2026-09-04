defmodule Connectix.Realtime.ApiProxy do
  @moduledoc """
  The credential-carrying half of this app's talk to the platform, over cable.

      Chrome ──> Elixir ──cable──> va-crystal ──HTTP──> Ruby API

  `Realtime.CableClient` is the LISTEN path (one connection per signed-in
  user). This is the ASK path: `/auth`, `/api/` and `/tasks/` relayed over ONE
  connection held for the whole server, plus `verify/1`, which asks the node
  whether a user token is real and whose it is. Together they make cable the
  portal's only transport to the platform — never HTTP, and no longer NATS
  either: `Realtime.Bus` used to be the ask path and is what `verify/1`
  replaces.

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

  `verify` is a second action on the same channel and the same envelope:

      data: ~s({"action":"verify","id":"…","token":"…"})

  answered `200 {"ok":true,"user_uuid":…,"account_uuid":…,"environment_uuid":…}`
  or `401 {"ok":false,"error":"invalid"}`. The node answers it from its OWN
  `SECRET_KEY` — the one its connection admits sockets with — rather than
  forwarding it anywhere, which is the point: the previous verifier was a NATS
  request to the local API, and after a login relayed through this channel to a
  DIFFERENT mothership it timed out on a token that node would have accepted.

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

  alias Connectix.Realtime.CableToken

  @subprotocol "actioncable-v1-json"
  @api_identifier Jason.encode!(%{channel: "ApiProxy"})
  @call_events_identifier Jason.encode!(%{channel: "CallEvents"})

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
    confirmed: MapSet.new(),
    # Each entry is `{from, timer, kind}` — `kind` is `:request` or `:verify`,
    # and says how the reply envelope is turned into an answer.
    pending: %{},
    attempts: 0,
    # Set when the node answers `verify` with its unknown-action 400. It is
    # reset on reconnect, because a node that has just restarted may be running
    # an image that has the action.
    verify_unsupported?: false
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

  @doc false
  def identifiers, do: [@api_identifier, @call_events_identifier] ++ state_identifiers()

  @doc """
  The `StateChannel` subscriptions named by `EVENT_STREAMS`.

  Listening only, and only so the frames land in `Connectix.Events`: nothing
  here feeds `ScreenPop`, which decides pops from `CallEvents` and from a
  signed-in user's own stream. See `Connectix.Config.event_streams/0` for why
  a stream has to be named one at a time.
  """
  @spec state_identifiers() :: [String.t()]
  def state_identifiers do
    Enum.map(Connectix.Config.event_streams(), fn {scope, id} ->
      Jason.encode!(%{channel: "StateChannel", scope: scope, id: id})
    end)
  end

  @doc false
  def classify(@call_events_identifier, %{} = message), do: {:event, message}
  def classify(@api_identifier, %{} = message), do: {:reply, message}

  # Decoded rather than compared against the encoded identifiers: the node
  # echoes back the identifier it was sent, and matching on the exact string
  # would make this depend on Jason's key order.
  def classify(identifier, %{} = message) when is_binary(identifier) do
    case Jason.decode(identifier) do
      {:ok, %{"channel" => "StateChannel"}} -> {:record, message}
      _other -> :ignore
    end
  end

  def classify(_identifier, _message), do: :ignore

  @doc """
  True when the node has CONFIRMED the ApiProxy subscription — i.e. a request
  sent now would actually be relayed.

  Distinct from `enabled?/0`, which only says this deployment was configured for
  cable. The gap between the two is the whole failure mode: an older node
  answers the connection and never confirms the channel, and everything keeps
  working over the HTTP fallback. Without a way to ask, a test that passes over
  the fallback looks exactly like one that proved the relay.
  """
  def ready? do
    enabled?() and GenServer.call(__MODULE__, :ready?, 5_000)
  catch
    :exit, _ -> false
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
  def request(method, path, body, content_type, authorization \\ nil, timeout \\ @timeout) do
    if enabled?() do
      # +1s so the GenServer's own timer is the one that fires: it replies with
      # a named error and cleans `pending` up, where a caller-side exit would
      # leave the entry to be answered into a dead process.
      GenServer.call(
        __MODULE__,
        {:request, method, path, body, content_type, authorization, timeout},
        timeout + 1_000
      )
    else
      {:error, :disabled}
    end
  catch
    :exit, reason -> {:error, {:exit, reason}}
  end

  @doc """
  Ask the node whether `token` is a user token it would admit, and whose.

  Returns `{:ok, %{"user_uuid" => _, "account_uuid" => _, "environment_uuid" => _}}`
  (any of which may be nil), `{:error, :invalid}` when the node refused it, or
  `{:error, :disabled | :not_connected | :timeout | :disconnected | :unavailable}`
  when no verdict was obtained. `:unavailable` covers the reply the protocol has
  for a node that predates the action — its unknown-action 400 — and any reply
  that is not one of the two the action defines.

  The caller must treat every `:error` but `:invalid` as "could not check", not
  as "refused": `TokenAuth` logs them apart because an operator fixing the node
  and a user with a stale token are different problems.
  """
  def verify(token, timeout \\ @timeout) do
    if enabled?() do
      GenServer.call(__MODULE__, {:verify, token, timeout}, timeout + 1_000)
    else
      {:error, :disabled}
    end
  catch
    :exit, reason -> {:error, {:exit, reason}}
  end

  @doc false
  # The verify envelope, interpreted. Pure so the contract with the node can be
  # pinned by a test without a socket; the GenServer maps `:unsupported` to
  # `:unavailable` after logging it once.
  #
  # The unknown-action body is matched by its prefix and nothing else. The
  # node's message names the actions it does know, and that list has already
  # changed once; a match on the whole string would go stale the next time.
  def decode_verify(status, body) do
    case {status, Jason.decode(body || "")} do
      {200, {:ok, %{"ok" => true} = claims}} ->
        {:ok, Map.take(claims, ["user_uuid", "account_uuid", "environment_uuid"])}

      {401, {:ok, %{"ok" => false}}} ->
        {:error, :invalid}

      {400, {:ok, %{"error" => "unknown action" <> _}}} ->
        {:error, :unsupported}

      _ ->
        {:error, :unexpected}
    end
  end

  # ── GenServer ────────────────────────────────────────────────────────────

  @impl true
  def init(_opts), do: {:ok, %__MODULE__{}, {:continue, :connect}}

  @impl true
  def handle_continue(:connect, state), do: {:noreply, connect(state)}

  @impl true
  def handle_call(:ready?, _from, state), do: {:reply, state.subscribed?, state}

  def handle_call({:request, _m, _p, _b, _ct, _a, _t}, _from, %{subscribed?: false} = state) do
    # Refusing while the subscription is unconfirmed is deliberate. A frame sent
    # before `confirm_subscription` is routed to a channel that does not exist
    # yet (`connection.cr#message` looks the channel up and returns quietly when
    # it is missing), so it produces no reply at all — the caller would wait the
    # full timeout for a request the node never saw.
    {:reply, {:error, :not_connected}, state}
  end

  def handle_call(
        {:request, method, path, body, content_type, authorization, timeout},
        from,
        state
      ) do
    id = new_id()

    data =
      %{action: "request", id: id, method: method, path: path}
      |> maybe_put(:body, body)
      |> maybe_put(:content_type, content_type)
      # The CALLER's credential, relayed unread. The node sets it upstream and
      # the API judges it exactly as it would over HTTP. Without it every
      # authenticated read comes back "Missing Authorize token." while the
      # login beside it succeeds, because a login's credentials are in the body.
      |> maybe_put(:authorization, authorization)

    {:noreply, dispatch(state, id, data, from, timeout, :request)}
  end

  def handle_call({:verify, _token, _timeout}, _from, %{subscribed?: false} = state) do
    # Same reason as for `:request` above: unconfirmed means unrouted, and
    # unrouted means no reply ever.
    {:reply, {:error, :not_connected}, state}
  end

  def handle_call({:verify, _token, _timeout}, _from, %{verify_unsupported?: true} = state) do
    # Answered here rather than round-tripped: the node has already said it
    # does not know the action, and every socket open would otherwise send it
    # a frame it will 400 and add a line to a log that already said so once.
    {:reply, {:error, :unavailable}, state}
  end

  def handle_call({:verify, token, timeout}, from, state) do
    id = new_id()

    {:noreply,
     dispatch(state, id, %{action: "verify", id: id, token: token}, from, timeout, :verify)}
  end

  defp new_id, do: Base.url_encode64(:crypto.strong_rand_bytes(12), padding: false)

  # One path for both actions: encode, send, arm the timer, remember who asked.
  # The `kind` is what tells the reply handler how to read the envelope back —
  # an HTTP-shaped tuple for a request, a verdict for a verify.
  defp dispatch(state, id, data, from, timeout, kind) do
    state =
      send_frame(state, %{command: "message", identifier: @api_identifier, data: Jason.encode!(data)})

    timer = Process.send_after(self(), {:timeout, id}, timeout)
    %{state | pending: Map.put(state.pending, id, {from, timer, kind})}
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

      {{from, _timer, _kind}, pending} ->
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

  # "state.<scope>.<id>" out of an identifier, matching the node's own name for
  # the stream — so a log line here and a log line on the node say the same word.
  defp stream_label(identifier) do
    case Jason.decode(identifier) do
      {:ok, %{"scope" => scope, "id" => id}} -> "state.#{scope}.#{id}"
      _undecodable -> identifier
    end
  end

  defp handle_frame({:text, text}, state), do: handle_cable_message(Jason.decode(text), state)
  defp handle_frame({:close, _code, _reason}, state), do: schedule_reconnect(state)
  defp handle_frame(_frame, state), do: state

  defp handle_cable_message({:ok, %{"type" => "welcome"}}, state) do
    Process.send_after(self(), :subscribe_deadline, @subscribe_timeout)

    Enum.reduce(identifiers(), state, fn identifier, acc ->
      send_frame(acc, %{command: "subscribe", identifier: identifier})
    end)
  end

  defp handle_cable_message(
         {:ok, %{"type" => "confirm_subscription", "identifier" => identifier}},
         state
       ) do
    confirmed = MapSet.put(state.confirmed, identifier)

    if identifier == @api_identifier do
      Logger.info("api proxy: cable relay ready (#{System.get_env("CABLE_URL")})")
    end

    if identifier == @call_events_identifier do
      Logger.info("screen pop: singleton CallEvents subscription ready")
    end

    if identifier in state_identifiers() do
      Logger.info("events: recording #{stream_label(identifier)}")
    end

    %{state | subscribed?: MapSet.member?(confirmed, @api_identifier), confirmed: confirmed, attempts: 0}
  end

  defp handle_cable_message(
         {:ok, %{"type" => "reject_subscription", "identifier" => identifier}},
         state
       ) do
    # The node rejects this channel when CABLE_API_PROXY is not set — the one
    # cause worth naming, because everything else about the connection is fine
    # and the symptom is only that logins quietly take the HTTP path instead.
    if identifier == @api_identifier do
      Logger.error(
        "api proxy: subscription REJECTED — the node has CABLE_API_PROXY unset, " <>
          "so it is not relaying API requests"
      )
    else
      if identifier in state_identifiers() do
        Logger.error("events: #{stream_label(identifier)} subscription REJECTED")
      else
        Logger.error("screen pop: CallEvents subscription REJECTED")
      end
    end

    confirmed = MapSet.delete(state.confirmed, identifier)
    %{state | subscribed?: MapSet.member?(confirmed, @api_identifier), confirmed: confirmed}
  end

  defp handle_cable_message({:ok, %{"type" => type}}, state) when type in ["ping", "disconnect"],
    do: state

  defp handle_cable_message(
         {:ok, %{"message" => message, "identifier" => identifier}},
         state
       ) do
    case classify(identifier, message) do
      {:event, event} ->
        Connectix.Realtime.ScreenPop.handle_event(event)
        state

      {:record, event} ->
        # Stored and nothing else. These streams are subscribed to answer "did
        # this frame reach us", so the only handling they need is the record.
        Connectix.Events.record("StateChannel", event)
        state

      {:reply, %{"id" => id} = reply} ->
        answer_pending(state, id, reply)

      _ ->
        state
    end
  end

  defp handle_cable_message(_other, state), do: state

  defp answer_pending(state, id, message) do
    case Map.pop(state.pending, id) do
      {nil, _} ->
        # A reply whose request already timed out, or a duplicate. Dropping it
        # is right; logging it is what says the timeout was the node being slow
        # rather than the frame never arriving.
        Logger.debug("api proxy: reply for unknown id #{id}")
        state

      {{from, timer, kind}, pending} ->
        Process.cancel_timer(timer)
        {answer, state} = answer(kind, message, %{state | pending: pending})
        GenServer.reply(from, answer)
        state
    end
  end

  defp answer(:request, message, state) do
    {{:ok, message["status"] || 502, message["body"] || "", message["content_type"]}, state}
  end

  defp answer(:verify, message, state) do
    case decode_verify(message["status"], message["body"]) do
      {:error, :unsupported} ->
        # Once per connection, at ERROR, naming the cause. Without this the
        # only trace is `token verification unavailable (:unavailable)` per
        # socket open, which reads as the node being down when it is up and
        # merely old. The relay itself keeps working — `request` is unaffected.
        unless state.verify_unsupported? do
          Logger.error(
            "api proxy: the node predates the verify action (its ApiProxy channel " <>
              "only knows \"request\"), so no user token can be verified and every " <>
              "/ws/events upgrade will be refused until it runs a newer image"
          )
        end

        {{:error, :unavailable}, %{state | verify_unsupported?: true}}

      {:error, :unexpected} ->
        Logger.warning(
          "api proxy: unexpected verify reply (status #{inspect(message["status"])})"
        )

        {{:error, :unavailable}, state}

      verdict ->
        {verdict, state}
    end
  end

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
    for {_id, {from, timer, _kind}} <- state.pending do
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
        confirmed: MapSet.new(),
        pending: %{},
        attempts: attempts,
        verify_unsupported?: false
    }
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, _key, ""), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
