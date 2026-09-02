defmodule AgentsDemoWeb.Plugs.UserTokenAuth do
  @moduledoc """
  Bearer auth for the portal's own user-facing routes, verified the same way
  the realtime socket verifies its handshake: a NATS request/reply to the API
  (`AgentsDemo.Realtime.TokenAuth`).

  One verifier, not two. The alternative is this app deciding for itself
  whether a mothership token is good, which is how a portal ends up honouring a
  credential the issuer has already revoked.

  `Plugs.ApiAuth` is a different thing and stays: that is the machine-to-machine
  key for the bots API, checked against a configured secret. This is a *person's*
  login token.

  On success `conn.assigns.claims` carries the verified `%TokenAuth{}`.
  """

  import Plug.Conn

  alias AgentsDemo.Realtime.TokenAuth

  def init(opts), do: opts

  def call(conn, _opts) do
    case TokenAuth.verify(bearer(conn)) do
      {:ok, claims} -> assign(conn, :claims, claims)
      {:error, _reason} -> refuse(conn)
    end
  end

  defp bearer(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> String.trim(token)
      _missing -> nil
    end
  end

  # One message for every failure. Telling an unauthenticated caller apart —
  # "no bus configured" from "expired" from "no identity claim" — describes the
  # deployment to someone who has not authenticated to it.
  defp refuse(conn) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(401, ~s({"error":"unauthorized"}))
    |> halt()
  end
end
