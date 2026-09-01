defmodule AgentsDemoWeb.Api.ConversationControllerTest do
  use AgentsDemoWeb.ConnCase, async: false

  import AgentsDemo.BotsFixtures

  setup :api_conn

  test "a new conversation pins the default bot", %{conn: conn, scope: scope} do
    {:ok, default} = AgentsDemo.Bots.get_bot_by_slug(scope, "default")

    data = conn |> post(~p"/api/conversations", %{}) |> json_response(201) |> Map.fetch!("data")
    assert data["source"] == "api"
    assert data["bot_id"] == default.id
    assert data["bot_version_id"] == default.current_version_id
    assert data["handler"] == "bot"
  end

  test "bot_id and bot_version_id pin explicitly", %{conn: conn, scope: scope} do
    bot = published_bot_fixture(scope)

    data =
      conn
      |> post(~p"/api/conversations", %{"bot_id" => bot.id, "title" => "T"})
      |> json_response(201)
      |> Map.fetch!("data")

    assert data["bot_version_id"] == bot.current_version_id
    assert data["title"] == "T"

    data =
      conn
      |> post(~p"/api/conversations", %{"bot_version_id" => bot.current_version_id})
      |> json_response(201)
      |> Map.fetch!("data")

    assert data["bot_id"] == bot.id
  end

  test "an unpublished or foreign version is refused", %{conn: conn, scope: scope} do
    bot = bot_fixture(scope)

    assert %{"error" => "the bot has no published version yet"} =
             conn |> post(~p"/api/conversations", %{"bot_id" => bot.id}) |> json_response(422)

    other = published_bot_fixture(AgentsDemo.AccountsFixtures.user_scope_fixture())
    assert json_response(post(conn, ~p"/api/conversations", %{"bot_id" => other.id}), 404)
  end
end
