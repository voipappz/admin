defmodule AgentsDemo.Accounts.User do
  @moduledoc """
  A user — a plain struct now, no Ecto.

  Validation lives in this module as functions returning
  `{:ok, struct} | {:error, errors}` where `errors` is `%{field => [messages]}`.
  The store (`AgentsDemo.Accounts.Store`) owns persistence in Mnesia; this owns
  shape and rules. Password hashing stays `Bcrypt` — never Ecto's concern.
  """

  alias __MODULE__

  @derive {Jason.Encoder, only: [:id, :first_name, :email, :confirmed_at, :inserted_at]}
  defstruct [
    :id,
    :first_name,
    :email,
    :hashed_password,
    :confirmed_at,
    :inserted_at,
    :updated_at,
    # Virtual — never stored: set from the token on session load.
    :authenticated_at
  ]

  @email_format ~r/^[^@,;\s]+@[^@,;\s]+$/

  @doc """
  Validate an email (and optional first_name) change, returning the applied
  struct or `%{field => [messages]}`.

  `:validate_unique` (default true) checks the email is free via the store —
  the replacement for `unsafe_validate_unique` + `unique_constraint`. Set false
  for live form validation.
  """
  def validate_email(%User{} = user, attrs, opts \\ []) do
    attrs = stringify(attrs)
    email = attrs |> Map.get("email", user.email) |> normalize()
    first_name = Map.get(attrs, "first_name", user.first_name)

    %{}
    |> require_present(:email, email)
    |> check(:email, email && !Regex.match?(@email_format, email),
      "must have the @ sign and no spaces")
    |> check(:email, email && String.length(email) > 160, "should be at most 160 character(s)")
    |> then(fn errors ->
      if Keyword.get(opts, :validate_unique, true),
        do: validate_email_unique(errors, user, email),
        else: errors
    end)
    |> finish(%{user | email: email, first_name: first_name})
  end

  defp validate_email_unique(errors, user, email) do
    cond do
      errors[:email] -> errors
      is_nil(email) -> errors
      email == user.email -> Map.update(errors, :email, ["did not change"], &["did not change" | &1])
      AgentsDemo.Accounts.Store.email_taken?(email, user.id) ->
        Map.update(errors, :email, ["has already been taken"], &["has already been taken" | &1])
      true -> errors
    end
  end

  @doc """
  Validate a password change, hashing it into `hashed_password` when valid.

  `:hash_password` (default true) — set false for live form validation so the
  plaintext is not hashed or cleared.
  """
  def validate_password(%User{} = user, attrs, opts \\ []) do
    attrs = stringify(attrs)
    password = Map.get(attrs, "password")
    confirmation = Map.get(attrs, "password_confirmation")

    errors =
      %{}
      |> require_present(:password, password)
      |> check(:password, password && String.length(password) < 12,
        "should be at least 12 character(s)")
      |> check(:password, password && String.length(password) > 72,
        "should be at most 72 character(s)")
      |> check(:password, confirmation != nil && confirmation != password,
        "does not match password")

    cond do
      map_size(errors) > 0 -> {:error, errors}
      Keyword.get(opts, :hash_password, true) ->
        {:ok, %{user | hashed_password: Bcrypt.hash_pwd_salt(password)}}
      true ->
        {:ok, user}
    end
  end

  @doc "Validate profile fields (first_name)."
  def validate_profile(%User{} = user, attrs) do
    attrs = stringify(attrs)
    {:ok, %{user | first_name: Map.get(attrs, "first_name", user.first_name)}}
  end

  @doc "Set `confirmed_at` to now."
  def confirm(%User{} = user), do: %{user | confirmed_at: DateTime.utc_now(:second)}

  @doc """
  Verify a password. Calls `Bcrypt.no_user_verify/0` for a missing user/hash to
  keep the timing constant against enumeration.
  """
  def valid_password?(%User{hashed_password: hashed}, password)
      when is_binary(hashed) and byte_size(password) > 0 do
    Bcrypt.verify_pass(password, hashed)
  end

  def valid_password?(_user, _password) do
    Bcrypt.no_user_verify()
    false
  end

  # ── helpers ────────────────────────────────────────────────────────────────

  defp normalize(nil), do: nil
  defp normalize(email), do: email |> to_string() |> String.trim()

  defp require_present(errors, field, value) when value in [nil, ""],
    do: Map.update(errors, field, ["can't be blank"], &["can't be blank" | &1])

  defp require_present(errors, _field, _value), do: errors

  defp check(errors, _field, false, _msg), do: errors
  defp check(errors, _field, nil, _msg), do: errors

  defp check(errors, field, _truthy, msg),
    do: Map.update(errors, field, [msg], &[msg | &1])

  defp finish(errors, struct) when map_size(errors) == 0, do: {:ok, struct}
  defp finish(errors, _struct), do: {:error, errors}

  defp stringify(attrs), do: Map.new(attrs, fn {k, v} -> {to_string(k), v} end)
end
