defmodule AgentsDemoWeb.Portal.DashboardTest do
  @moduledoc """
  The dashboard builder's storage, ported here from the retired Deno BFF.

  The contract under test is the shipped client's (`src/services/dashboardsApi.js`),
  not a new one: these paths, these status codes and these body shapes are what
  the browser already sends and parses.
  """

  use AgentsDemoWeb.ConnCase, async: false
  use Mimic

  alias AgentsDemo.Dashboards
  alias AgentsDemo.Realtime.TokenAuth

  setup %{conn: conn} do
    claims = %TokenAuth{
      user_uuid: "11111111-1111-1111-1111-111111111111",
      account_uuid: "22222222-2222-2222-2222-222222222222",
      token: "a-verified-token"
    }

    stub(TokenAuth, :verify, fn
      "a-verified-token" -> {:ok, claims}
      _other -> {:error, :unauthenticated}
    end)

    {:ok, conn: put_req_header(conn, "authorization", "Bearer a-verified-token")}
  end

  describe "authentication" do
    test "a request with no token is refused", %{conn: conn} do
      conn = conn |> delete_req_header("authorization") |> get(~p"/dashboard/dashboards")
      assert json_response(conn, 401) == %{"error" => "unauthorized"}
    end

    test "a token the issuer rejects is refused", %{conn: conn} do
      conn =
        conn
        |> put_req_header("authorization", "Bearer stolen")
        |> get(~p"/dashboard/dashboards")

      assert json_response(conn, 401) == %{"error" => "unauthorized"}
    end
  end

  describe "dashboards" do
    test "the seeded default board is there before anything is created", %{conn: conn} do
      %{"dashboards" => boards} = conn |> get(~p"/dashboard/dashboards") |> json_response(200)
      assert Enum.find(boards, &(&1["uuid"] == "default"))
    end

    test "create answers 201 with the new board", %{conn: conn} do
      board = conn |> post(~p"/dashboard/dashboards", %{name: "Ops"}) |> json_response(201)

      assert board["name"] == "Ops"
      assert board["uuid"] != "default"
    end

    test "a blank name is refused rather than stored", %{conn: conn} do
      assert %{"error" => _} =
               conn |> post(~p"/dashboard/dashboards", %{name: "   "}) |> json_response(400)
    end

    test "rename keeps the uuid", %{conn: conn} do
      %{"uuid" => uuid} =
        conn |> post(~p"/dashboard/dashboards", %{name: "Before"}) |> json_response(201)

      renamed =
        conn |> patch(~p"/dashboard/dashboards/#{uuid}", %{name: "After"}) |> json_response(200)

      assert renamed["uuid"] == uuid
      assert renamed["name"] == "After"
    end

    test "deleting a board takes its widgets with it", %{conn: conn} do
      %{"uuid" => uuid} =
        conn |> post(~p"/dashboard/dashboards", %{name: "Doomed"}) |> json_response(201)

      conn
      |> post(~p"/dashboard/widgets?dashboard_uuid=#{uuid}", %{title: "orphan"})
      |> json_response(201)

      assert %{"deleted" => true} =
               conn |> delete(~p"/dashboard/dashboards/#{uuid}") |> json_response(200)

      # Not merely unreachable — gone. A widget left pointing at a deleted board
      # is a row nothing can list and nothing will ever clean up.
      assert Dashboards.list_widgets(uuid) == []
    end

    test "the default board cannot be deleted", %{conn: conn} do
      assert %{"error" => _} =
               conn |> delete(~p"/dashboard/dashboards/default") |> json_response(409)

      assert Dashboards.get_dashboard("default")
    end

    test "an unknown board is 404, not 500", %{conn: conn} do
      assert conn |> delete(~p"/dashboard/dashboards/nope") |> json_response(404)
      assert conn |> patch(~p"/dashboard/dashboards/nope", %{name: "x"}) |> json_response(404)
    end
  end

  describe "widgets" do
    test "an empty body saves the builder's default widget", %{conn: conn} do
      widget = conn |> post(~p"/dashboard/widgets", %{}) |> json_response(201)

      assert widget["type"] == "counter"
      assert widget["metric"] == "total"
      assert widget["dashboard_uuid"] == "default"
      assert widget["uuid"]
    end

    test "widgets are scoped to their board", %{conn: conn} do
      %{"uuid" => other} =
        conn |> post(~p"/dashboard/dashboards", %{name: "Other"}) |> json_response(201)

      conn |> post(~p"/dashboard/widgets", %{title: "on default"}) |> json_response(201)

      conn
      |> post(~p"/dashboard/widgets?dashboard_uuid=#{other}", %{title: "on other"})
      |> json_response(201)

      %{"widgets" => on_other} =
        conn |> get(~p"/dashboard/widgets?dashboard_uuid=#{other}") |> json_response(200)

      assert Enum.map(on_other, & &1["title"]) == ["on other"]
    end

    test "patch merges, so an untouched field survives", %{conn: conn} do
      %{"uuid" => uuid} =
        conn
        |> post(~p"/dashboard/widgets", %{title: "Calls", metric: "answered"})
        |> json_response(201)

      patched =
        conn |> patch(~p"/dashboard/widgets/#{uuid}", %{title: "Answered"}) |> json_response(200)

      # The client sends only what changed. Replacing the definition instead of
      # merging would silently blank every other field on the widget.
      assert patched["title"] == "Answered"
      assert patched["metric"] == "answered"
    end

    test "the path uuid is never stored as a widget field", %{conn: conn} do
      %{"uuid" => uuid} = conn |> post(~p"/dashboard/widgets", %{}) |> json_response(201)

      conn |> patch(~p"/dashboard/widgets/#{uuid}", %{title: "t"}) |> json_response(200)

      # Phoenix merges path params into the body. A `uuid` copied into the
      # definition would reappear on read and could shadow the column.
      %{definition: definition} = Dashboards.get_widget(uuid)
      refute Map.has_key?(definition, "uuid")
      refute Map.has_key?(definition, "dashboard_uuid")
    end

    test "delete removes it, and deleting twice is 404", %{conn: conn} do
      %{"uuid" => uuid} = conn |> post(~p"/dashboard/widgets", %{}) |> json_response(201)

      assert %{"deleted" => true} =
               conn |> delete(~p"/dashboard/widgets/#{uuid}") |> json_response(200)

      assert conn |> delete(~p"/dashboard/widgets/#{uuid}") |> json_response(404)
    end
  end
end
