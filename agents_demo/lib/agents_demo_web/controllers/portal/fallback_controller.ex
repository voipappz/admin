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

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    send_error(conn, :unprocessable_entity, translate(changeset))
  end

  defp translate(changeset) do
    changeset
    |> Ecto.Changeset.traverse_errors(fn {msg, _opts} -> msg end)
    |> Enum.map_join("; ", fn {field, msgs} -> "#{field} #{Enum.join(msgs, ", ")}" end)
  end

  defp send_error(conn, status, message) do
    conn |> put_status(status) |> json(%{error: message})
  end
end
