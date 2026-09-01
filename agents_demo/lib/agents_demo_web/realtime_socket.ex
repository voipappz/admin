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

    {:push, {:text, Jason.encode!(welcome)}, state}
  end

  # Frames arriving from the upstream fan-out are already contract-shaped.
  @impl true
  def handle_info({:realtime, frame}, state) do
    {:push, {:text, Jason.encode!(frame)}, state}
  end

  def handle_info(_other, state), do: {:ok, state}

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
  def ensure_cable(%{user_uuid: user_uuid, token: token})
      when is_binary(user_uuid) and is_binary(token) do
    if AgentsDemo.Realtime.CableClient.enabled?() do
      spec = {AgentsDemo.Realtime.CableClient, user_uuid: user_uuid, token: token}

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
