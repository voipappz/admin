defmodule ConnectixWeb.WallabyCase do
  @moduledoc """
  Browser end-to-end tests, driving a real Chrome through chromedriver.

  The Playwright suite left with the React SPA; this is the pure-BEAM
  replacement — an Elixir dependency and a browser, no Node.

  ## Running them

      WALLABY=1 mix test --only wallaby

  `WALLABY=1` is what flips `config/test.exs` to `server: true`. Without it the
  endpoint does not listen and every test here fails to connect, which is why
  the tag is excluded from the default run rather than merely slow-tagged.
  Needs `chromedriver` and Chrome on PATH (`Dockerfile.base` installs both).

  ## Basic Auth

  `ConnectixWeb.Plugs.BasicAuth` gates every browser surface, and Chrome has
  not accepted `https://user:pass@host` since 2017 — so a browser test cannot
  simply put the credential in the URL.

  It would be convenient to claim the test environment leaves
  `PORTAL_UI_USER`/`PORTAL_UI_PASS` unset, making the gate pass-through. **That
  is not true here.** `docker-compose.yml`'s `elixir` service loads the whole
  `.env` via `env_file`, and a developer's `.env` sets both so they can log in
  to the local UI — so in the dev container the suite inherits a *configured*
  gate. (Under `act` it is the opposite: `scripts/ci-local.sh` deliberately
  passes an empty env file, so the gate is pass-through there.) A browser test
  that silently depended on either would pass on one machine and 401 on the
  other.

  So this case removes the variables for its duration and restores them
  afterwards, making the gate pass-through deterministically in both
  environments. `Connectix.Config.basic_auth/0` reads the environment at call
  time, so no restart is needed. They are process-global, hence `async: false`.

  The gate itself is not left untested: `ConnectixWeb.SurfacesSmokeTest` sets
  the variables and asserts a credential-less request is refused — cheaper and
  more reliable at the HTTP layer than through a browser.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      use Wallaby.DSL

      import ConnectixWeb.WallabyCase

      @moduletag :wallaby
      @endpoint ConnectixWeb.Endpoint
    end
  end

  setup _tags do
    Connectix.Mnesia.reset_domain_for_test!()
    Connectix.Portal.Store.reset_for_test!()

    unset_basic_auth()

    {:ok, session} = Wallaby.start_session()
    {:ok, session: session}
  end

  @doc """
  Drops `PORTAL_UI_USER`/`PORTAL_UI_PASS` for this test and restores whatever
  was there when it ends. See the moduledoc for why a browser test cannot
  authenticate any other way.
  """
  def unset_basic_auth do
    previous = Enum.map(~w(PORTAL_UI_USER PORTAL_UI_PASS), &{&1, System.get_env(&1)})

    Enum.each(~w(PORTAL_UI_USER PORTAL_UI_PASS), &System.delete_env/1)

    ExUnit.Callbacks.on_exit(fn ->
      for {name, value} <- previous do
        if value, do: System.put_env(name, value), else: System.delete_env(name)
      end
    end)
  end
end
