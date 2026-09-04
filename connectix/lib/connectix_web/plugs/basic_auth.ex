defmodule ConnectixWeb.Plugs.BasicAuth do
  @moduledoc """
  HTTP Basic Auth gate for the `:browser` pipeline (the LiveView UI and the
  `/dev` tools it shares a pipeline with) — the login flow this replaced.

  Credentials come from `Connectix.Config.basic_auth/0` (`PORTAL_UI_USER` /
  `PORTAL_UI_PASS`), read at request time. Unconfigured, this is a
  pass-through — local dev/test stays frictionless — and
  `Connectix.Application` logs a warning at boot in that case, so an
  unprotected deployment is never silent.

  Modeled on connectix.io/phone's now-retired endpoint-wide `BasicAuth`, but
  narrower: it sits on `:browser` only, not the whole endpoint, since
  `/health`, `/api/*` and `/ws/events` authenticate their own way and must
  stay reachable without a browser credential.

  `ConnectixWeb.UserAuth.resolve_scope/0` derives `current_scope` from the
  same configured username — there is no separate login, the Basic Auth
  identity IS the account.
  """

  @behaviour Plug

  import Plug.BasicAuth, only: [basic_auth: 2]

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    case Connectix.Config.basic_auth() do
      {user, pass} -> basic_auth(conn, username: user, password: pass)
      nil -> conn
    end
  end
end
