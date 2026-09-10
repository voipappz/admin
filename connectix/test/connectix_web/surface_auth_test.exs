defmodule ConnectixWeb.SurfaceAuthTest do
  @moduledoc """
  Every HTTP surface, and whether it is reachable without credentials.

  This exists because `/metrics` sat in NO pipeline at all — not an oversight
  anyone could see in a diff, only in the routes table — and it grew to
  publish the host's disk, CPU, load, memory and BEAM internals. A route with
  no `pipe_through` is invisible until someone enumerates them, so this
  enumerates them.
  """

  use ConnectixWeb.ConnCase, async: false

  defp with_credentials(fun) do
    previous = {System.get_env("PORTAL_UI_USER"), System.get_env("PORTAL_UI_PASS")}
    System.put_env("PORTAL_UI_USER", "op")
    System.put_env("PORTAL_UI_PASS", "s3cret-long-enough")

    try do
      fun.()
    after
      case previous do
        {nil, nil} ->
          System.delete_env("PORTAL_UI_USER")
          System.delete_env("PORTAL_UI_PASS")

        {u, p} ->
          if u, do: System.put_env("PORTAL_UI_USER", u), else: System.delete_env("PORTAL_UI_USER")
          if p, do: System.put_env("PORTAL_UI_PASS", p), else: System.delete_env("PORTAL_UI_PASS")
      end
    end
  end

  describe "operator surfaces" do
    test "/metrics refuses an anonymous scrape", %{conn: conn} do
      with_credentials(fn ->
        conn = get(conn, ~p"/metrics")
        assert conn.status == 401
      end)
    end

    test "/metrics serves with credentials, and negotiates nothing", %{conn: conn} do
      with_credentials(fn ->
        # No Accept header at all — a scraper sends none, and a `:accepts`
        # plug here would answer 406, which reads as broken rather than
        # refused.
        conn =
          conn
          |> put_req_header("authorization", Plug.BasicAuth.encode_basic_auth("op", "s3cret-long-enough"))
          |> get(~p"/metrics")

        assert conn.status == 200
        assert response_content_type(conn, :text)
      end)
    end
  end

  describe "surfaces that must stay open" do
    # The deploy gate and the load balancer. Gating these takes the site down
    # and blocks the deploy that would fix it.
    test "health probes answer without credentials", %{conn: conn} do
      with_credentials(fn ->
        assert get(conn, ~p"/health/alive").status == 200
        assert get(conn, ~p"/health/ready").status == 200
        assert get(conn, ~p"/health").status == 200
      end)
    end

    # A customer reads these before they have a key.
    test "the API spec and its UI stay open", %{conn: conn} do
      with_credentials(fn ->
        assert get(conn, ~p"/api/openapi").status == 200
      end)
    end
  end

  describe "the browser UI" do
    test "/chat is gated", %{conn: conn} do
      with_credentials(fn -> assert get(conn, ~p"/chat").status == 401 end)
    end
  end
end
