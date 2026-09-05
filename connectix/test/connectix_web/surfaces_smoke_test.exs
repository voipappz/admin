defmodule ConnectixWeb.SurfacesSmokeTest do
  @moduledoc """
  Every browser-reachable surface, asserted by status code.

  This is the cheapest test in the suite and it exists because the expensive
  version — a person loading the app and telling us it was broken — is how the
  following were actually found:

    * `/voice/assets/*.js` answering **403**. The route sat in the `:browser`
      pipeline, whose `protect_from_forgery` refuses a plain GET that returns
      `text/javascript` (its cross-origin-script-inclusion guard). The voice
      client could not load at all, and nothing failed except the browser.
    * `/` and `/chat` answering **500** while a half-written module was on
      disk, with no test that would have gone red first.
    * The whole app answering **401** once Basic Auth was configured, because
      `Connectix.Config.basic_auth/0` reads the environment at call time and
      the suite inherits `.env`.

  A route list with expected statuses catches all three shapes, so it is worth
  more than its length suggests. Keep it exhaustive rather than tidy: a surface
  missing from here is a surface nobody is checking.
  """

  # `async: false` on purpose: `unauthenticated` sets PORTAL_UI_* for the whole
  # OS process, and `ConnCase` resets shared Mnesia tables per test.
  use ConnectixWeb.ConnCase, async: false

  @voice_bundle "index-DxPxMeTe.js"

  describe "authenticated surfaces" do
    test "the LiveView UI answers", %{conn: conn} do
      assert html_status(conn, "/") == 200
      assert html_status(conn, "/chat") == 200
    end

    test "the vendored voice client and its bundle answer", %{conn: conn} do
      # 302: `/voice` resolves the conversation and redirects to `/voice/page`
      # carrying the `?ws=` the pipecat client reads out of `location.search`.
      assert html_status(conn, "/voice") == 302
      assert html_status(conn, "/voice/page") == 200
    end

    @tag :regression
    test "the voice JS bundle is not refused by CSRF", %{conn: conn} do
      # The regression this whole file was written for. A `:browser`-pipeline
      # route returning `text/javascript` is answered 403 by
      # `Plug.CSRFProtection`, so this must stay a plain GET with no CSRF token
      # — exactly what a `<script src>` sends.
      conn = get(conn, "/voice/assets/#{@voice_bundle}")

      assert conn.status == 200,
             "voice bundle answered #{conn.status}; a 403 here means the route " <>
               "has drifted back into a CSRF-protected pipeline and the voice " <>
               "UI cannot load"

      assert get_resp_header(conn, "content-type") |> to_string() =~ "javascript"
    end

    test "a bundle that does not exist is 404, not 500", %{conn: conn} do
      assert html_status(conn, "/voice/assets/no-such-bundle.js") == 404
    end

    test "path traversal out of the asset directory is refused", %{conn: conn} do
      refute html_status(conn, "/voice/assets/..%2f..%2fsecret") == 200
    end

    test "logout answers a fresh challenge", %{conn: conn} do
      # Basic Auth has no server-side logout; answering 401 with a challenge is
      # the only thing that makes a browser forget the cached credential.
      conn = get(conn, "/logout")
      assert conn.status == 401
      assert get_resp_header(conn, "www-authenticate") != []
    end
  end

  describe "unauthenticated surfaces" do
    test "probes never require credentials", %{conn: conn} do
      # Deliberately in no pipeline at all: a load balancer sends no Accept
      # header and holds no credential, and a probe answered 401 or 406 reads
      # as an unhealthy node.
      for path <- ~w(/health /health/alive /health/ready) do
        assert json_status(conn, path) == 200, "#{path} must answer without auth"
      end
    end

    test "the API spec is readable before you have a key", %{conn: conn} do
      assert json_status(conn, "/api/openapi") == 200
    end
  end

  describe "the Basic Auth gate" do
    test "refuses the UI when configured and no credential is sent" do
      with_basic_auth("smoke-user", "smoke-pass", fn ->
        conn = get(Phoenix.ConnTest.build_conn(), "/chat")

        assert conn.status == 401
        assert get_resp_header(conn, "www-authenticate") != []
      end)
    end

    test "admits the UI when the right credential is sent" do
      with_basic_auth("smoke-user", "smoke-pass", fn ->
        conn =
          Phoenix.ConnTest.build_conn()
          |> put_req_header("authorization", "Basic " <> Base.encode64("smoke-user:smoke-pass"))
          |> put_req_header("accept", "text/html")
          |> get("/chat")

        assert conn.status == 200
      end)
    end

    test "still lets the health probes through" do
      with_basic_auth("smoke-user", "smoke-pass", fn ->
        conn = get(Phoenix.ConnTest.build_conn(), "/health/ready")
        assert conn.status == 200
      end)
    end
  end

  # A browser navigating sends `Accept: text/html`; several plugs branch on it,
  # so asserting a status without it tests a request no browser makes.
  defp html_status(conn, path) do
    conn |> put_req_header("accept", "text/html") |> get(path) |> Map.fetch!(:status)
  end

  defp json_status(conn, path) do
    conn |> put_req_header("accept", "application/json") |> get(path) |> Map.fetch!(:status)
  end

  # PORTAL_UI_* are read at call time and are process-global, so they are set
  # around one assertion and restored however it exits.
  defp with_basic_auth(user, pass, fun) do
    previous = Enum.map(~w(PORTAL_UI_USER PORTAL_UI_PASS), &{&1, System.get_env(&1)})

    System.put_env("PORTAL_UI_USER", user)
    System.put_env("PORTAL_UI_PASS", pass)

    try do
      fun.()
    after
      for {name, value} <- previous do
        if value, do: System.put_env(name, value), else: System.delete_env(name)
      end
    end
  end
end
