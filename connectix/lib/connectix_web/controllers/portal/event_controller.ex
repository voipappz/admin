defmodule ConnectixWeb.Portal.EventController do
  @moduledoc """
  Browse the events this portal has received off the cable.

  Four routes, mirroring `Connectix.Events`' four reads:

    * `GET /api/events` — newest first; `limit`, `src`
    * `GET /api/events/timeline?sid=…` — one call's frames, oldest first
    * `GET /api/events/search?q=…` — substring over sid/label/headers/raw
    * `GET /api/events/stats` — is it open, and how much is in it

  Served by this app rather than forwarded upstream: these are the frames THIS
  portal saw, which no mothership has. `Plugs.EngineProxy` lets a route the
  router already matches through, the same way `/api/statuses` is handled.

  A closed store answers **503**, never `{"events": []}` — see
  `Connectix.Events`: "nothing is stored here" and "nothing happened" are
  different answers.
  """

  use ConnectixWeb, :controller

  alias Connectix.Events

  # Which store to read. The supervised one, unless a test has stood up its own
  # — the 503 branch is only reachable against a store that failed to open, and
  # the supervised one had better not be that.
  defp store, do: Application.get_env(:connectix, :events_store, Events)

  def index(conn, params) do
    opts =
      [limit: integer_param(params["limit"]), src: present(params["src"])]
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)

    respond(conn, Events.recent(store(), opts))
  end

  def timeline(conn, params) do
    case present(params["sid"]) do
      nil ->
        # 400 rather than "every event ever": a timeline of nothing in
        # particular is a mistake in the caller, not a query.
        conn
        |> put_status(:bad_request)
        |> json(%{error: "sid is required"})

      sid ->
        respond(conn, Events.timeline(store(), sid))
    end
  end

  def search(conn, params) do
    case present(params["q"]) do
      nil ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "q is required"})

      q ->
        opts = [limit: integer_param(params["limit"])] |> Enum.reject(&is_nil(elem(&1, 1)))
        respond(conn, Events.search(store(), q, opts))
    end
  end

  def stats(conn, _params) do
    case Events.stats(store()) do
      %{open?: true} = stats -> json(conn, stats)
      %{open?: false} = stats -> unavailable(conn, stats)
    end
  end

  defp respond(conn, {:ok, rows}), do: json(conn, %{events: rows, count: length(rows)})

  # Not an error the caller can fix: the store is off or unopenable. Say so
  # rather than returning an empty list, which reads as "no events".
  defp respond(conn, {:error, reason}), do: unavailable(conn, %{reason: inspect(reason)})

  defp unavailable(conn, extra) do
    conn
    |> put_status(:service_unavailable)
    |> json(Map.put(extra, :error, "event store unavailable"))
  end

  defp integer_param(value) when is_binary(value) do
    case Integer.parse(value) do
      {n, ""} -> n
      _not_a_number -> nil
    end
  end

  defp integer_param(value) when is_integer(value), do: value
  defp integer_param(_value), do: nil

  defp present(value) when is_binary(value) and value != "", do: value
  defp present(_value), do: nil
end
