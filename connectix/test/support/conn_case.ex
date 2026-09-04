defmodule ConnectixWeb.ConnCase do
  @moduledoc """
  This module defines the test case to be used by
  tests that require setting up a connection.

  Such tests rely on `Phoenix.ConnTest` and also
  import other functionality to make it easier
  to build common data structures and query the data layer.

  Mnesia tables are cleared before each test. Connection tests run
  synchronously because those tables are shared process-wide.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      # The default endpoint for testing
      @endpoint ConnectixWeb.Endpoint

      use ConnectixWeb, :verified_routes

      # Import conveniences for testing with connections
      import Plug.Conn
      import Phoenix.ConnTest
      import ConnectixWeb.ConnCase
    end
  end

  setup _tags do
    Connectix.Mnesia.reset_domain_for_test!()
    Connectix.Portal.Store.reset_for_test!()
    {:ok, conn: authenticated_conn()}
  end

  @doc """
  A `conn` that clears `ConnectixWeb.Plugs.BasicAuth`, whether or not it's
  configured.

  Tests must not depend on `Connectix.Config.basic_auth/0` being unset: a
  developer's own `.env` sets `PORTAL_UI_USER`/`PORTAL_UI_PASS` for local
  browser testing, `docker-compose.yml`'s `elixir` service loads that whole
  file via `env_file`, and `mix test` inherits it too — so a plain
  `build_conn()` started failing every LiveView/controller test the moment
  those variables were set, for a reason with nothing to do with the test
  itself. Reading the credential at call time (like `Connectix.Config`
  everywhere else) keeps this correct however the suite is invoked.
  """
  def authenticated_conn do
    conn = Phoenix.ConnTest.build_conn()

    case Connectix.Config.basic_auth() do
      {user, pass} ->
        Plug.Conn.put_req_header(conn, "authorization", "Basic " <> Base.encode64("#{user}:#{pass}"))

      nil ->
        conn
    end
  end

  @doc """
  Setup helper that registers and logs in users.

      setup :register_and_log_in_user

  It stores an updated connection and a registered user in the
  test context.
  """
  def register_and_log_in_user(%{conn: conn} = context) do
    user = Connectix.AccountsFixtures.user_fixture()
    scope = Connectix.Accounts.Scope.for_user(user)

    opts =
      context
      |> Map.take([:token_authenticated_at])
      |> Enum.into([])

    %{conn: log_in_user(conn, user, opts), user: user, scope: scope}
  end

  @doc """
  Logs the given `user` into the `conn`.

  It returns an updated `conn`.
  """
  def log_in_user(conn, user, opts \\ []) do
    token = Connectix.Accounts.generate_user_session_token(user)

    maybe_set_token_authenticated_at(token, opts[:token_authenticated_at])

    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> Plug.Conn.put_session(:user_token, token)
  end

  @doc """
  Setup helper for the bearer-authenticated API.

      setup :api_conn

  Configures `AGENTS_DEMO_API_KEY` and `AGENTS_DEMO_API_USER_EMAIL` for the
  test (restored afterwards), registers that user, and returns a `conn`
  carrying the bearer header plus the user's scope. The variables are
  process-global, so tests using this must not be `async`.
  """
  def api_conn(%{conn: conn}) do
    user = Connectix.AccountsFixtures.user_fixture()
    key = "test-api-key-#{System.unique_integer([:positive])}-0123456789"

    previous =
      Enum.map(~w(AGENTS_DEMO_API_KEY AGENTS_DEMO_API_USER_EMAIL), &{&1, System.get_env(&1)})

    System.put_env("AGENTS_DEMO_API_KEY", key)
    System.put_env("AGENTS_DEMO_API_USER_EMAIL", user.email)

    ExUnit.Callbacks.on_exit(fn ->
      for {name, value} <- previous do
        if value, do: System.put_env(name, value), else: System.delete_env(name)
      end
    end)

    conn =
      conn
      |> Plug.Conn.put_req_header("authorization", "Bearer " <> key)
      |> Plug.Conn.put_req_header("accept", "application/json")

    %{conn: conn, user: user, scope: Connectix.Accounts.Scope.for_user(user)}
  end

  defp maybe_set_token_authenticated_at(_token, nil), do: nil

  defp maybe_set_token_authenticated_at(token, authenticated_at) do
    Connectix.AccountsFixtures.override_token_authenticated_at(token, authenticated_at)
  end
end
