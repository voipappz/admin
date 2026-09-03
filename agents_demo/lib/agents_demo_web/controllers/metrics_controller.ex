defmodule AgentsDemoWeb.MetricsController do
  @moduledoc """
  Prometheus scrape endpoint for portal runtime metrics.
  """

  use Phoenix.Controller, formats: [:json]

  import Plug.Conn

  def index(conn, _params) do
    conn
    |> put_resp_content_type("text/plain")
    |> send_resp(200, TelemetryMetricsPrometheus.Core.scrape(:agents_demo_metrics))
  end
end
