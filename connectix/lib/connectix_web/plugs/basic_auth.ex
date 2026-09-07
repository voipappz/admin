defmodule ConnectixWeb.Plugs.BasicAuth do
  @moduledoc """
  HTTP Basic Auth gate for the `:browser` pipeline (the LiveView UI and the
  `/dev` tools it shares a pipeline with) — the login flow this replaced.

  Credentials come from `Connectix.Config.basic_auth/0` (`PORTAL_UI_USER` /
  `PORTAL_UI_PASS`), read at request time.

  ## Unconfigured means OPEN in development and CLOSED in production

  This used to be a pass-through whenever the variables were unset, with a
  warning logged at boot. That is the wrong default for the one thing standing
  between the internet and the agent: everything behind this pipeline —
  `/chat`, the voice client, `/voice/ws` — becomes anonymous, and the agent
  behind it runs tool calls, fetches URLs from inside the host, and spends the
  deployment's STT/TTS/LLM credit. A warning in a boot log that nobody reads
  is not a control.

  So the behaviour now depends on where it is running, and the split is
  deliberate:

    * **`:prod`** — unconfigured refuses every request with 401 and a body
      naming the two variables. A deployment that forgets them is *visibly*
      broken, which is recoverable in a minute; one that is silently open is
      not recoverable at all.
    * **dev and test** — unconfigured is still a pass-through, because
      requiring a credential to run the suite or open `localhost:4000` buys
      nothing and would be worked around immediately.

  Compile-time, via `Connectix.Config.prod?/0`: `Mix` does not exist in a
  release, so this cannot be a runtime question.

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
  import Plug.Conn

  require Logger

  @unconfigured """
  This portal is not configured.

  PORTAL_UI_USER and PORTAL_UI_PASS are unset, so there is no credential to
  check. Refusing rather than serving the agent UI to anyone who asks.
  """

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    case Connectix.Config.basic_auth() do
      {user, pass} ->
        basic_auth(conn, username: user, password: pass)

      nil ->
        if Connectix.Config.prod?() do
          Logger.error(
            "refused a request to #{conn.request_path}: PORTAL_UI_USER/PORTAL_UI_PASS are unset"
          )

          conn
          |> put_resp_content_type("text/plain")
          |> send_resp(401, @unconfigured)
          |> halt()
        else
          conn
        end
    end
  end
end
