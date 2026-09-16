defmodule ConnectixWeb.Portal.AuthController do
  @moduledoc """
  The login, performed HERE.

  It used to be forwarded: the extension posted `/auth/user_login`, the portal
  relayed it upstream, and whichever mothership answered decided who this
  person was. That put the one thing every session depends on outside the app,
  behind a host that has to be reachable, correct and agreeing with the secret
  this portal verifies tokens against. When it was not — an upstream answering
  500, or signing with a different key — the failure arrived as a login that
  simply did not work, with nothing local to inspect.

  So the portal owns it. It checks the credential against the agents named in
  `priv/pocketflow/screen_pop.yaml`, mints a token with the same secret
  `Realtime.Jwt.verify/1` checks, and answers in the shape the extension
  already parses. Nothing else in the chain changes.

  ## The identity in the token IS the agent id

  `user_uuid` is the agent's `powerlink` uuid, not a second identifier mapped
  to it later. That is deliberate: the switch names an agent by that value and
  publishes their state to `state.user.<powerlink>`, so issuing it directly
  removes the lookup, the mapping step and the failure mode where the two are
  resolved apart and every frame is dropped as unattributable.

  ## What this is not

  Not a user database. There are no sessions, no password reset, no lockout,
  and the credential lives in a file an operator edits. It is the smallest
  thing that lets this deployment sign in without depending on a mothership,
  and `Connectix.Accounts` remains the real account store for the LiveView UI.
  """

  use ConnectixWeb, :controller

  require Logger

  alias Connectix.Realtime.Jwt
  alias Connectix.Realtime.PopRule

  @doc """
  `POST /auth/user_login` — email and password in, a token and a user out.

  Answers 401 for both "no such agent" and "wrong password", with the same
  body, because telling them apart tells a guesser which half to keep.
  """
  def user_login(conn, params) do
    email = param(params, ["email", "username", "user"])
    password = param(params, ["password", "pass"])

    case authenticate(email, password) do
      {:ok, entry} ->
        issue(conn, email, entry)

      {:error, reason} ->
        # Logged, because an operator staring at a refused login needs to know
        # whether the agent is missing from the file or the password is wrong.
        # The CLIENT is told neither.
        Logger.info("login: refused #{inspect(email)} (#{reason})")

        conn
        |> put_status(401)
        |> json(%{id: "unauthorized", message: "Invalid email or password"})
    end
  end

  defp authenticate(email, password) when is_binary(email) and is_binary(password) do
    case PopRule.agent_entry(email) do
      nil ->
        {:error, :no_such_agent}

      %{password: nil} ->
        # An agent with a mapping but no password is a screen-pop entry, not a
        # login. Refusing is right: the alternative is an account whose
        # password is "whatever you typed".
        {:error, :no_password_set}

      %{password: expected} = entry ->
        if Plug.Crypto.secure_compare(password, expected) do
          {:ok, entry}
        else
          {:error, :wrong_password}
        end
    end
  end

  defp authenticate(_email, _password), do: {:error, :missing_credentials}

  defp issue(conn, email, %{ids: ids}) do
    # The FIRST id is the identity. An agent with several is known by several
    # names on the wire; the token has to carry one, and the first is the one
    # the file leads with.
    uuid = List.first(ids)

    case Jwt.sign(%{"user_uuid" => uuid}) do
      {:ok, token} ->
        Logger.info("login: #{email} -> #{uuid}")

        json(conn, %{
          "token" => token,
          "user" => %{
            "uuid" => uuid,
            "email" => email,
            "name" => email,
            "profile" => %{"powerlink_token" => uuid}
          }
        })

      {:error, :disabled} ->
        Logger.error("login: the endpoint has no secret_key_base, so no token can be minted")

        conn
        |> put_status(503)
        |> json(%{id: "unavailable", message: "Login is not configured"})
    end
  end

  @doc """
  `GET /api/users/:uuid` — the record the extension re-reads when its cache is
  empty.

  The last thing it asked an upstream for. Answering it here means the portal
  needs no engine at all: it already knows every agent, because the same file
  that lets them sign in is the one being read.

  Authenticated by the caller's own token naming that user, so an agent can
  read themselves and nobody else. There is no directory here to browse.
  """
  def show_user(conn, %{"uuid" => uuid}) do
    with {:ok, claims} <- verified(conn),
         true <- claims.user_uuid == uuid,
         %{ids: [_ | _]} <- PopRule.agent_entry(uuid) || entry_by_id(uuid) do
      json(conn, %{
        "uuid" => uuid,
        "email" => email_for(uuid),
        "name" => email_for(uuid),
        "profile" => %{"powerlink_token" => uuid}
      })
    else
      _refused ->
        conn
        |> put_status(401)
        |> json(%{id: "unauthorized", message: "Missing Authorize token."})
    end
  end

  defp verified(conn) do
    case Plug.Conn.get_req_header(conn, "authorization") do
      ["Bearer " <> token | _rest] -> Connectix.Realtime.TokenAuth.verify(token)
      _none -> {:error, :missing_token}
    end
  end

  # The agents map is keyed by email; this is the reverse read, for an id that
  # IS the identity on the token.
  defp entry_by_id(id) do
    Enum.find_value(PopRule.agent_entries(), fn {_email, entry} ->
      if id in entry.ids, do: entry
    end)
  end

  defp email_for(id) do
    Enum.find_value(PopRule.agent_entries(), fn {email, entry} ->
      if id in entry.ids, do: email
    end)
  end

  # The extension posts a form; a test or a curl posts JSON. Both arrive as
  # string keys by the time Plug.Parsers is done, and neither should have to
  # know which the other used.
  defp param(params, names) do
    Enum.find_value(names, fn name ->
      case Map.get(params, name) do
        value when is_binary(value) and value != "" -> value
        _absent -> nil
      end
    end)
  end
end
