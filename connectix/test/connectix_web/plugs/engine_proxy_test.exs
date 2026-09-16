defmodule ConnectixWeb.Plugs.EngineProxyTest do
  @moduledoc """
  The origin's CORS contract.

  The Chrome extension is the caller that makes this load-bearing: it posts
  `/auth/refresh_token` from `chrome-extension://<id>`, an origin no upstream
  allowlist can name, so if this app does not answer for itself the browser
  blocks the call before the extension sees the response.

  The examples here deliberately do NOT use `/auth/user_login`: the portal
  performs that one itself now (`Portal.AuthController`), so it is in
  `@portal_owned` and never reaches this plug. Testing the forwarder with a
  path it no longer forwards asserts nothing.
  """

  # System.put_env — the plug reads its configuration at call time.
  use ExUnit.Case, async: false

  import Plug.Conn
  import Plug.Test

  alias ConnectixWeb.Plugs.EngineProxy

  @extension "chrome-extension://kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk"

  setup do
    engine = System.get_env("ENGINE_URL")

    on_exit(fn -> restore("ENGINE_URL", engine) end)

    :ok
  end

  defp restore(var, nil), do: System.delete_env(var)
  defp restore(var, value), do: System.put_env(var, value)

  defp call(conn), do: EngineProxy.call(conn, EngineProxy.init([]))

  describe "preflight" do
    test "a forwarded path is answered here, without a round trip upstream" do
      # Deliberately unreachable: a preflight that needs the upstream to answer
      # would fail this, which is the point.
      System.put_env("ENGINE_URL", "http://127.0.0.1:1")

      conn =
        :options
        |> conn("/auth/refresh_token")
        |> put_req_header("origin", @extension)
        |> put_req_header("access-control-request-method", "POST")
        |> call()

      assert conn.status == 204
      assert conn.halted
      assert get_resp_header(conn, "access-control-allow-origin") == ["*"]
      assert [methods] = get_resp_header(conn, "access-control-allow-methods")
      assert methods =~ "POST"
      assert methods =~ "OPTIONS"
      assert [headers] = get_resp_header(conn, "access-control-allow-headers")
      assert headers =~ "Content-Type"
    end

    test "a path this app does not forward falls through untouched" do
      # `/health` is this app's own route. Answering a preflight for it would
      # promise a cross-origin caller a request that the router then handles
      # under a different policy — and a preflight must not describe a
      # permission this plug does not grant.
      conn = :options |> conn("/health/alive") |> put_req_header("origin", @extension) |> call()

      refute conn.halted
      assert get_resp_header(conn, "access-control-allow-origin") == []
    end
  end

  describe "proxied responses" do
    setup do
      # The upstream's own CORS set: an allowlist of web origins that cannot
      # contain an extension id, so it answers WITHOUT allow-origin. Copying
      # this through is the bug — the browser gets a response it must refuse.
      upstream = fn conn, _opts ->
        conn
        |> put_resp_header("access-control-allow-credentials", "true")
        |> put_resp_header("access-control-allow-methods", "GET, POST")
        |> put_resp_content_type("application/json")
        |> send_resp(401, ~s({"message":"bad credentials"}))
      end

      {:ok, pid} = Bandit.start_link(plug: upstream, port: 0, startup_log: false)
      {:ok, {_ip, port}} = ThousandIsland.listener_info(pid)
      on_exit(fn -> Process.exit(pid, :normal) end)

      System.put_env("ENGINE_URL", "http://127.0.0.1:#{port}")
      :ok
    end

    test "carry this app's allow-origin, not the upstream's missing one" do
      conn =
        :post
        |> conn("/auth/refresh_token", ~s({"token":"x"}))
        |> put_req_header("content-type", "application/json")
        |> put_req_header("origin", @extension)
        |> call()

      # The upstream's status and body still pass through untouched: this is a
      # proxy, and a failed login must stay a failed login.
      assert conn.status == 401
      assert conn.resp_body =~ "bad credentials"

      assert get_resp_header(conn, "access-control-allow-origin") == ["*"]
    end

    test "the upstream's CORS headers are dropped rather than merged" do
      conn =
        :post
        |> conn("/auth/refresh_token", "{}")
        |> put_req_header("content-type", "application/json")
        |> call()

      # `*` and `allow-credentials: true` together are a combination every
      # browser rejects outright, so one policy has to win completely.
      assert get_resp_header(conn, "access-control-allow-credentials") == []

      assert get_resp_header(conn, "access-control-allow-methods") == [
               "GET, POST, PUT, PATCH, DELETE, OPTIONS"
             ]
    end
  end

  describe "one transport, and it is HTTP" do
    # The WebSocket relay this used to try FIRST is gone. Events moved to the
    # broker and token verification moved into this app, so a request/reply hop
    # through a socket to reach an HTTP API bought nothing — and what it cost
    # was a relay that could connect, never confirm its channel, and serve
    # every login over the fallback while health reported it ready.
    setup do
      test = self()

      upstream = fn conn, _opts ->
        {:ok, body, conn} = Plug.Conn.read_body(conn)

        send(
          test,
          {:upstream, conn.method, conn.request_path, conn.query_string, body,
           Plug.Conn.get_req_header(conn, "authorization")}
        )

        send_resp(conn, 401, ~s({"error":"nope"}))
      end

      {:ok, pid} = Bandit.start_link(plug: upstream, port: 0, startup_log: false)
      {:ok, {_ip, port}} = ThousandIsland.listener_info(pid)
      on_exit(fn -> Process.exit(pid, :normal) end)

      System.put_env("ENGINE_URL", "http://127.0.0.1:#{port}")
      :ok
    end

    test "the upstream's status is served through, never reinterpreted" do
      # A 401 from the API is a successful proxy of a refusal, not a failure
      # of this hop, so it is passed on exactly as it arrived.
      conn =
        :post
        |> conn("/auth/refresh_token", "token=abc")
        |> put_req_header("content-type", "application/x-www-form-urlencoded")
        |> call()

      assert_receive {:upstream, "POST", "/auth/refresh_token", _q, "token=abc", _auth}
      assert conn.status == 401
      assert conn.halted
    end

    test "the query string travels on the path rather than being dropped" do
      # Dropping it turns every filtered read into an unfiltered one, which is
      # a wrong answer rather than an error.
      assert %{status: 401} = call(conn(:get, "/api/calls?limit=5"))
      assert_receive {:upstream, "GET", "/api/calls", "limit=5", _body, _auth}
    end

    test "the caller's Authorization is carried upstream" do
      :get
      |> conn("/api/features")
      |> put_req_header("authorization", "Bearer tok")
      |> call()

      assert_receive {:upstream, "GET", "/api/features", _q, _body, ["Bearer tok"]}
    end

    test "no Authorization header means none is sent, not an empty one" do
      call(conn(:get, "/api/features"))
      assert_receive {:upstream, "GET", "/api/features", _q, _body, []}
    end


    test "the login is not forwarded, because this app performs it" do
      # It used to go upstream, which made every session depend on a mothership
      # being reachable and signing with the key this portal verifies against.
      # When it was not, the symptom was a login that simply did not work.
      refute call(conn(:post, "/auth/user_login", "email=a@b.c")).halted
      refute_receive {:upstream, _m, "/auth/user_login", _q, _b, _a}, 200
    end

    test "with no upstream configured the route is not forwarded at all" do
      # Both names, because `engine/0` falls back to MOTHERSHIP_URL — and the
      # fallback is what a deployment sets when it has one mothership for
      # everything.
      mothership = System.get_env("MOTHERSHIP_URL")
      System.delete_env("ENGINE_URL")
      System.delete_env("MOTHERSHIP_URL")
      on_exit(fn -> restore("MOTHERSHIP_URL", mothership) end)

      refute call(conn(:get, "/api/features")).halted
    end
  end
end
