defmodule AgentsDemoWeb.Api.SkillController do
  @moduledoc """
  The Skill catalog, read-only: what a bot version may select, with each
  Skill's capabilities and policy badges. The catalog is code
  (`AgentsDemo.Skills`), so this is the same list for every caller.
  """

  use AgentsDemoWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias AgentsDemoWeb.Api.Schemas

  tags(["skills"])

  operation(:index,
    summary: "List the Skill catalog",
    responses: [
      ok: {"The catalog", "application/json", Schemas.SkillsResponse},
      unauthorized: {"Missing or invalid bearer token", "application/json", Schemas.Error}
    ]
  )

  def index(conn, _params) do
    json(conn, %{data: AgentsDemo.Skills.catalog()})
  end
end
