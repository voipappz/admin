defmodule ConnectixWeb.UserAuth do
  @moduledoc false
  use ConnectixWeb, :verified_routes

  import Plug.Conn

  alias Connectix.Accounts
  alias Connectix.Accounts.Scope

  @doc """
  Assigns `:current_scope` in the `:browser` pipeline from the Basic Auth
  identity `ConnectixWeb.Plugs.BasicAuth` just gated. See `resolve_scope/0` —
  this plug and the `:mount_current_scope` LiveView `on_mount` below call the
  same resolution, since a Plug's `conn.assigns` never reaches the LiveView
  socket (only the session does), and there is nothing per-request to put in
  the session: the identity is fixed by configuration, not by what the
  request carried.
  """
  def fetch_current_scope_for_user(conn, _opts) do
    assign(conn, :current_scope, resolve_scope())
  end

  @doc """
  The one operator account, get-or-created from the configured Basic Auth
  username (`Connectix.Config.basic_auth/0`), or `"dev"` when Basic Auth is
  unconfigured — matching `ConnectixWeb.Plugs.BasicAuth`'s own pass-through
  default so local dev/test needs no setup.

  There is no login flow to assign a scope during, so this is idempotent and
  safe to call from both the HTTP plug and the LiveView `on_mount` hook for
  the same request.
  """
  def resolve_scope do
    username =
      case Connectix.Config.basic_auth() do
        {user, _pass} -> user
        nil -> "dev"
      end

    email = "#{username}@local.basicauth"

    user =
      Accounts.get_user_by_email(email) ||
        case Accounts.register_user(%{"email" => email, "first_name" => username}) do
          {:ok, user} -> user
          # Lost a race with another request resolving the same identity.
          {:error, _reason} -> Accounts.get_user_by_email(email)
        end

    Scope.for_user(user)
  end

  @doc """
  Handles mounting `current_scope` in LiveViews — see
  `ConnectixWeb.Router`'s `live_session :current_user`.

      live_session :current_user, on_mount: [{ConnectixWeb.UserAuth, :mount_current_scope}] do
        live "/chat", ChatLive
      end
  """
  def on_mount(:mount_current_scope, _params, _session, socket) do
    {:cont, Phoenix.Component.assign_new(socket, :current_scope, fn -> resolve_scope() end)}
  end
end
