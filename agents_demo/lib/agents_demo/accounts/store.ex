defmodule AgentsDemo.Accounts.Store do
  @moduledoc """
  Users and their tokens, in Mnesia.

  A supervised process that declares the tables at boot and owns their reads and
  writes. No Ecto, no Postgres — the store is the whole persistence story for
  accounts.

  ## Distribution

  Tables are `disc_copies` on the local node and **replicated to every other
  connected node** at boot (`AgentsDemo.Mnesia.replicate/1`), so a cluster of
  BEAM nodes shares one consistent user set with no external database. On a
  single node it is simply local disc storage.

  ## Best practice

  Every read and write runs in a `:mnesia.transaction` — never dirty ops for
  account data. Lookups go through **secondary indexes** (`email`, `token`,
  `user_id`) rather than table scans. Integer ids come from an atomic Mnesia
  counter (`Mnesia.next_id/1`), the OTP-native replacement for `bigserial`.
  """

  use GenServer

  alias AgentsDemo.Accounts.{User, UserToken}
  alias AgentsDemo.Mnesia

  @users :users
  @user_fields [
    :id,
    :first_name,
    :email,
    :hashed_password,
    :confirmed_at,
    :inserted_at,
    :updated_at
  ]

  @tokens :users_tokens
  @token_fields [:id, :token, :context, :sent_to, :user_id, :authenticated_at, :inserted_at]

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(_opts) do
    Mnesia.ensure_table(@users, attributes: @user_fields, type: :set, index: [:email])
    Mnesia.ensure_table(@tokens, attributes: @token_fields, type: :set, index: [:token, :user_id])
    {:ok, %{}}
  end

  # ── Users ────────────────────────────────────────────────────────────────

  def get_user(id), do: Mnesia.get(@users, @user_fields, id) |> to_user()

  def get_user_by_email(email) do
    Mnesia.transaction!(fn ->
      case Mnesia.index_read(@users, @user_fields, email, :email) do
        [row | _] -> row
        [] -> nil
      end
    end)
    |> to_user()
  end

  @doc "True when `email` belongs to a user other than `except_id`."
  def email_taken?(email, except_id) do
    Mnesia.transaction!(fn ->
      @users
      |> Mnesia.index_read(@user_fields, email, :email)
      |> Enum.any?(&(&1.id != except_id))
    end)
  end

  @doc "Insert a validated `%User{}`, assigning id and timestamps."
  def insert_user(%User{} = user) do
    now = DateTime.utc_now(:second)

    row =
      user
      |> Map.from_struct()
      |> Map.take(@user_fields)
      |> Map.merge(%{id: Mnesia.next_id(@users), inserted_at: now, updated_at: now})

    Mnesia.transaction!(fn -> Mnesia.write(@users, @user_fields, row) end)
    to_user(row)
  end

  @doc "Persist changes to an existing `%User{}`."
  def update_user(%User{id: id} = user) when not is_nil(id) do
    row =
      user
      |> Map.from_struct()
      |> Map.take(@user_fields)
      |> Map.put(:updated_at, DateTime.utc_now(:second))

    Mnesia.transaction!(fn -> Mnesia.write(@users, @user_fields, row) end)
    to_user(row)
  end

  def list_users do
    Mnesia.transaction!(fn -> Mnesia.all(@users, @user_fields) end) |> Enum.map(&to_user/1)
  end

  # ── Tokens ───────────────────────────────────────────────────────────────

  def insert_token(%UserToken{} = token) do
    row =
      token
      |> Map.from_struct()
      |> Map.merge(%{id: Mnesia.next_id(@tokens), inserted_at: DateTime.utc_now(:second)})

    Mnesia.transaction!(fn -> Mnesia.write(@tokens, @token_fields, row) end)
    struct(UserToken, row)
  end

  def update_token(%UserToken{id: id} = token) when not is_nil(id) do
    row = token |> Map.from_struct() |> Map.take(@token_fields)
    Mnesia.transaction!(fn -> Mnesia.write(@tokens, @token_fields, row) end)
    to_token(row)
  end

  @doc "The token row for a raw token value and context, or nil."
  def get_token(token, context) do
    Mnesia.transaction!(fn ->
      @tokens
      |> Mnesia.index_read(@token_fields, token, :token)
      |> Enum.find(&(&1.context == context))
    end)
    |> to_token()
  end

  def get_token_by_value(token) do
    Mnesia.transaction!(fn ->
      @tokens
      |> Mnesia.index_read(@token_fields, token, :token)
      |> List.first()
    end)
    |> to_token()
  end

  def list_tokens_for_user(user_id) do
    Mnesia.transaction!(fn -> Mnesia.index_read(@tokens, @token_fields, user_id, :user_id) end)
    |> Enum.map(&to_token/1)
  end

  def delete_token(id), do: Mnesia.transaction!(fn -> Mnesia.delete(@tokens, id) end)

  @doc "Delete a user's tokens, optionally restricted to exact contexts."
  def delete_user_tokens(user_id, contexts \\ :all) do
    Mnesia.transaction!(fn ->
      tokens =
        @tokens
        |> Mnesia.index_read(@token_fields, user_id, :user_id)
        |> Enum.filter(&(contexts == :all or &1.context in contexts))

      Enum.each(tokens, &Mnesia.delete(@tokens, &1.id))
      tokens
    end)
    |> Enum.map(&to_token/1)
  end

  @doc "Delete a specific session token by its raw value."
  def delete_session_token(token) do
    Mnesia.transaction!(fn ->
      @tokens
      |> Mnesia.index_read(@token_fields, token, :token)
      |> Enum.filter(&(&1.context == "session"))
      |> Enum.each(&Mnesia.delete(@tokens, &1.id))
    end)

    :ok
  end

  # ── shaping ────────────────────────────────────────────────────────────────

  defp to_user(nil), do: nil
  defp to_user(%{} = row), do: struct(User, row)

  defp to_token(nil), do: nil
  defp to_token(%{} = row), do: struct(UserToken, row)
end
