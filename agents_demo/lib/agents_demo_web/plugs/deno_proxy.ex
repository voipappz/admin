defmodule AgentsDemoWeb.Plugs.DenoProxy do
  @moduledoc """
  Forwards anything this app has not taken over yet to the Deno service.

  A strangler, not a permanent fixture. Elixir becomes the single entry point
  immediately — the SPA and the realtime socket are served here — while routes
  still backed by the DuckDB event store keep working untouched. Each one moves
  when its data source does, and the day the last one moves this plug and
  `DENO_URL` are deleted together.

  The alternative was reaching parity on ~3,500 lines before the first deploy,
  which is a big-bang cutover wearing a migration costume.

  Unset `DENO_URL` and this is inert — nothing is proxied and unknown paths 404
  as they normally would.
  """

  @behaviour Plug

  require Logger

  # Paths STILL SERVED BY DENO. An allowlist, not a catch-all: the router
  # raises on an unmatched path rather than falling through, so a catch-all
  # would have to sit in front of it — and would then swallow this app's own
  # routes. Naming Deno's paths explicitly keeps the boundary visible and
  # shrinks it one line at a time.
  @proxied [
    "/events",
    "/calls",
    "/dashboard",
    "/transcript",
    "/read",
    "/mark-all-read",
    "/rest/v1",
    "/mcp",
    "/connectors"
  ]

  @hop_by_hop ~w(connection keep-alive transfer-encoding upgrade te trailer proxy-authorization)

  @impl true
  def init(opts), do: opts

  @impl true
  def call(%Plug.Conn{} = conn, _opts) do
    cond do
      # A browser opens its socket on the same origin it logged in against, so
      # this app has to answer /auth too — forwarded to the mothership, which
      # owns credentials. Same reason the SPA's routes are forwarded to Deno:
      # front the whole origin, move what is behind it one piece at a time.
      engine_path?(conn.request_path) and engine() != "" -> proxy(conn, engine())
      not proxied?(conn.request_path) -> conn
      target() == "" -> conn
      true -> proxy(conn, target())
    end
  end

  defp proxied?(path),
    do: Enum.any?(@proxied, &(path == &1 or String.starts_with?(path, &1 <> "/")))

  defp proxy(conn, upstream) do
    url = upstream <> conn.request_path <> query(conn)
    {:ok, body, conn} = read_body_fully(conn, "")

    opts = [
      method: conn.method |> String.downcase() |> String.to_existing_atom(),
      url: url,
      headers: forwardable(conn.req_headers),
      decode_body: false,
      retry: false,
      receive_timeout: 30_000
    ]

    # `:body` is added only when there IS one. Req infers POST from the presence
    # of a body and that inference beats an explicit `method: :get`, so passing
    # `body: ""` on a GET sent the upstream a POST — which answered 404 for
    # every read route (`/api/features`, `/tasks/customer_portal_data`) while
    # the POST logins kept working, so the proxy looked half-broken rather than
    # wrong in one specific way.
    opts = if body == "", do: opts, else: Keyword.put(opts, :body, body)

    case Req.request(opts) do
      {:ok, res} ->
        conn
        |> copy_headers(res.headers)
        |> Plug.Conn.send_resp(res.status, res.body || "")
        |> Plug.Conn.halt()

      {:error, reason} ->
        # The upstream being down is an operational outcome, not a crash. 502
        # says which hop failed; a 500 from here would blame the wrong service.
        Logger.warning(
          "deno proxy: #{conn.method} #{conn.request_path} failed (#{inspect(reason)})"
        )

        conn
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.send_resp(502, ~s({"error":"upstream unavailable"}))
        |> Plug.Conn.halt()
    end
  end

  defp query(%Plug.Conn{query_string: ""}), do: ""
  defp query(%Plug.Conn{query_string: qs}), do: "?" <> qs

  defp read_body_fully(conn, acc) do
    case Plug.Conn.read_body(conn) do
      {:ok, chunk, conn} -> {:ok, acc <> chunk, conn}
      {:more, chunk, conn} -> read_body_fully(conn, acc <> chunk)
      {:error, _reason} -> {:ok, acc, conn}
    end
  end

  # Hop-by-hop headers describe THIS connection and must not be relayed onto
  # the next one; `host` would send the upstream a name it does not serve; and
  # `content-length` describes the body we just consumed — forwarding the
  # original leaves the upstream waiting for bytes that are not coming, which
  # presents as a hang rather than an error.
  defp forwardable(headers),
    do:
      Enum.reject(headers, fn {k, _v} ->
        k in @hop_by_hop or k in ["host", "content-length"]
      end)

  defp copy_headers(conn, headers) do
    Enum.reduce(headers, conn, fn {key, value}, acc ->
      k = String.downcase(key)
      v = if is_list(value), do: Enum.join(value, ", "), else: value

      if k in @hop_by_hop or k == "content-length",
        do: acc,
        else: Plug.Conn.put_resp_header(acc, k, v)
    end)
  end

  defp target, do: (System.get_env("DENO_URL") || "") |> String.trim_trailing("/")

  # The three prefixes Deno's own forwarder sends to the mothership
  # (`MOTHERSHIP_PREFIXES` in api/server.ts). `/tasks/` is easy to miss and the
  # SPA calls it on every login (`/tasks/customer_portal_data`); left out, it
  # falls through to the router and 404s.
  @engine_prefixes ["/auth", "/api/", "/tasks/"]

  defp engine_path?(path),
    do: Enum.any?(@engine_prefixes, &String.starts_with?(path, &1))

  defp engine,
    do:
      (System.get_env("ENGINE_URL") || System.get_env("MOTHERSHIP_URL") || "")
      |> String.trim_trailing("/")
end
