defmodule Connectix.AccountsTest do
  use Connectix.DataCase

  alias Connectix.Accounts
  alias Connectix.Accounts.{Store, User, UserToken}

  import Connectix.AccountsFixtures

  describe "registration and lookup" do
    test "registers a passwordless user with a published default bot" do
      email = unique_user_email()

      assert {:ok, %User{email: ^email, hashed_password: nil, confirmed_at: nil} = user} =
               Accounts.register_user(%{email: email})

      scope = Connectix.Accounts.Scope.for_user(user)

      assert {:ok, %{slug: "default", current_version_id: id}} =
               Connectix.Bots.get_bot_by_slug(scope, "default")

      assert is_binary(id)
      assert Accounts.get_user!(user.id).id == user.id
      assert Accounts.get_user_by_email(String.upcase(email)) == user
      assert_raise KeyError, fn -> Accounts.get_user!(-1) end
    end

    test "validates email presence, shape, length, and case-insensitive uniqueness" do
      assert {:error, %{email: ["can't be blank"]}} = Accounts.register_user(%{})

      assert {:error, %{email: ["must have the @ sign and no spaces"]}} =
               Accounts.register_user(%{email: "not valid"})

      assert {:error, errors} = Accounts.register_user(%{email: String.duplicate("db", 100)})
      assert "should be at most 160 character(s)" in errors.email

      user = user_fixture()

      assert {:error, %{email: ["has already been taken"]}} =
               Accounts.register_user(%{email: String.upcase(user.email)})
    end
  end

  describe "passwords" do
    test "validates, hashes, authenticates, and expires tokens" do
      user = user_fixture()
      _session = Accounts.generate_user_session_token(user)

      assert {:error, errors} =
               Accounts.update_user_password(user, %{
                 password: "not valid",
                 password_confirmation: "another"
               })

      assert errors.password == ["should be at least 12 character(s)"]
      assert errors.password_confirmation == ["does not match password"]

      assert {:ok, {updated, expired}} =
               Accounts.update_user_password(user, %{password: "new valid password"})

      assert updated.password == nil
      assert expired != []
      assert Store.list_tokens_for_user(user.id) == []
      assert Accounts.get_user_by_email_and_password(user.email, "new valid password")
      refute Accounts.get_user_by_email_and_password(user.email, "invalid")
    end

    test "change_user_password keeps plaintext only in the returned preview" do
      assert {:ok, preview} =
               Accounts.change_user_password(%User{}, %{"password" => "new valid password"},
                 hash_password: false
               )

      assert preview.password == "new valid password"
      assert preview.hashed_password == nil
    end
  end

  describe "email changes" do
    test "a valid token updates the email and deletes all user tokens" do
      user = unconfirmed_user_fixture()
      email = unique_user_email()

      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_update_email_instructions(%{user | email: email}, user.email, url)
        end)

      assert {:ok, %{email: ^email}} = Accounts.update_user_email(user, token)
      assert Store.get_user(user.id).email == email
      assert Store.list_tokens_for_user(user.id) == []
    end

    test "invalid, mismatched, and expired tokens do not update the user" do
      user = unconfirmed_user_fixture()
      email = unique_user_email()

      token =
        extract_user_token(fn url ->
          Accounts.deliver_user_update_email_instructions(%{user | email: email}, user.email, url)
        end)

      assert {:error, :transaction_aborted} = Accounts.update_user_email(user, "oops")

      assert {:error, :transaction_aborted} =
               Accounts.update_user_email(%{user | email: "changed@example.com"}, token)

      stored = only_token(user)
      Store.update_token(%{stored | inserted_at: ~U[2020-01-01 00:00:00Z]})
      assert {:error, :transaction_aborted} = Accounts.update_user_email(user, token)
      assert Store.get_user(user.id).email == user.email
    end
  end

  describe "session tokens" do
    test "generate, load, preserve authentication time, expire, and delete" do
      user = %{user_fixture() | authenticated_at: DateTime.add(DateTime.utc_now(:second), -3600)}
      token = Accounts.generate_user_session_token(user)
      stored = Store.get_token_by_value(token)

      assert stored.context == "session"
      assert stored.authenticated_at == user.authenticated_at
      assert {loaded, inserted_at} = Accounts.get_user_by_session_token(token)
      assert loaded.id == user.id
      assert inserted_at == stored.inserted_at

      Store.update_token(%{stored | inserted_at: ~U[2020-01-01 00:00:00Z]})
      refute Accounts.get_user_by_session_token(token)
      assert :ok = Accounts.delete_user_session_token(token)
      assert Store.get_token_by_value(token) == nil
    end
  end

  describe "magic links" do
    test "load and login confirm an unconfirmed user and consume tokens" do
      user = unconfirmed_user_fixture()
      {encoded, hashed} = generate_user_magic_link_token(user)

      assert Accounts.get_user_by_magic_link_token(encoded).id == user.id

      assert {:ok, {confirmed, [%UserToken{token: ^hashed}]}} =
               Accounts.login_user_by_magic_link(encoded)

      assert confirmed.confirmed_at
      assert Store.list_tokens_for_user(user.id) == []
    end

    test "confirmed-user links are one-time and expired links are rejected" do
      user = user_fixture()
      {encoded, _hashed} = generate_user_magic_link_token(user)
      assert {:ok, {^user, []}} = Accounts.login_user_by_magic_link(encoded)
      assert {:error, :not_found} = Accounts.login_user_by_magic_link(encoded)

      {expired, _hashed} = generate_user_magic_link_token(user)
      stored = only_token(user)
      Store.update_token(%{stored | inserted_at: ~U[2020-01-01 00:00:00Z]})
      refute Accounts.get_user_by_magic_link_token(expired)
    end

    test "an unconfirmed user with a password cannot log in by magic link" do
      user = unconfirmed_user_fixture()
      Store.update_user(%{user | hashed_password: "hashed"})
      {encoded, _hashed} = generate_user_magic_link_token(user)

      assert_raise RuntimeError, ~r/magic link log in is not allowed/, fn ->
        Accounts.login_user_by_magic_link(encoded)
      end
    end
  end

  test "sudo mode uses the authentication time" do
    now = DateTime.utc_now()
    assert Accounts.sudo_mode?(%User{authenticated_at: DateTime.add(now, -19, :minute)})
    refute Accounts.sudo_mode?(%User{authenticated_at: DateTime.add(now, -21, :minute)})
    refute Accounts.sudo_mode?(%User{})
  end

  test "User inspection never exposes a plaintext password" do
    refute inspect(%User{password: "123456"}) =~ "password: \"123456\""
  end

  defp only_token(user) do
    assert [token] = Store.list_tokens_for_user(user.id)
    token
  end
end
