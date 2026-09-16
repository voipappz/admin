defmodule ConnectixWeb.Plugs.EngineProxy do
  @moduledoc """
  Forwards the mothership's own routes — `/auth`, `/api/`, `/tasks/` — upstream,
  so this app is a complete origin on its own.

  A browser opens its socket on the same origin it logged in against, and the
  Chrome extension posts `/auth/user_login` to this port before it has anything
  else. Neither can be sent to a second host: that is a CORS problem for the
  extension and a cookie/mixed-origin problem for the SPA. So the whole origin
  is fronted here and credential-owning routes are relayed to the API, which
  owns them.

  This is the last remnant of the Deno BFF's forwarder (`api/server.ts`'s
  `MOTHERSHIP_PREFIXES`), which is where the prefix list comes from. The BFF
  itself is gone; what it forwarded, this forwards.

  Unset `ENGINE_URL` and this is inert — nothing is proxied and unknown paths
  404 as they normally would.
  """

  @behaviour Plug

  require Logger

  # The three prefixes the mothership owns. `/tasks/` is easy to miss and the
  # SPA calls it on every login (`/tasks/customer_portal_data`); left out, it
  # falls through to the router and 404s.
  @engine_prefixes ["/auth", "/api/", "/tasks/"]

  # Paths that MATCH a forwarded prefix but this app answers itself. Each one is
  # a route that has moved, and the list is how a migration proceeds one route
  # at a time instead of all at once — when it holds every `/api/` path the
  # prefix above goes, and so does this.
  #
  # Exact paths, not prefixes: "/api/statuses" must not quietly capture
  # "/api/statuses/:uuid" the day that exists upstream.
  #
  # `/auth/user_login` is here because the portal PERFORMS the login now
  # (`Portal.AuthController`). Forwarding it made every session depend on an
  # upstream that had to be reachable, correct, and signing with the key this
  # app verifies — and when it was not, the symptom was a login that simply
  # did not work. The rest of `/auth` still forwards.
  @portal_owned ["/api/statuses", "/auth/user_login"]

  # …except these, which are THIS app's own routes and live under `/api` too
  # (see the router). Without the carve-out the forwarder swallows them and the
  # bots API answers with whatever the mothership says about a path it has
  # never heard of — a 404 that reads as a missing route in this app, or a 502
  # when no upstream is reachable. It cannot be caught by a test that leaves
  # both transports unconfigured, because the plug is inert there.
  #
  # `/api/events` is here as a prefix rather than in `@portal_owned` above
  # because there is nothing upstream it could ever collide with: these are the
  # frames THIS portal saw off the broker (`Connectix.Events`), and no
  # mothership has them. Without the carve-out every one of its four routes was
  # relayed and answered 401.
  @own_prefixes [
    "/api/bots",
    "/api/conversations",
    "/api/skills",
    "/api/openapi",
    "/api/docs",
    "/api/events"
  ]

  @hop_by_hop ~w(connection keep-alive transfer-encoding upgrade te trailer proxy-authorization)

  @impl true
  def init(opts), do: opts

  # A preflight is answered here rather than forwarded. It carries no
  # credentials and no body, and the upstream's answer is discarded anyway —
  # forwarding it buys a round trip and a wrong policy.
  @impl true
  def call(%Plug.Conn{method: "OPTIONS"} = conn, _opts) do
    cond do
      forwarded?(conn.request_path) -> preflight(conn)
      owned?(conn.request_path) -> preflight(conn)
      true -> conn
    end
  end

  def call(%Plug.Conn{} = conn, _opts) do
    cond do
      forwarded?(conn.request_path) ->
        proxy(conn, engine())

      # THE ROUTER ANSWERS IT, THIS PLUG DRESSES IT. A route that moved into
      # this app left the forwarder behind — and the forwarder was what put the
      # CORS headers on it. `/auth/user_login` answered 200 to curl and was
      # blocked by every browser, which is the worst shape a regression can
      # take: the server log says success and only the client knows.
      owned?(conn.request_path) ->
        Plug.Conn.register_before_send(conn, &put_cors/1)

      true ->
        conn
    end
  end

  # A path this app does NOT serve at all must fall through untouched,
  # including its preflight: answering one would promise a cross-origin caller
  # a request the router then 404s, and a 404 after a successful preflight is
  # the more confusing of the two failures.
  defp forwarded?(path),
    do: not owned?(path) and engine_path?(path) and engine() != ""

  # A path under a forwarded prefix that THIS app answers. Same origins call
  # it, so it needs the same CORS policy; the only difference is who composes
  # the body.
  defp owned?(path), do: path in @portal_owned

  defp preflight(conn) do
    conn
    |> put_cors()
    |> Plug.Conn.send_resp(204, "")
    |> Plug.Conn.halt()
  end

  # ONE TRANSPORT, and it is HTTP.
  #
  # This used to try a WebSocket relay first and fall back here, because that
  # the app's transport to the platform and HTTP was the hedge against a node
  # too old to carry the relay. Events moved to the broker and token
  # verification moved into this app, so the relay was the last thing on that
  # connection — and a request/reply hop through a WebSocket to reach an HTTP
  # API was only ever worth it when it bought something else.
  #
  # What that removes is a whole failure mode: a relay that connects, never
  # confirms its channel, and silently serves every login over the fallback
  # while health reported it ready.
  defp proxy(conn, upstream) do
    {:ok, body, conn} = read_body_fully(conn, "")
    over_http(conn, body, upstream)
  end

  defp over_http(conn, _body, "") do
    # `forwarded?/1` refuses the route without an upstream, so this is only
    # reachable if ENGINE_URL was unset between the check and here. Saying so
    # beats a 404 from the router, which reads as "that route does not exist".
    conn
    |> put_cors()
    |> Plug.Conn.put_resp_content_type("application/json")
    |> Plug.Conn.send_resp(502, ~s({"error":"upstream unavailable"}))
    |> Plug.Conn.halt()
  end

  defp over_http(conn, body, upstream) do
    url = upstream <> conn.request_path <> query(conn)

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
        log_upstream(conn, host_of(upstream), res.status)

        conn
        |> copy_headers(res.headers)
        |> put_cors()
        |> Plug.Conn.send_resp(res.status, res.body || "")
        |> Plug.Conn.halt()

      {:error, reason} ->
        # The upstream being down is an operational outcome, not a crash. 502
        # says which hop failed; a 500 from here would blame the wrong service.
        Logger.warning(
          "engine proxy: #{conn.method} #{conn.request_path} failed (#{inspect(reason)})"
        )

        conn
        |> put_cors()
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.send_resp(502, ~s({"error":"upstream unavailable"}))
        |> Plug.Conn.halt()
    end
  end

  # A proxied failure is otherwise invisible: the access log shows only
  # `Sent 401`, which is indistinguishable from this app rejecting the request
  # itself. Naming the upstream and the status says WHICH hop answered — the
  # difference between "wrong password" and "the mothership is down", which is
  # the first question asked every time a login fails.
  #
  # 404 is logged too, because the most confusing failure here is a request
  # that never had a route: a GET to a POST-only path (`/auth/user_login`
  # opened as a URL) answers 404 and reads as an outage.
  #
  # Method and path only — NEVER the query string or body. Credentials arrive
  # in both, and a log line is the easiest place in a system to leak them.
  defp log_upstream(conn, via, status) when status >= 400 do
    Logger.warning("proxy: #{conn.method} #{conn.request_path} -> #{status} via #{via}")
  end

  defp log_upstream(_conn, _via, _status), do: :ok

  # The two headers the frame carries. The node relays no others — it does not
  # blanket-forward the caller's headers, and it never sends its OWN token
  # upstream, which would make it a confused deputy.
  #
  # `content-type` because `/auth/user_login` is form-encoded and the API reads
  # the body by it. `authorization` because it is the CALLER's credential and
  # the API is what judges it; relaying a credential the caller already sent is
  # what a proxy does. Omitting it does not degrade gracefully — every
  # authenticated read answers "Missing Authorize token." while the login
  # beside it works, because a login carries its credentials in the body.

  defp host_of(upstream) do
    case URI.parse(upstream) do
      %URI{host: host, port: port} when is_binary(host) -> "#{host}:#{port}"
      _ -> upstream
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

      if k in @hop_by_hop or k == "content-length" or cors_header?(k),
        do: acc,
        else: Plug.Conn.put_resp_header(acc, k, v)
    end)
  end

  # CORS is owned here, not inherited from the upstream.
  #
  # This app is the origin: the Chrome extension posts `/auth/user_login` to
  # this port and opens its socket on the same host. It is a cross-origin
  # caller (`chrome-extension://<id>`), so its login is preflighted and every
  # answer needs an `Access-Control-Allow-Origin` the browser will accept.
  #
  # The upstream sends a CORS set built from an allowlist of WEB origins, which
  # cannot contain an extension id — so Kong answers the preflight `200` with
  # `access-control-allow-{credentials,headers,methods}` and no
  # `access-control-allow-origin` at all. Copying that through is worse than
  # sending nothing: the browser reports a bare network error with no status,
  # which reads as "the portal is down" rather than "the origin was refused".
  # So the upstream's headers are dropped (`cors_header?/1`) and replaced.
  #
  # `*` is what the Deno BFF sent while it fronted this origin, and it is the
  # only workable value here: an unpacked extension's id is generated per
  # install, so no allowlist can name it ahead of time. It grants a
  # cross-origin caller nothing it could not get from its own server — nothing
  # behind this plug is cookie-authenticated, the token travels in the body or
  # an `Authorization` header, and `*` is the one value a browser refuses to
  # send credentials with.
  @cors [
    {"access-control-allow-origin", "*"},
    {"access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"},
    {"access-control-allow-headers", "Content-Type, Authorization, Accept"},
    # Read by `apiList` for pagination; unreadable cross-origin unless exposed.
    {"access-control-expose-headers", "X-Total"},
    {"access-control-max-age", "3600"}
  ]

  defp put_cors(conn),
    do: Enum.reduce(@cors, conn, fn {k, v}, acc -> Plug.Conn.put_resp_header(acc, k, v) end)

  defp cors_header?(key), do: String.starts_with?(key, "access-control-")

  defp engine_path?(path) do
    Enum.any?(@engine_prefixes, &String.starts_with?(path, &1)) and
      not Enum.any?(@own_prefixes, &String.starts_with?(path, &1))
  end

  defp engine,
    do:
      (System.get_env("ENGINE_URL") || System.get_env("MOTHERSHIP_URL") || "")
      |> String.trim_trailing("/")
end
