defmodule AgentsDemoWeb.RealtimeSocket do
  @moduledoc """
  `/ws/events` — the browser's realtime feed.

  A plain `WebSock` handler, not a Phoenix Channel. The contract
  (`voipappz/chrome/docs/REALTIME_CONTRACT.md`) is a flat JSON frame protocol
  that shipped clients already speak; Channels would wrap every message in their
  own join/ref envelope and break all of them. Phoenix is the runtime here, not
  the protocol.

  Authentication is the token the user already holds, offered as a subprotocol
  (`voipappz-bearer.<base64url>`) because a browser cannot set `Authorization`
  on a WebSocket handshake and a query parameter is written verbatim into every
  proxy and access log along the way.

  Which streams a connection receives follows from that token's claims. The
  client subscribes to nothing and names nobody.
  """

  @behaviour WebSock

  require Logger

  alias AgentsDemo.Realtime.TokenAuth

  # HOW OFTEN THIS SOCKET PINGS ITS CLIENT, and why it must.
  #
  # `upgrade/1` sets a 60s idle timeout, and this connection is idle by design:
  # the portal pushes only when an event happens, and the client sends nothing
  # after the handshake. So every socket died about a minute after it opened,
  # taking the user's SessionRegistry entry with it — and presence is what gates
  # a screen pop, so pops then silently stopped for a user whose extension was
  # still open. It presented as "the pop does not work", never as a disconnect.
  #
  # A TEXT frame, not a protocol ping, and that distinction is the whole point.
  #
  # The client is a Manifest V3 extension, so its background is a service worker
  # and Chrome terminates one that has been idle for ~30s. A protocol ping is
  # answered by the browser's network stack without waking the worker's JS, so
  # it keeps the TCP connection alive and lets Chrome kill the worker anyway —
  # measured: a session registered at 16:25:49 was gone by 16:26:27, with a
  # 25s protocol ping running and no error on either side. A MESSAGE reaches
  # `onmessage`, which is what resets Chrome's idle timer.
  #
  # `backgroundPage.ts` switches on `frame.type` and ignores what it does not
  # know, so this needs no client change. Under 30s with room to miss one.
  @heartbeat_ms 15_000

  @impl true
  def init({claims, topics}) do
    # One PubSub subscription per entitlement. The upstream is a single NATS
    # connection with wildcard subscriptions, fanned out here — no per-user and
    # certainly no per-tab upstream connection.
    if claims.user_uuid do
      Phoenix.PubSub.subscribe(AgentsDemo.PubSub, "realtime:user:#{claims.user_uuid}")
    end

    if claims.account_uuid do
      Phoenix.PubSub.subscribe(AgentsDemo.PubSub, "realtime:account:#{claims.account_uuid}")
    end

    # Registry membership is tied to this WebSocket process and disappears
    # automatically when it exits. ScreenPop uses it as the no-queue presence
    # check before broadcasting a browser command.
    AgentsDemo.Realtime.ScreenPop.load_environment(claims.environment_uuid)
    register_session(claims.user_uuid, claims.environment_uuid)

    # Hold this user's cable connection for as long as a browser of theirs is
    # here. The uuid and token come from the verified claims, never from the
    # client — which is the whole reason this is opened here and not there.
    AgentsDemoWeb.RealtimeSocket.ensure_cable(claims)

    state = %{claims: claims, topics: MapSet.new(topics)}

    welcome = %{
      type: "welcome",
      ts: DateTime.utc_now() |> DateTime.to_iso8601(),
      subscribed: MapSet.to_list(state.topics),
      clients: 1,
      cable_ready: true
    }

    schedule_heartbeat()

    {:push, {:text, Jason.encode!(welcome)}, state}
  end

  # Frames arriving from the upstream fan-out are already contract-shaped.
  @impl true
  def handle_info({:realtime, frame}, state) do
    {:push, {:text, Jason.encode!(frame)}, state}
  end

  # Keeps the idle timer from firing on a connection that is simply quiet.
  # BOTH frames, every time, and neither is redundant:
  #
  #   * the protocol ping is answered by the browser with a pong, and that
  #     INBOUND frame is what resets Bandit's `timeout:` — which measures data
  #     RECEIVED, not sent. A message the server pushes cannot reset it, so the
  #     text frame alone left the socket closing on schedule.
  #   * the text frame reaches `onmessage`, which is what stops Chrome
  #     terminating an idle MV3 service worker. A pong never reaches JS, so the
  #     ping alone let the worker die with the socket still open.
  #
  # Measured with the text frame only: registrations at 17:58:46, 17:59:49,
  # 18:00:52, 18:01:55 — every 63s, the 60s timeout plus a reconnect.
  def handle_info(:heartbeat, state) do
    schedule_heartbeat()

    {:push,
     [
       {:ping, ""},
       {:text, Jason.encode!(%{type: "ping", ts: DateTime.utc_now() |> DateTime.to_iso8601()})}
     ], state}
  end

  def handle_info(_other, state), do: {:ok, state}

  @doc false
  def heartbeat_ms, do: @heartbeat_ms

  defp schedule_heartbeat, do: Process.send_after(self(), :heartbeat, @heartbeat_ms)

  @impl true
  def handle_in({text, [opcode: :text]}, state) do
    case Jason.decode(text) do
      {:ok, %{"action" => "subscribe", "topic" => topic}} when is_binary(topic) ->
        topics = MapSet.put(state.topics, topic)

        ack(
          %{type: "subscribed", topic: topic, subscribed: MapSet.to_list(topics)},
          %{state | topics: topics}
        )

      {:ok, %{"action" => "unsubscribe", "topic" => topic}} when is_binary(topic) ->
        topics = MapSet.delete(state.topics, topic)

        ack(
          %{type: "unsubscribed", topic: topic, subscribed: MapSet.to_list(topics)},
          %{state | topics: topics}
        )

      _ ->
        # One malformed frame must not take the socket down with it.
        {:ok, state}
    end
  end

  def handle_in(_frame, state), do: {:ok, state}

  @impl true
  # The cable connection deliberately OUTLIVES one socket: a reload or a second
  # tab must not drop the user's registration and re-stamp it a moment later.
  # It is reaped when its own connection dies, not per browser socket.
  def terminate(_reason, _state), do: :ok

  @doc false
  def ensure_cable(%{user_uuid: user_uuid, token: token} = claims)
      when is_binary(user_uuid) and is_binary(token) do
    if AgentsDemo.Realtime.CableClient.enabled?() do
      # What cable is given is minted here from the identity NATS already
      # verified — not the browser's own token passed along unread. Without a
      # configured secret this returns that token unchanged, so an
      # unconfigured deployment is untouched. See `Realtime.CableToken`.
      spec =
        {AgentsDemo.Realtime.CableClient,
         user_uuid: user_uuid,
         environment_uuid: claims.environment_uuid,
         token: AgentsDemo.Realtime.CableToken.for(claims)}

      case DynamicSupervisor.start_child(AgentsDemo.Realtime.CableSupervisor, spec) do
        {:ok, _pid} ->
          :ok

        {:error, {:already_started, _pid}} ->
          :ok

        {:error, reason} ->
          require Logger
          Logger.warning("cable: start failed — #{inspect(reason)}")
      end
    end

    :ok
  end

  def ensure_cable(_claims), do: :ok

  @doc false
  def register_session(user_uuid, environment_uuid)
      when is_binary(user_uuid) and user_uuid != "" and is_binary(environment_uuid) and
             environment_uuid != "" do
    Logger.info("session: registered #{user_uuid} in environment #{environment_uuid}")

    case Registry.register(AgentsDemo.Realtime.SessionRegistry, user_uuid, environment_uuid) do
      {:ok, _} -> :ok
      {:error, {:already_registered, _pid}} -> :ok
    end
  end

  # A verified socket whose token carries NO environment still registers, under
  # the user alone. The mothership's login JWT currently carries `user_uuid` and
  # nothing else — the environment is in the login RESPONSE, not the token — so
  # the guarded clause above never matched for a real extension and this
  # returned :ok having registered nobody. Silently: the socket worked, state
  # flowed, and only the screen pop was missing, because `online?` had no
  # session to find.
  #
  # `nil` is stored deliberately rather than a placeholder. `ScreenPop.online?/2`
  # compares the registered environment to the event's and so still says no for
  # these sessions — correct, because an event naming an environment cannot be
  # proven to be this user's. `online_user?/1` asks only whether the user has a
  # socket, which is the right question for an event that arrived on that user's
  # own stream.
  def register_session(user_uuid, _environment_uuid)
      when is_binary(user_uuid) and user_uuid != "" do
    Logger.info("session: registered #{user_uuid} with no environment (token carries none)")

    case Registry.register(AgentsDemo.Realtime.SessionRegistry, user_uuid, nil) do
      {:ok, _} -> :ok
      {:error, {:already_registered, _pid}} -> :ok
    end
  end

  def register_session(_user_uuid, _environment_uuid), do: :ok

  defp ack(frame, state), do: {:push, {:text, Jason.encode!(frame)}, state}

  # ── Upgrade ────────────────────────────────────────────────────────────────

  @bearer_prefix "voipappz-bearer."

  @doc """
  Authenticates the handshake and upgrades, or refuses.

  Called from the endpoint. Returns the `Plug.Conn`, upgraded on success and
  answered with a status on failure — a browser cannot read a body from a failed
  WebSocket upgrade, so the status is the whole message.
  """
  def upgrade(conn) do
    with {:ok, token, protocol} <- token(conn),
         {:ok, claims} <- TokenAuth.verify(token) do
      topics =
        conn.query_params
        |> Map.get("topics", "#")
        |> String.split(",", trim: true)
        |> Enum.map(&String.trim/1)
        |> Enum.reject(&(&1 == ""))

      conn
      |> maybe_accept_protocol(protocol)
      |> WebSockAdapter.upgrade(__MODULE__, {claims, topics}, timeout: 60_000)
      |> Plug.Conn.halt()
    else
      {:error, reason} ->
        Logger.info("realtime: refused websocket upgrade (#{inspect(reason)})")

        conn
        |> Plug.Conn.send_resp(401, "")
        |> Plug.Conn.halt()
    end
  end

  # The offered subprotocol must be echoed back, or the browser fails the
  # handshake for a protocol it did not agree to.
  defp maybe_accept_protocol(conn, nil), do: conn

  defp maybe_accept_protocol(conn, protocol),
    do: Plug.Conn.put_resp_header(conn, "sec-websocket-protocol", protocol)

  defp token(conn) do
    case Plug.Conn.get_req_header(conn, "authorization") do
      ["Bearer " <> token | _] when token != "" ->
        {:ok, String.trim(token), nil}

      _ ->
        conn
        |> Plug.Conn.get_req_header("sec-websocket-protocol")
        |> Enum.flat_map(&String.split(&1, ","))
        |> Enum.map(&String.trim/1)
        |> Enum.find(&String.starts_with?(&1, @bearer_prefix))
        |> decode_bearer()
    end
  end

  defp decode_bearer(nil), do: {:error, :missing_token}

  defp decode_bearer(protocol) do
    encoded = String.replace_prefix(protocol, @bearer_prefix, "")

    case Base.url_decode64(encoded, padding: false) do
      {:ok, token} when token != "" -> {:ok, token, protocol}
      _ -> {:error, :bad_bearer_encoding}
    end
  end
end
