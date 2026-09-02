defmodule AgentsDemoWeb.Portal.DashboardController do
  @moduledoc """
  `/dashboard/dashboards` — the builder's board collection.

  Status codes are the ones the shipped client already branches on: `201` on
  create and `200` on rename (`dashboardsApi.js` treats any non-2xx as a throw),
  `409` for the permanent default board, `404` for an unknown uuid.
  """

  use AgentsDemoWeb, :controller

  alias AgentsDemo.Dashboards

  action_fallback AgentsDemoWeb.Portal.FallbackController

  def index(conn, _params) do
    json(conn, %{dashboards: Dashboards.list_dashboards()})
  end

  def create(conn, params) do
    with {:ok, name} <- name(params),
         {:ok, dashboard} <- Dashboards.create_dashboard(name) do
      conn |> put_status(:created) |> json(dashboard)
    end
  end

  def update(conn, %{"uuid" => uuid} = params) do
    with {:ok, name} <- name(params),
         dashboard when not is_nil(dashboard) <- Dashboards.get_dashboard(uuid),
         {:ok, updated} <- Dashboards.rename_dashboard(dashboard, name) do
      json(conn, updated)
    else
      nil -> {:error, :not_found}
      other -> other
    end
  end

  def delete(conn, %{"uuid" => uuid}) do
    case Dashboards.delete_dashboard(uuid) do
      {:ok, _} -> json(conn, %{deleted: true})
      {:error, :permanent} -> {:error, :permanent}
      {:error, :not_found} -> {:error, :not_found}
    end
  end

  defp name(params) do
    case params |> Map.get("name") |> to_string() |> String.trim() do
      "" -> {:error, :name_required}
      name -> {:ok, name}
    end
  end
end
