defmodule ConnectixWeb.Router do
  use ConnectixWeb, :router

  import ConnectixWeb.UserAuth

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {ConnectixWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
    # Gates the LiveView UI below and the `/dev` tools further down — both are
    # mounted on `:browser`. Pass-through when `Connectix.Config.basic_auth/0`
    # is unconfigured (local dev/test); see `ConnectixWeb.Plugs.BasicAuth`.
    plug ConnectixWeb.Plugs.BasicAuth
    plug :fetch_current_scope_for_user
  end

  # Same Basic Auth gate as `:browser`, deliberately WITHOUT
  # `:protect_from_forgery`: it refuses any plain GET response whose
  # content-type is `text/javascript`/`application/javascript` from a
  # non-XHR request (`Plug.CSRFProtection`'s cross-origin-JS-inclusion guard,
  # aimed at responses with per-session secrets baked in) — exactly the shape
  # of a `<script type="module" src="...">` load, which the vendored voice
  # client's JS bundle is. That file is static with nothing session-specific
  # in it, so the guard has nothing to protect here and would 403 a real
  # browser, not just curl, if left on.
  pipeline :voice_assets do
    plug :accepts, ["html", "js"]
    plug ConnectixWeb.Plugs.BasicAuth
  end

  pipeline :api do
    plug :accepts, ["json"]
    plug OpenApiSpex.Plug.PutApiSpec, module: ConnectixWeb.ApiSpec
  end

  # Operator surfaces: Basic Auth, and deliberately NO `:accepts`.
  #
  # A scraper sends `Accept: */*` or nothing at all, and content negotiation
  # would answer it 406 — which reads as a broken endpoint rather than a
  # refused one. Same reason `/health` negotiates nothing.
  pipeline :admin do
    plug ConnectixWeb.Plugs.BasicAuth
  end

  # The spec and its UI are unauthenticated on purpose: they describe the API
  # rather than expose it, and a customer needs to read them before they have
  # a key.
  scope "/api" do
    pipe_through :api

    get "/openapi", OpenApiSpex.Plug.RenderSpec, []
    get "/docs", OpenApiSpex.Plug.SwaggerUI, path: "/api/openapi"
  end

  scope "/api", ConnectixWeb.Api do
    pipe_through [:api, ConnectixWeb.Plugs.ApiAuth]

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

  # The agent-chat LiveView UI, and THE only UI. It was the second of two while
  # a React portal served the origin; that bundle and the plug that served it
  # are gone, so this is not a fallback or dev-only scaffolding and is mounted
  # unconditionally rather than behind a compile-time flag.
  #
  # It was previously gated behind `Application.compile_env(:connectix,
  # :liveview_ui?, false)`, on/off only by editing `config/dev.exs` /
  # `config/test.exs` and recompiling — a `mix release` bakes `compile_env`
  # in, so that flag could never become an env-var toggle in production
  # anyway (`config/runtime.exs` runs after compilation). The one gate that
  # *is* checked at request time is `ConnectixWeb.Plugs.BasicAuth`, above in
  # `:browser` — that is what actually controls whether this is reachable.
  #
  # `[:browser]` and NOT `[:browser, :require_authenticated_user]`: there is
  # no login to require. Basic Auth is the only gate — everyone who clears it
  # shares the one operator identity `ConnectixWeb.UserAuth.resolve_scope/0`
  # resolves. That is also why this is the `:current_user` `live_session`,
  # not `:require_authenticated_user`: the distinction phx.gen.auth draws
  # between them (a route that merely wants `current_scope` vs one that
  # redirects an unauthenticated visitor) does not apply when Basic Auth
  # already decided that before the router saw the request.
  scope "/", ConnectixWeb do
    pipe_through :browser

    # A controller, not a LiveView route: it must send a raw 401 to make the
    # browser drop the cached Basic Auth credential. See LogoutController.
    get "/logout", LogoutController, :logout

    live_session :current_user, on_mount: [{ConnectixWeb.UserAuth, :mount_current_scope}] do
      live "/", WelcomeLive
      live "/chat", ChatLive
    end
  end

  # The Feline voice pipeline's vendored pipecat client. `/voice` resolves the
  # ws:// URL (carrying `conversation_id`, when linked from an open chat) and
  # redirects to `/voice/page`, the vendored HTML; `/voice/assets/*` is its
  # own bundled JS. See VoiceController, `Connectix.Voice.FelinePipeline`, and
  # the `:voice_assets` pipeline above for why this isn't `:browser`.
  scope "/voice", ConnectixWeb do
    pipe_through :voice_assets

    get "/", VoiceController, :index
    get "/page", VoiceController, :page
    get "/assets/:file", VoiceController, :asset
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
  # STILL UNAUTHENTICATED, and it was reconsidered rather than overlooked.
  #
  # It is a vocabulary — no user, no customer, nothing derived from the caller
  # — so a gate protects nothing. And token auth here routes it through the
  # verification that fails when the token was issued by a different platform,
  # which is the failure this route exists to avoid: the picker would empty in
  # exactly the case it was built to survive. `StatusControllerTest` asserts
  # the openness on purpose, so changing it stays a deliberate act.
  scope "/api", ConnectixWeb.Portal do
    pipe_through :api

    get "/statuses", StatusController, :index
  end

  # THE LOGIN, PERFORMED HERE rather than forwarded. Unauthenticated by
  # definition — it is the thing that produces the credential — and answered by
  # this app so a session does not depend on a mothership being reachable and
  # signing with the key this portal verifies against. `Plugs.EngineProxy`
  # knows to let this one through. See Portal.AuthController.
  scope "/auth", ConnectixWeb.Portal do
    pipe_through :api

    post "/user_login", AuthController, :user_login
  end

  # The last route the extension asked an upstream for. Served here so this
  # portal needs no engine at all — the file that lets an agent sign in is the
  # same one that describes them. Its own token, naming its own user.
  scope "/api", ConnectixWeb.Portal do
    pipe_through :api

    get "/users/:uuid", AuthController, :show_user
  end

  scope "/api", ConnectixWeb.Portal do
    pipe_through [:api, ConnectixWeb.Plugs.UserTokenAuth]

    # The frames THIS portal received off the broker. Served here, not forwarded:
    # no mothership has them. See Connectix.Events.
    get "/events", EventController, :index
    get "/events/timeline", EventController, :timeline
    get "/events/search", EventController, :search
    get "/events/stats", EventController, :stats
  end

  # `:api` and not `:browser`: these are fetched with a bearer token, never
  # navigated to, and a CSRF check on a token-authenticated fetch rejects every
  # write.
  scope "/dashboard", ConnectixWeb.Portal do
    pipe_through [:api, ConnectixWeb.Plugs.UserTokenAuth]

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
  # `ConnectixWeb.HealthController`.
  scope "/health", ConnectixWeb do
    get "/", HealthController, :report
    get "/alive", HealthController, :alive
    get "/ready", HealthController, :ready
  end

  # WAS WIDE OPEN, in no pipeline at all. It now publishes the host's disk,
  # CPU, load, memory and BEAM internals (see `Connectix.SystemMetrics`), so
  # anyone who found the URL learned how full the volume was and how loaded
  # the box was. Prometheus and friends all speak Basic Auth.
  scope "/", ConnectixWeb do
    pipe_through :admin

    get "/metrics", MetricsController, :index
  end

  # THE IONIC APP's deep links — `/app/calls`, `/app/login`, anything the
  # Angular router owns.
  #
  # The bundle is served by `Plug.Static` in the endpoint, ahead of this
  # router. What reaches here is every path under `/app` that is NOT a file:
  # `Plug.Static` finds nothing and falls through, and without this the router
  # raises `NoRouteError` on every reload and every shared link — the app works
  # until someone presses F5, which is the worst shape for a bug to have.
  #
  # BOTH routes, on purpose: the glob is what catches `/app/calls`, and the
  # bare `/` is `/app` itself, which `Plug.Static` does not answer (it serves
  # files, and has no notion of a directory index).
  #
  # In NO pipeline, for the same two reasons as `/health` and `/release`: it
  # must not require a portal session — this app signs in with its own token
  # from `/auth/user_login`, and `Plugs.BasicAuth` would prompt for a second,
  # unrelated credential no mobile build can supply — and it must not
  # content-negotiate, because a Capacitor webview sends whatever Accept header
  # it likes and a 406 there would read as a missing app.
  scope "/app", ConnectixWeb do
    get "/", AppController, :index
    get "/*path", AppController, :index
  end

  # WHAT THIS NODE SHIPS — the release page, and the assets on it.
  #
  # `/release`, not `/extension`: the Chrome extension is one ASSET of this
  # release, not a product of its own, and the version on the page is the
  # PORTAL's. A second client (mobile, desktop) becomes another asset on the
  # same page rather than another top-level path — which is the shape a GitHub
  # release has, and the reason that page is legible.
  #
  # In NO pipeline, for the same two reasons as `/health` above: it must not
  # require a portal session, and it must not content-negotiate — someone
  # fetching the zip sends whatever Accept header their browser feels like, and
  # a 406 there would read as a missing download. See
  # `ConnectixWeb.ReleaseController` for why it is unauthenticated.
  scope "/release", ConnectixWeb do
    get "/", ReleaseController, :index
    get "/info", ReleaseController, :info
    get "/download", ReleaseController, :download
  end

  # Inbound WhatsApp. No pipeline: Meta sends neither a session nor a CSRF
  # token, and `Anu.Webhook.Plug` does its own work — the verify-token
  # challenge on GET, HMAC signature validation on POST — before handing the
  # parsed event to the handler.
  # /webhooks/whatsapp is handled in ConnectixWeb.Endpoint, ahead of
  # Plug.Parsers, because Meta signs the raw request body. See the comment
  # there.

  # Other scopes may use custom stacks.
  # scope "/api", ConnectixWeb do
  #   pipe_through :api
  # end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:connectix, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router
    import SagentsLiveDebugger.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: ConnectixWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview

      sagents_live_debugger("/debug/agents",
        coordinator: Connectix.Agents.Coordinator,
        pubsub: Connectix.PubSub,
        presence_module: ConnectixWeb.Presence
      )
    end
  end
end
