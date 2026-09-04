defmodule ConnectixWeb.Portal.EventControllerTest do
  @moduledoc """
  The four `/api/events` routes, driven through the Endpoint.

  `Phoenix.ConnTest` against `@endpoint` rather than `ConnCase`: these routes
  read no database, and `ConnCase`'s Mnesia reset would put them behind stores
  they never touch. The same reasoning as `status_controller_test.exs` beside
  this file.

  Each test points the controller at a store of its own —
  `config :connectix, :events_store` — so nothing here depends on whatever
  the supervised instance has received, and so the 503 branch is reachable at
  all: it only happens for a store that failed to open, which the supervised
  one had better never be. `async: false` because that setting is global.

  Writes are casts, so every test calls `Connectix.Events.stats/1` — a call
  behind the same mailbox — before making a request. See `Connectix.EventsTest`.
  """

  use ExUnit.Case, async: false
  use Mimic

  import Phoenix.ConnTest

  alias Connectix.Events
  alias Connectix.Realtime.TokenAuth

  @endpoint ConnectixWeb.Endpoint

  setup do
    path =
      Path.join(System.tmp_dir!(), "events-http-#{System.unique_integer([:positive])}.duckdb")

    name = :"events_http_#{System.unique_integer([:positive])}"
    store = start_supervised!({Events, name: name, path: path})

    Application.put_env(:connectix, :events_store, store)

    claims = %TokenAuth{
      user_uuid: "11111111-1111-1111-1111-111111111111",
      account_uuid: "22222222-2222-2222-2222-222222222222",
      token: "events-verified-token"
    }

    stub(TokenAuth, :verify, fn
      "events-verified-token" -> {:ok, claims}
      _other -> {:error, :unauthenticated}
    end)

    on_exit(fn ->
      Application.delete_env(:connectix, :events_store)
      File.rm(path)
    end)

    conn =
      build_conn() |> Plug.Conn.put_req_header("authorization", "Bearer events-verified-token")

    %{conn: conn, store: store}
  end

  defp seed(store, events) do
    Enum.each(events, &Events.insert(store, &1))
    Events.stats(store)
  end

  defp event(fields) do
    Map.merge(
      %{
        "src" => "CallEvents",
        "sid" => "call-1",
        "label" => "x",
        "headers" => %{},
        "raw" => "{}"
      },
      fields
    )
  end

  describe "authentication" do
    test "a missing or rejected token cannot read audit events", %{conn: conn} do
      missing = Plug.Conn.delete_req_header(conn, "authorization")
      assert missing |> get("/api/events") |> json_response(401) == %{"error" => "unauthorized"}

      rejected = Plug.Conn.put_req_header(conn, "authorization", "Bearer rejected")
      assert rejected |> get("/api/events") |> json_response(401) == %{"error" => "unauthorized"}
    end
  end

  describe "GET /api/events" do
    test "returns the stored events newest first", %{conn: conn, store: store} do
      seed(store, [
        event(%{"label" => "old", "create_date" => 1, "raw" => "1"}),
        event(%{"label" => "new", "create_date" => 2, "raw" => "2"})
      ])

      body = conn |> get("/api/events") |> json_response(200)

      assert Enum.map(body["events"], & &1["label"]) == ~w(new old)
      assert body["count"] == 2
    end

    test "limit and src are applied", %{conn: conn, store: store} do
      seed(store, [
        event(%{"src" => "StateChannel", "create_date" => 1, "raw" => "1"}),
        event(%{"src" => "CallEvents", "create_date" => 2, "raw" => "2"}),
        event(%{"src" => "CallEvents", "create_date" => 3, "raw" => "3"})
      ])

      assert %{"count" => 1} =
               conn |> get("/api/events", src: "StateChannel") |> json_response(200)

      assert %{"count" => 1} = conn |> get("/api/events", limit: "1") |> json_response(200)
    end
  end

  describe "GET /api/events/timeline" do
    test "returns one sid's events oldest first", %{conn: conn, store: store} do
      seed(store, [
        event(%{"sid" => "call-A", "label" => "b", "create_date" => 2, "raw" => "2"}),
        event(%{"sid" => "call-A", "label" => "a", "create_date" => 1, "raw" => "1"}),
        event(%{"sid" => "call-B", "label" => "z", "create_date" => 3, "raw" => "3"})
      ])

      body = conn |> get("/api/events/timeline", sid: "call-A") |> json_response(200)

      assert Enum.map(body["events"], & &1["label"]) == ~w(a b)
    end

    test "400 without a sid", %{conn: conn} do
      assert %{"error" => "sid is required"} =
               conn |> get("/api/events/timeline") |> json_response(400)
    end
  end

  describe "GET /api/events/search" do
    test "matches a raw substring", %{conn: conn, store: store} do
      seed(store, [
        event(%{"raw" => ~s({"caller_id_number":"0501234567"})}),
        event(%{"raw" => ~s({"caller_id_number":"0509999999"})})
      ])

      body = conn |> get("/api/events/search", q: "0501234") |> json_response(200)

      assert body["count"] == 1
    end

    test "400 without q", %{conn: conn} do
      assert %{"error" => "q is required"} =
               conn |> get("/api/events/search") |> json_response(400)
    end
  end

  describe "GET /api/events/stats" do
    test "reports the open store and its count", %{conn: conn, store: store} do
      seed(store, [event(%{"raw" => "a"})])

      body = conn |> get("/api/events/stats") |> json_response(200)

      assert body["open?"] == true
      assert body["count"] == 1
    end
  end

  describe "a store that could not open" do
    setup do
      name = :"events_http_closed_#{System.unique_integer([:positive])}"
      store = start_supervised!({Events, name: name, path: "/proc/nope/events.duckdb"})
      Application.put_env(:connectix, :events_store, store)
      :ok
    end

    test "every route answers 503, not an empty list", %{conn: conn} do
      for path <- ["/api/events", "/api/events/timeline?sid=x", "/api/events/search?q=x"] do
        assert %{"error" => "event store unavailable"} =
                 conn |> get(path) |> json_response(503)
      end

      assert %{"error" => "event store unavailable", "open?" => false} =
               conn |> get("/api/events/stats") |> json_response(503)
    end
  end
end
