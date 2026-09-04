defmodule ConnectixWeb.Portal.StatusControllerTest do
  @moduledoc """
  `/api/statuses` is answered here, not forwarded.

  It matches `@engine_prefixes`' `/api/`, so without the portal-owned exception
  in `Plugs.EngineProxy` it would be relayed — and over cable that currently
  returns 401, because the node forwards `Content-Type` and drops the caller's
  `Authorization` with it.

  Plain `ExUnit.Case` and the router directly, NOT `ConnCase`: this route reads
  no database, and `ConnCase` would put the whole suite behind a Postgres the
  portal is losing. The same reason `engine_proxy_test.exs` beside it does the
  same thing.
  """

  use ExUnit.Case, async: true

  import Plug.Test

  alias ConnectixWeb.Router

  # `fetch_query_params/1` explicitly: the Endpoint's plug chain does it in a
  # real request, and calling the Router alone skips it — which silently hands
  # the controller `params["type"] == nil` and makes a filter test pass for the
  # wrong reason.
  defp call(path) do
    :get
    |> conn(path)
    |> Plug.Conn.fetch_query_params()
    |> Router.call(Router.init([]))
  end

  defp body(conn), do: Jason.decode!(conn.resp_body)

  describe "GET /api/statuses" do
    test "returns the on_break vocabulary the extension asks for" do
      # The exact request `main.component.ts` makes.
      conn = call("/api/statuses?type=on_break")

      assert conn.status == 200
      statuses = body(conn)
      assert statuses != []

      # `{uuid, name}` is the contract: the picker binds `[value]="s.uuid"` and
      # renders `{{ s.name }}`, so a row missing either is an option that either
      # cannot be selected or shows blank.
      for status <- statuses do
        assert is_binary(status["uuid"]) and status["uuid"] != ""
        assert is_binary(status["name"]) and status["name"] != ""
        assert status["type"] == "on_break"
      end
    end

    test "is reachable WITHOUT a token" do
      # Not an oversight. It is a vocabulary — no user, no customer, nothing
      # derived from the caller — and requiring a token would route it through
      # the same NATS verification that fails when the token was issued by a
      # different platform, which is the failure this route exists to avoid.
      #
      # Asserted so that giving it auth later is a deliberate act with a failing
      # test attached, rather than a quiet change.
      conn = call("/api/statuses")
      assert conn.status == 200
      assert body(conn) != []
    end

    test "an unknown type returns nothing, not everything" do
      # A picker showing the wrong vocabulary is worse than one showing none,
      # because only the second is obviously broken.
      conn = call("/api/statuses?type=feedback")
      assert conn.status == 200
      assert body(conn) == []
    end
  end
end
