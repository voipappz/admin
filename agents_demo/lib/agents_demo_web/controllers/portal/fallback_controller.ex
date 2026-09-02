defmodule AgentsDemoWeb.Portal.FallbackController do
  @moduledoc """
  Turns the portal controllers' error tuples into the JSON bodies the shipped
  builder already understands.
  """

  use AgentsDemoWeb, :controller

  def call(conn, {:error, :name_required}),
    do: send_error(conn, :bad_request, "dashboard name is required")

  def call(conn, {:error, :not_found}), do: send_error(conn, :not_found, "not found")

  def call(conn, {:error, :permanent}),
    do: send_error(conn, :conflict, "default dashboard cannot be deleted")

  # A validator's `%{field => [message]}` report.
  def call(conn, {:error, %{} = errors}) when is_non_struct_map(errors) do
    send_error(conn, :unprocessable_entity, translate(errors))
  end

  defp translate(errors) do
    Enum.map_join(errors, "; ", fn {field, msgs} -> "#{field} #{Enum.join(List.wrap(msgs), ", ")}" end)
  end

  defp send_error(conn, status, message) do
    conn |> put_status(status) |> json(%{error: message})
  end
end
