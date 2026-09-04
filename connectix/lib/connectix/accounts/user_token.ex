defmodule Connectix.Accounts.UserToken do
  @moduledoc """
  Session and email tokens — a plain struct plus pure builders/verifiers.

  No Ecto queries: a token is built here, persisted by
  `Connectix.Accounts.Store`, and verified by looking the raw value up in the
  store and checking its age against the validity windows below. Session tokens
  are stored raw; email/magic-link tokens are stored as a SHA-256 hash so a copy
  of the database cannot be replayed.
  """

  alias __MODULE__

  defstruct [:id, :token, :context, :sent_to, :user_id, :authenticated_at, :inserted_at]

  @hash_algorithm :sha256
  @rand_size 32

  @session_validity_in_days 14
  @magic_link_validity_in_minutes 15
  @change_email_validity_in_days 7

  @doc "A raw session token and the row to store for it."
  def build_session_token(user) do
    token = :crypto.strong_rand_bytes(@rand_size)
    at = user.authenticated_at || DateTime.utc_now(:second)
    {token, %UserToken{token: token, context: "session", user_id: user.id, authenticated_at: at}}
  end

  @doc """
  An encoded (URL-safe) email token to send, and the hashed row to store.

  The plaintext goes to the user; only its hash is persisted.
  """
  def build_email_token(user, context) do
    token = :crypto.strong_rand_bytes(@rand_size)
    hashed = :crypto.hash(@hash_algorithm, token)

    {Base.url_encode64(token, padding: false),
     %UserToken{token: hashed, context: context, sent_to: user.email, user_id: user.id}}
  end

  @doc "Hash an encoded email token back to its stored form, or `:error`."
  def hash_email_token(encoded) do
    case Base.url_decode64(encoded, padding: false) do
      {:ok, decoded} -> {:ok, :crypto.hash(@hash_algorithm, decoded)}
      :error -> :error
    end
  end

  @doc "Whether a stored token row is still within its validity window."
  def valid?(%UserToken{context: "session", inserted_at: at}),
    do: within?(at, @session_validity_in_days, :day)

  def valid?(%UserToken{context: "login", inserted_at: at}),
    do: within?(at, @magic_link_validity_in_minutes, :minute)

  def valid?(%UserToken{context: "change:" <> _, inserted_at: at}),
    do: within?(at, @change_email_validity_in_days, :day)

  def valid?(_token), do: false

  defp within?(nil, _n, _unit), do: false

  defp within?(inserted_at, n, unit) do
    DateTime.after?(inserted_at, DateTime.add(DateTime.utc_now(), -n, unit))
  end
end
