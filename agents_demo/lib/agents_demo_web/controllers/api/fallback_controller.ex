defmodule AgentsDemoWeb.Api.FallbackController do
  @moduledoc """
  Turns the error tuples the API controllers return into JSON responses.

  Scoped lookups return `{:error, :not_found}` for a conversation that exists
  but belongs to someone else, which is deliberate: 404 rather than 403, so the
  API never confirms the existence of another tenant's data.
  """

  use AgentsDemoWeb, :controller

  def call(conn, {:error, :not_found}), do: send_error(conn, :not_found, "not found")

  def call(conn, {:error, :empty_message}),
    do: send_error(conn, :unprocessable_entity, "text must not be empty")

  # A draft that is not fit to publish: the whole report, so the client can
  # fix every problem in one round rather than one per request.
  def call(conn, {:error, %AgentsDemo.Bots.Validator.Report{} = report}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{
      error: "the draft is not valid to publish",
      errors: report.errors,
      warnings: report.warnings
    })
  end

  def call(conn, {:error, :has_history}),
    do:
      send_error(
        conn,
        :conflict,
        "the bot has published versions or conversations; archive it instead"
      )

  @lifecycle_errors %{
    bot_archived: "the bot is archived and takes no new conversations",
    no_published_version: "the bot has no published version yet",
    version_not_published: "that version is not published",
    version_is_current: "that version is current; publish another first",
    no_draft: "the bot has no draft",
    draft_exists: "the bot already has a draft"
  }

  def call(conn, {:error, reason}) when is_map_key(@lifecycle_errors, reason),
    do: send_error(conn, :unprocessable_entity, Map.fetch!(@lifecycle_errors, reason))

  # A validator's `%{field => [message]}` report.
  def call(conn, {:error, %{} = errors}) when is_non_struct_map(errors) do
    send_error(conn, :unprocessable_entity, errors_message(errors))
  end

  def call(conn, {:error, reason}) do
    send_error(conn, :internal_server_error, inspect(reason))
  end

  defp send_error(conn, status, message) do
    conn
    |> put_status(status)
    |> json(%{error: message})
  end

  defp errors_message(errors) do
    Enum.map_join(errors, "; ", fn {field, msgs} -> "#{field} #{Enum.join(List.wrap(msgs), ", ")}" end)
  end
end
