defmodule AgentsDemoWeb.UserLive.Settings do
  use AgentsDemoWeb, :live_view

  on_mount {AgentsDemoWeb.UserAuth, :require_sudo_mode}

  alias AgentsDemo.Accounts
  alias AgentsDemoWeb.UserForm

  @impl true
  def render(assigns) do
    ~H"""
    <div class="flex h-screen w-screen bg-[var(--color-background)] overflow-hidden">
      <div class="flex flex-1 items-start justify-center p-8 overflow-y-auto">
        <div class="max-w-2xl w-full py-8">
          <div class="mb-8 flex justify-center">
            <.link navigate={~p"/chat"} class="no-underline">
              <div class="w-16 h-16 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                <.icon name="hero-chat-bubble-left-right" class="w-10 h-10 text-white" />
              </div>
            </.link>
          </div>

          <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
              Account Settings
            </h1>
            <p class="text-[var(--color-text-secondary)]">
              Manage your account email address and password settings
            </p>
          </div>

          <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 shadow-lg mb-6">
            <h2 class="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
              Profile
            </h2>
            <.form
              for={@profile_form}
              id="profile_form"
              phx-submit="update_profile"
              phx-change="validate_profile"
              class="space-y-4"
            >
              <.input
                field={@profile_form[:first_name]}
                type="text"
                label="First name"
                autocomplete="given-name"
              />
              <.button variant="primary" phx-disable-with="Saving...">
                Save Profile
              </.button>
            </.form>
          </div>

          <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 shadow-lg mb-6">
            <h2 class="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
              Email Address
            </h2>
            <.form
              for={@email_form}
              id="email_form"
              phx-submit="update_email"
              phx-change="validate_email"
              class="space-y-4"
            >
              <.input
                field={@email_form[:email]}
                type="email"
                label="Email"
                autocomplete="username"
                required
              />
              <.button variant="primary" phx-disable-with="Changing...">
                Change Email
              </.button>
            </.form>
          </div>

          <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-8 shadow-lg">
            <h2 class="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
              Password
            </h2>
            <.form
              for={@password_form}
              id="password_form"
              action={~p"/users/update-password"}
              method="post"
              phx-change="validate_password"
              phx-submit="update_password"
              phx-trigger-action={@trigger_submit}
              class="space-y-4"
            >
              <input
                name={@password_form[:email].name}
                type="hidden"
                id="hidden_user_email"
                autocomplete="username"
                value={@current_email}
              />
              <.input
                field={@password_form[:password]}
                type="password"
                label="New password"
                autocomplete="new-password"
                required
              />
              <.input
                field={@password_form[:password_confirmation]}
                type="password"
                label="Confirm new password"
                autocomplete="new-password"
              />
              <.button variant="primary" phx-disable-with="Saving...">
                Save Password
              </.button>
            </.form>
          </div>

          <div class="mt-6 text-center">
            <.link
              navigate={~p"/chat"}
              class="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] no-underline"
            >
              ← Back to chat
            </.link>
          </div>
        </div>
      </div>
    </div>
    """
  end

  @impl true
  def mount(%{"token" => token}, _session, socket) do
    socket =
      case Accounts.update_user_email(socket.assigns.current_scope.user, token) do
        {:ok, _user} ->
          put_flash(socket, :info, "Email changed successfully.")

        {:error, _reason} ->
          put_flash(socket, :error, "Email change link is invalid or it has expired.")
      end

    {:ok, push_navigate(socket, to: ~p"/users/settings")}
  end

  def mount(_params, _session, socket) do
    user = socket.assigns.current_scope.user
    socket =
      socket
      |> assign(:current_email, user.email)
      |> assign(:profile_form, UserForm.build(user))
      |> assign(:email_form, UserForm.build(user))
      |> assign(:password_form, UserForm.build(user))
      |> assign(:trigger_submit, false)

    {:ok, socket}
  end

  @impl true
  def handle_event("validate_profile", %{"user" => user_params}, socket) do
    user = socket.assigns.current_scope.user
    result = Accounts.change_user_profile(user, user_params)

    profile_form =
      UserForm.build(UserForm.user(result, user), user_params, UserForm.errors(result))

    {:noreply, assign(socket, profile_form: profile_form)}
  end

  def handle_event("update_profile", %{"user" => user_params}, socket) do
    user = socket.assigns.current_scope.user

    case Accounts.update_user_profile(user, user_params) do
      {:ok, _user} ->
        {:noreply,
         socket
         |> put_flash(:info, "Profile updated successfully.")}

      {:error, changeset} ->
        {:noreply, assign(socket, profile_form: UserForm.build(user, user_params, changeset))}
    end
  end

  @impl true
  def handle_event("validate_email", params, socket) do
    %{"user" => user_params} = params

    user = socket.assigns.current_scope.user
    result = Accounts.change_user_email(user, user_params, validate_unique: false)

    email_form =
      UserForm.build(UserForm.user(result, user), user_params, UserForm.errors(result))

    {:noreply, assign(socket, email_form: email_form)}
  end

  def handle_event("update_email", params, socket) do
    %{"user" => user_params} = params
    user = socket.assigns.current_scope.user
    true = Accounts.sudo_mode?(user)

    case Accounts.change_user_email(user, user_params) do
      {:ok, updated_user} ->
        Accounts.deliver_user_update_email_instructions(
          updated_user,
          user.email,
          &url(~p"/users/settings/confirm-email/#{&1}")
        )

        info = "A link to confirm your email change has been sent to the new address."
        {:noreply, socket |> put_flash(:info, info)}

      {:error, errors} ->
        {:noreply, assign(socket, :email_form, UserForm.build(user, user_params, errors))}
    end
  end

  def handle_event("validate_password", params, socket) do
    %{"user" => user_params} = params

    user = socket.assigns.current_scope.user
    result = Accounts.change_user_password(user, user_params, hash_password: false)

    password_form =
      UserForm.build(UserForm.user(result, user), user_params, UserForm.errors(result))

    {:noreply, assign(socket, password_form: password_form)}
  end

  def handle_event("update_password", params, socket) do
    %{"user" => user_params} = params
    user = socket.assigns.current_scope.user
    true = Accounts.sudo_mode?(user)

    case Accounts.change_user_password(user, user_params, hash_password: false) do
      {:ok, changed_user} ->
        {:noreply,
         assign(socket,
           trigger_submit: true,
           password_form: UserForm.build(changed_user, user_params)
         )}

      {:error, errors} ->
        {:noreply, assign(socket, password_form: UserForm.build(user, user_params, errors))}
    end
  end
end
