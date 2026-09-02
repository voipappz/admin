defmodule AgentsDemoWeb.Portal.WidgetController do
  @moduledoc """
  `/dashboard/widgets` — widget definitions on a board.

  The board is a query parameter (`?dashboard_uuid=`), not a path segment,
  because that is what the shipped client sends on every call including
  `PATCH`. It defaults to `default`, the seeded board.
  """

  use AgentsDemoWeb, :controller

  alias AgentsDemo.Dashboards

  action_fallback AgentsDemoWeb.Portal.FallbackController

  def index(conn, params) do
    widgets =
      params
      |> board()
      |> Dashboards.list_widgets()
      |> Enum.map(&Dashboards.Widget.to_wire/1)

    json(conn, %{widgets: widgets})
  end

  def create(conn, params) do
    with {:ok, widget} <- Dashboards.create_widget(body(params), board(params)) do
      conn |> put_status(:created) |> json(Dashboards.Widget.to_wire(widget))
    end
  end

  def update(conn, %{"uuid" => uuid} = params) do
    with widget when not is_nil(widget) <- Dashboards.get_widget(uuid),
         {:ok, updated} <- Dashboards.update_widget(widget, body(params)) do
      json(conn, Dashboards.Widget.to_wire(updated))
    else
      nil -> {:error, :not_found}
      other -> other
    end
  end

  def delete(conn, %{"uuid" => uuid}) do
    case Dashboards.delete_widget(uuid) do
      {:ok, _} -> json(conn, %{deleted: true})
      {:error, :not_found} -> {:error, :not_found}
    end
  end

  defp board(params) do
    case params |> Map.get("dashboard_uuid") |> to_string() |> String.trim() do
      "" -> "default"
      uuid -> uuid
    end
  end

  # Phoenix merges path and query params into the body params, so `uuid` and
  # `dashboard_uuid` arrive here even when the client did not put them in the
  # JSON. Dropping them keeps a path segment from being stored as a widget
  # field, which would then reappear in `to_wire/1` and shadow the column.
  defp body(params), do: Map.drop(params, ["uuid", "dashboard_uuid"])
end
