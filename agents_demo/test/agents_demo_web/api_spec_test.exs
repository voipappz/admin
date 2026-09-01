defmodule AgentsDemoWeb.ApiSpecTest do
  use ExUnit.Case, async: true

  test "the OpenAPI spec builds and covers every bot and conversation route" do
    spec = AgentsDemoWeb.ApiSpec.spec()

    paths = Map.keys(spec.paths)

    for path <- [
          "/api/bots",
          "/api/bots/{id}",
          "/api/bots/{id}/publish",
          "/api/bots/{id}/preflight",
          "/api/bots/{id}/draft",
          "/api/bots/{id}/archive",
          "/api/bots/{id}/versions",
          "/api/bots/{id}/versions/{number}",
          "/api/conversations",
          "/api/conversations/{id}/messages"
        ] do
      assert path in paths, "missing #{path}"
    end

    assert Map.has_key?(spec.components.schemas, "BotVersion")
    assert {:ok, _json} = Jason.encode(spec)
  end
end
