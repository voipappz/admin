defmodule AgentsDemoWeb.Router do
  use AgentsDemoWeb, :router

  import AgentsDemoWeb.UserAuth

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {AgentsDemoWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    plug :fetch_current_scope_for_user
  end

  pipeline :api do
    plug :accepts, ["json"]
    plug OpenApiSpex.Plug.PutApiSpec, module: AgentsDemoWeb.ApiSpec
  end

  # The spec and its UI are unauthenticated on purpose: they describe the API
  # rather than expose it, and a customer needs to read them before they have
  # a key.
  scope "/api" do
    pipe_through :api

    get "/openapi", OpenApiSpex.Plug.RenderSpec, []
    get "/docs", OpenApiSpex.Plug.SwaggerUI, path: "/api/openapi"
  end

  scope "/api", AgentsDemoWeb.Api do
    pipe_through [:api, AgentsDemoWeb.Plugs.ApiAuth]

    post "/conversations", ConversationController, :create
    post "/conversations/:id/messages", ConversationController, :create_message
    get "/conversations/:id/messages", ConversationController, :index_messages

    get "/skills", SkillController, :index

    get "/bots", BotController, :index
    post "/bots", BotController, :create
    get "/bots/:id", BotController, :show
    patch "/bots/:id", BotController, :update
    delete "/bots/:id", BotController, :delete
    post "/bots/:id/publish", BotController, :publish
    post "/bots/:id/preflight", BotController, :preflight
    post "/bots/:id/draft", BotController, :create_draft
    delete "/bots/:id/draft", BotController, :delete_draft
    post "/bots/:id/archive", BotController, :archive
    post "/bots/:id/unarchive", BotController, :unarchive
    get "/bots/:id/versions", BotController, :index_versions
    get "/bots/:id/versions/:number", BotController, :show_version
    post "/bots/:id/versions/:number/retire", BotController, :retire_version
  end

  # The LiveView web UI, off by default.
  #
  # The React portal (Vite build, served by `AgentsDemoWeb.Plugs.Spa`) is the
  # UI — same call as `connectix.io/phone`, which runs headless for the same
  # reason. Two ways to build a screen in one app is how both grow, so only one
  # is mounted.
  #
  # Gated rather than deleted: the LiveViews and their tests still compile and
  # run (`config/test.exs` turns this on), so turning the UI back on is a config
  # change, not a recovery. `:browser` and `AgentsDemoWeb.UserAuth` stay wired
  # for the same reason.
  if Application.compile_env(:agents_demo, :liveview_ui?, false) do
    scope "/", AgentsDemoWeb do
      pipe_through :browser

      live "/", WelcomeLive
    end
  end

  # The dashboard builder's storage. `/dashboard/*` rather than `/api/dashboard`
  # because the shipped client already calls these paths and the point of
  # moving them here was that nothing outside this repo has to change.
  #
  # This is CONFIGURATION only — boards and widget definitions. The values the
  # widgets show come from the event projection, which has not moved off the
  # retired Deno BFF yet, so `/dashboard/snapshot` and `/dashboard/events` are
  # still unserved and 404 here.
  #
  # Served here rather than forwarded — see Portal.StatusController for why the
  # relay currently cannot carry it, and why a static list is the right
  # stand-in until it can. `Plugs.EngineProxy` knows to let this one through.
  scope "/api", AgentsDemoWeb.Portal do
    pipe_through :api

    get "/statuses", StatusController, :index
  end

  # `:api` and not `:browser`: these are fetched with a bearer token, never
  # navigated to, and a CSRF check on a token-authenticated fetch rejects every
  # write.
  scope "/dashboard", AgentsDemoWeb.Portal do
    pipe_through [:api, AgentsDemoWeb.Plugs.UserTokenAuth]

    get "/dashboards", DashboardController, :index
    post "/dashboards", DashboardController, :create
    patch "/dashboards/:uuid", DashboardController, :update
    delete "/dashboards/:uuid", DashboardController, :delete

    get "/widgets", WidgetController, :index
    post "/widgets", WidgetController, :create
    patch "/widgets/:uuid", WidgetController, :update
    delete "/widgets/:uuid", WidgetController, :delete
  end

  # Platform probes. Deliberately in no pipeline at all: they must not require a
  # session, must not be behind authentication, and must not content-negotiate,
  # because a probe that sends no Accept header would then be answered 406 and
  # read as an unhealthy node.
  #
  # `/health/ready` is the signal that keeps the load balancer from routing to a
  # node whose Sagents supervision tree has already stopped. See
  # `AgentsDemoWeb.HealthController`.
  scope "/health", AgentsDemoWeb do
    get "/", HealthController, :report
    get "/alive", HealthController, :alive
    get "/ready", HealthController, :ready
  end

  # Inbound WhatsApp. No pipeline: Meta sends neither a session nor a CSRF
  # token, and `Anu.Webhook.Plug` does its own work — the verify-token
  # challenge on GET, HMAC signature validation on POST — before handing the
  # parsed event to the handler.
  # /webhooks/whatsapp is handled in AgentsDemoWeb.Endpoint, ahead of
  # Plug.Parsers, because Meta signs the raw request body. See the comment
  # there.

  # Other scopes may use custom stacks.
  # scope "/api", AgentsDemoWeb do
  #   pipe_through :api
  # end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:agents_demo, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router
    import SagentsLiveDebugger.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: AgentsDemoWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview

      sagents_live_debugger("/debug/agents",
        coordinator: AgentsDemo.Agents.Coordinator,
        pubsub: AgentsDemo.PubSub,
        presence_module: AgentsDemoWeb.Presence
      )
    end
  end

  ## Authentication routes — part of the LiveView UI above, gated with it.

  if Application.compile_env(:agents_demo, :liveview_ui?, false) do
    scope "/", AgentsDemoWeb do
      pipe_through [:browser, :require_authenticated_user]

      live_session :require_authenticated_user,
        on_mount: [{AgentsDemoWeb.UserAuth, :require_authenticated}] do
        live "/users/settings", UserLive.Settings, :edit
        live "/users/settings/confirm-email/:token", UserLive.Settings, :confirm_email

        live "/chat", ChatLive
      end

      post "/users/update-password", UserSessionController, :update_password
    end

    scope "/", AgentsDemoWeb do
      pipe_through [:browser]

      live_session :current_user,
        on_mount: [{AgentsDemoWeb.UserAuth, :mount_current_scope}] do
        live "/users/register", UserLive.Registration, :new
        live "/users/log-in", UserLive.Login, :new
        live "/users/log-in/:token", UserLive.Confirmation, :new
      end

      post "/users/log-in", UserSessionController, :create
      delete "/users/log-out", UserSessionController, :delete
    end
  end
end
