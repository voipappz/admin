defmodule ConnectixWeb.Plugs.ApiAuth do
  @moduledoc """
  Bearer-token auth for the public API.

  The key and the user it acts as come from `Connectix.Config` — see
  `Connectix.Config.api_key/0` and `Connectix.Config.api_user_email/0` for
  what they are and what happens when either is missing.
  """

  import Plug.Conn

  alias Connectix.Accounts
  alias Connectix.Accounts.Scope
  alias Connectix.Accounts.User
  alias Connectix.Config

  def init(opts), do: opts

  def call(conn, _opts) do
    with {:ok, key} <- configured_key(),
         {:ok, presented} <- bearer_token(conn),
         true <- Plug.Crypto.secure_compare(presented, key),
         {:ok, user} <- api_user() do
      assign(conn, :current_scope, Scope.for_user(user))
    else
      _unauthorized -> refuse(conn)
    end
  end

  defp configured_key do
    case Config.api_key() do
      key when is_binary(key) -> {:ok, key}
      nil -> :error
    end
  end

  defp bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> {:ok, String.trim(token)}
      _missing -> :error
    end
  end

  defp api_user do
    with email when is_binary(email) <- Config.api_user_email(),
         %User{} = user <- Accounts.get_user_by_email(email) do
      {:ok, user}
    else
      _unknown -> :error
    end
  end

  # Deliberately one message for every failure. Distinguishing "no key
  # configured" from "wrong key" from "unknown user" tells an unauthenticated
  # caller about the deployment.
  defp refuse(conn) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(401, ~s({"error":"unauthorized"}))
    |> halt()
  end
end
