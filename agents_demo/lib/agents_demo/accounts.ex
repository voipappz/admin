defmodule AgentsDemo.Accounts do
  @moduledoc """
  The Accounts context — users, sessions, and email tokens, on Mnesia.

  No Ecto, no Postgres: persistence is `AgentsDemo.Accounts.Store`, validation is
  `AgentsDemo.Accounts.User`. Functions return `{:ok, %User{}}` or
  `{:error, %{field => [messages]}}`.
  """

  alias AgentsDemo.Accounts.{Store, User, UserToken, UserNotifier, Scope}
  alias AgentsDemo.Mnesia

  ## Getters

  def get_user_by_email(email) when is_binary(email),
    do: email |> String.trim() |> String.downcase() |> Store.get_user_by_email()

  def get_user_by_email_and_password(email, password)
      when is_binary(email) and is_binary(password) do
    user = Store.get_user_by_email(email)
    if User.valid_password?(user, password), do: user
  end

  @doc "Fetch a user by id, raising when absent."
  def get_user!(id) do
    Store.get_user(id) || raise KeyError, key: id, term: User
  end

  ## Registration

  @doc """
  Register a user and their default bot in one Mnesia transaction, so no account
  ever exists without a bot to pin (`AgentsDemo.Bots.ensure_default_bot/1`).
  """
  def register_user(attrs) do
    with {:ok, user} <- User.validate_email(%User{}, attrs) do
      Mnesia.transaction(fn ->
        stored = Store.insert_user(user)

        case AgentsDemo.Bots.ensure_default_bot(Scope.for_user(stored)) do
          {:ok, _bot} -> stored
          {:error, reason} -> :mnesia.abort(reason)
        end
      end)
    end
  end

  ## Settings

  def sudo_mode?(user, minutes \\ -20)

  def sudo_mode?(%User{authenticated_at: ts}, minutes) when is_struct(ts, DateTime),
    do: DateTime.after?(ts, DateTime.add(DateTime.utc_now(), minutes, :minute))

  def sudo_mode?(_user, _minutes), do: false

  def change_user_email(user, attrs \\ %{}, opts \\ []) do
    User.validate_email(user, attrs, Keyword.put_new(opts, :validate_unique, false))
  end

  @doc "Apply a pending email change identified by `token`."
  def update_user_email(user, token) do
    context = "change:#{user.email}"

    with {:ok, hashed} <- UserToken.hash_email_token(token),
         %UserToken{sent_to: email} = t when not is_nil(email) <- Store.get_token(hashed, context),
         true <- UserToken.valid?(t),
         {:ok, updated} <- User.validate_email(user, %{email: email}) do
      stored = Store.update_user(updated)
      Store.delete_user_tokens(user.id, [context])
      {:ok, stored}
    else
      _ -> {:error, :transaction_aborted}
    end
  end

  def change_user_password(user, attrs \\ %{}, opts \\ []) do
    User.validate_password(user, attrs, Keyword.put_new(opts, :hash_password, false))
  end

  @doc "Update the password and expire every token; returns `{:ok, {user, expired}}`."
  def update_user_password(user, attrs) do
    with {:ok, updated} <- User.validate_password(user, attrs) do
      stored = Store.update_user(updated)
      expired = Store.delete_user_tokens(user.id)
      {:ok, {stored, expired}}
    end
  end

  def change_user_profile(user, attrs \\ %{}), do: User.validate_profile(user, attrs)

  def update_user_profile(user, attrs) do
    with {:ok, updated} <- User.validate_profile(user, attrs),
         do: {:ok, Store.update_user(updated)}
  end

  ## Sessions

  def generate_user_session_token(user) do
    {token, row} = UserToken.build_session_token(user)
    Store.insert_token(row)
    token
  end

  @doc "The user for a valid session token, plus the token's `inserted_at`, or nil."
  def get_user_by_session_token(token) do
    with %UserToken{} = t <- Store.get_token(token, "session"),
         true <- UserToken.valid?(t),
         %User{} = user <- Store.get_user(t.user_id) do
      {%{user | authenticated_at: t.authenticated_at}, t.inserted_at}
    else
      _ -> nil
    end
  end

  def get_user_by_magic_link_token(token) do
    with {:ok, hashed} <- UserToken.hash_email_token(token),
         %UserToken{} = t <- Store.get_token(hashed, "login"),
         true <- UserToken.valid?(t),
         %User{email: email} = user <- Store.get_user(t.user_id),
         ^email <- t.sent_to do
      user
    else
      _ -> nil
    end
  end

  @doc "Log a user in via magic link, confirming and clearing tokens as needed."
  def login_user_by_magic_link(token) do
    with {:ok, hashed} <- UserToken.hash_email_token(token),
         %UserToken{} = t <- Store.get_token(hashed, "login"),
         true <- UserToken.valid?(t),
         %User{} = user <- Store.get_user(t.user_id) do
      cond do
        is_nil(user.confirmed_at) and not is_nil(user.hashed_password) ->
          raise "magic link log in is not allowed for unconfirmed users with a password set!"

        is_nil(user.confirmed_at) ->
          stored = Store.update_user(User.confirm(user))
          expired = Store.delete_user_tokens(user.id)
          {:ok, {stored, expired}}

        true ->
          Store.delete_token(t.id)
          {:ok, {user, []}}
      end
    else
      _ -> {:error, :not_found}
    end
  end

  ## Email delivery

  def deliver_user_update_email_instructions(%User{} = user, current_email, url_fun)
      when is_function(url_fun, 1) do
    {encoded, row} = UserToken.build_email_token(user, "change:#{current_email}")
    Store.insert_token(row)
    UserNotifier.deliver_update_email_instructions(user, url_fun.(encoded))
  end

  def deliver_login_instructions(%User{} = user, url_fun) when is_function(url_fun, 1) do
    {encoded, row} = UserToken.build_email_token(user, "login")
    Store.insert_token(row)
    UserNotifier.deliver_login_instructions(user, url_fun.(encoded))
  end

  def delete_user_session_token(token), do: Store.delete_session_token(token)
end
