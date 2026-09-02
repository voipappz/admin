defmodule AgentsDemoWeb.Plugs.EngineProxyTest do
  @moduledoc """
  The origin's CORS contract.

  The Chrome extension is the caller that makes this load-bearing: it posts
  `/auth/user_login` from `chrome-extension://<id>`, an origin no upstream
  allowlist can name, so if this app does not answer for itself the browser
  blocks the login before the extension ever sees the token.
  """

  # System.put_env — the plug reads its configuration at call time.
  use ExUnit.Case, async: false

  import Plug.Conn
  import Plug.Test

  alias AgentsDemoWeb.Plugs.EngineProxy

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
        |> conn("/auth/user_login")
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
        |> conn("/auth/user_login", ~s({"email":"a@b.c","password":"x"}))
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
        |> conn("/auth/user_login", "{}")
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
end
