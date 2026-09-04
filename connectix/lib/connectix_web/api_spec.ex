defmodule ConnectixWeb.ApiSpec do
  @moduledoc """
  The OpenAPI 3 description of the public API.

  Served as JSON at `/api/openapi` and rendered as Swagger UI at `/api/docs`.
  The spec is derived from the router and the controllers' `operation/1`
  declarations, so it cannot drift from the routes that actually exist — which
  is the whole reason for generating it rather than writing YAML by hand.
  """

  alias OpenApiSpex.Components
  alias OpenApiSpex.Info
  alias OpenApiSpex.OpenApi
  alias OpenApiSpex.Paths
  alias OpenApiSpex.SecurityScheme
  alias OpenApiSpex.Server

  @behaviour OpenApi

  @impl OpenApi
  def spec do
    %OpenApi{
      servers: [Server.from_endpoint(ConnectixWeb.Endpoint)],
      info: %Info{
        title: "Agents Demo API",
        version: "1.0.0",
        description: """
        Talk to the agent over HTTP.

        A conversation holds the history; posting a message to one starts an
        agent turn. **Turns are asynchronous** — the agent thinks, may call
        tools, and can take many seconds, so `POST /messages` returns as soon
        as the message is accepted rather than waiting for a reply. Poll
        `GET /messages` for the answer.

        Authenticate with `Authorization: Bearer <AGENTS_DEMO_API_KEY>`.
        """
      },
      paths: Paths.from_router(ConnectixWeb.Router),
      components: %Components{
        securitySchemes: %{
          "bearer" => %SecurityScheme{
            type: "http",
            scheme: "bearer",
            description: "The value of AGENTS_DEMO_API_KEY."
          }
        }
      },
      security: [%{"bearer" => []}]
    }
    |> OpenApiSpex.resolve_schema_modules()
  end
end
