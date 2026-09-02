defmodule AgentsDemoWeb.Api.SkillControllerTest do
  use AgentsDemoWeb.ConnCase, async: false

  setup :api_conn

  test "lists the catalog", %{conn: conn} do
    data = conn |> get(~p"/api/skills") |> json_response(200) |> Map.fetch!("data")

    assert Enum.map(data, & &1["id"]) == [
             "customer_lookup",
             "human_handoff",
             "memory_files",
             "todo",
             "web_lookup"
           ]
  end

  test "requires a token", %{conn: conn} do
    assert json_response(conn |> delete_req_header("authorization") |> get(~p"/api/skills"), 401)
  end
end
