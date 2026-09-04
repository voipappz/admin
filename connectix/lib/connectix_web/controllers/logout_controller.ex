defmodule ConnectixWeb.LogoutController do
  @moduledoc """
  HTTP Basic Auth has no server-side session to end — the browser caches the
  credential per-origin and resends it on every request. The standard
  workaround: answer with a **fresh** `WWW-Authenticate` challenge (a new
  `realm`, so it doesn't just re-match the cached credential) and a `401`, so
  the browser drops the cached credential and re-prompts on the next request.

  Not airtight — Safari and some browsers only fully forget it once the tab
  closes — but it's the standard for a Basic-Auth-only app with no session.
  """

  use ConnectixWeb, :controller

  def logout(conn, _params) do
    conn
    |> put_resp_header(
      "www-authenticate",
      ~s(Basic realm="connectix-logout-#{System.unique_integer([:positive])}")
    )
    |> put_resp_content_type("text/html")
    |> send_resp(401, """
    <!doctype html>
    <html><body style="font-family: system-ui; padding: 3rem; text-align: center;">
      <h1>Logged out</h1>
      <p>Close this tab, or re-enter your credentials to continue.</p>
    </body></html>
    """)
  end
end
