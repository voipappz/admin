defmodule AgentsDemoWeb.Api.BotControllerTest do
  use AgentsDemoWeb.ConnCase, async: false

  import AgentsDemo.BotsFixtures

  setup :api_conn

  @instructions %{"behavior" => %{"instructions" => "Answer billing questions."}}

  test "requires a bearer token", %{conn: conn} do
    conn = conn |> delete_req_header("authorization") |> get(~p"/api/bots")
    assert json_response(conn, 401)
  end

  test "lists bots with their versions", %{conn: conn, scope: scope} do
    bot = published_bot_fixture(scope)

    data = conn |> get(~p"/api/bots") |> json_response(200) |> Map.fetch!("data")
    names = Enum.map(data, & &1["slug"])
    assert "default" in names
    assert bot.slug in names

    shown = Enum.find(data, &(&1["id"] == bot.id))
    assert shown["current_version"]["number"] == 1
    assert shown["current_version"]["status"] == "published"
    assert shown["draft_version"] == nil
  end

  test "creates a bot with draft v1", %{conn: conn} do
    body = %{"name" => "Support", "version" => %{"behavior" => %{"instructions" => "Be brief."}}}
    data = conn |> post(~p"/api/bots", body) |> json_response(201) |> Map.fetch!("data")

    assert data["slug"] == "support"
    assert data["status"] == "active"
    assert data["draft_version"]["number"] == 1
    assert data["current_version"] == nil
  end

  test "rejects invalid attributes", %{conn: conn} do
    assert %{"error" => error} = conn |> post(~p"/api/bots", %{}) |> json_response(422)
    assert error =~ "name"
  end

  test "publish makes the draft current and refuses an invalid one", %{conn: conn, scope: scope} do
    bot = bot_fixture(scope, version: %{"behavior" => %{"instructions" => ""}})

    assert %{"errors" => [%{"code" => "no_instructions", "path" => "behavior.instructions"}]} =
             conn |> post(~p"/api/bots/#{bot.id}/publish") |> json_response(422)

    assert %{"data" => %{"report" => %{"valid" => false}, "compiled" => compiled}} =
             conn |> post(~p"/api/bots/#{bot.id}/preflight") |> json_response(200)

    assert compiled["prompt"] == ""
    assert compiled["skills"] == []
    refute Map.has_key?(compiled, "module")

    conn |> patch(~p"/api/bots/#{bot.id}", %{"version" => @instructions}) |> json_response(200)

    data =
      conn |> post(~p"/api/bots/#{bot.id}/publish") |> json_response(200) |> Map.fetch!("data")

    assert data["current_version"]["number"] == 1
    assert data["current_version"]["fingerprint"] =~ "sha256:"
    assert data["draft_version"] == nil

    assert %{"error" => "the bot has no draft"} =
             conn |> post(~p"/api/bots/#{bot.id}/publish") |> json_response(422)
  end

  test "patch edits identity and the draft, never the published version", %{
    conn: conn,
    scope: scope
  } do
    bot = published_bot_fixture(scope)

    data =
      conn
      |> patch(~p"/api/bots/#{bot.id}", %{"name" => "Renamed", "version" => @instructions})
      |> json_response(200)
      |> Map.fetch!("data")

    assert data["name"] == "Renamed"
    assert data["draft_version"]["number"] == 2
    assert data["current_version"]["number"] == 1

    version =
      conn |> get(~p"/api/bots/#{bot.id}/versions/1") |> json_response(200) |> Map.fetch!("data")

    assert version["behavior"]["instructions"] == "You are a test bot. Be brief."
  end

  test "versions can be listed, shown, drafted and retired", %{conn: conn, scope: scope} do
    bot = published_bot_fixture(scope)

    assert %{"data" => %{"number" => 2, "status" => "draft"}} =
             conn |> post(~p"/api/bots/#{bot.id}/draft") |> json_response(201)

    assert %{"error" => "the bot already has a draft"} =
             conn |> post(~p"/api/bots/#{bot.id}/draft") |> json_response(422)

    conn |> post(~p"/api/bots/#{bot.id}/publish") |> json_response(200)

    versions =
      conn |> get(~p"/api/bots/#{bot.id}/versions") |> json_response(200) |> Map.fetch!("data")

    assert Enum.map(versions, & &1["number"]) == [2, 1]
    assert Enum.all?(versions, &is_list(&1["skills"]))

    assert %{"data" => %{"status" => "retired"}} =
             conn |> post(~p"/api/bots/#{bot.id}/versions/1/retire") |> json_response(200)

    assert %{"error" => _message} =
             conn |> post(~p"/api/bots/#{bot.id}/versions/2/retire") |> json_response(422)

    assert json_response(get(conn, ~p"/api/bots/#{bot.id}/versions/9"), 404)
  end

  test "delete only without history; archive otherwise", %{conn: conn, scope: scope} do
    draft_only = bot_fixture(scope)
    assert conn |> delete(~p"/api/bots/#{draft_only.id}") |> response(204)

    published = published_bot_fixture(scope)
    assert json_response(delete(conn, ~p"/api/bots/#{published.id}"), 409)

    assert %{"data" => %{"status" => "archived"}} =
             conn |> post(~p"/api/bots/#{published.id}/archive") |> json_response(200)

    assert %{"data" => %{"status" => "active"}} =
             conn |> post(~p"/api/bots/#{published.id}/unarchive") |> json_response(200)
  end

  test "another owner's bot is 404", %{conn: conn} do
    other = AgentsDemo.AccountsFixtures.user_scope_fixture()
    bot = published_bot_fixture(other)
    assert json_response(get(conn, ~p"/api/bots/#{bot.id}"), 404)
    assert json_response(post(conn, ~p"/api/bots/#{bot.id}/publish"), 404)
  end
end
