defmodule Connectix.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do
    if is_nil(Connectix.Config.basic_auth()) do
      Logger.warning(
        "PORTAL_UI_USER/PORTAL_UI_PASS are unset — the agent-chat LiveView UI " <>
          "(/, /chat) is reachable with no Basic Auth gate."
      )
    end

    children =
      [
        ConnectixWeb.Telemetry,
        {DNSCluster, query: Application.get_env(:connectix, :dns_cluster_query) || :ignore},
        {Phoenix.PubSub, name: Connectix.PubSub}
        # Log shipping to InfluxDB, beside the console — never instead of it.
        # Empty unless VA_MONITOR_TOKEN is set. See `Logging.Influx`.
      ] ++
        Connectix.Logging.Influx.children() ++
        [
          # Every event received off the cable, appended to DuckDB. Starts even
          # when the file cannot be opened — it then stores nothing rather than
          # taking the realtime path down. See Connectix.Events.
          Connectix.Events,
          # Mnesia-backed stores.
          Connectix.Portal.Store,
          Connectix.Accounts.Store,
          Connectix.Bots.Store,
          Connectix.Conversations.Store,
          # HTTP pool for outbound channel traffic (`Connectix.Channels`). Named
          # separately from Req's own pool so a stalled WhatsApp send cannot
          # exhaust the connections the agent's web_lookup tool needs.
          {Finch, name: Connectix.Finch},
          ConnectixWeb.Presence,
          # Realtime token cache (ETS). Started before anything can authenticate.
          %{
            id: :realtime_token_cache,
            start: {Task, :start_link, [&Connectix.Realtime.TokenAuth.init_cache/0]},
            restart: :transient
          },
          # Cable (va-crystal) held server-side, one connection per signed-in user.
          # This is the LISTEN half: events arrive here, and cable's own semantics
          # come with them — a confirmed subscription is what stamps
          # `user:<uuid>:logged_in_at`. Inert without CABLE_URL.
          #
          # `Realtime.ApiProxy` below is a THIRD connection on the same cable and
          # not a duplicate of these: one for the whole server, carrying `/auth`,
          # `/api/` and `/tasks/` as request/reply so credentials reach the API
          # over cable rather than over HTTP. Started after the registry so the
          # listen path is up first — a login is worth nothing if the events that
          # follow it have nowhere to arrive.
          # Browser-socket bookkeeping that outlives the sockets (open rows and
          # a close log), so "what happened to this agent's socket" has an
          # answer after the fact. Read by the TUI over RPC.
          Connectix.Realtime.Sessions,
          {Registry, keys: :unique, name: Connectix.Realtime.CableRegistry},
          {Registry, keys: :duplicate, name: Connectix.Realtime.SessionRegistry},
          {DynamicSupervisor, strategy: :one_for_one, name: Connectix.Realtime.CableSupervisor},
          Connectix.Realtime.ScreenPop,
          # Browser<->SIP WebRTC bridge (Connectix.WebRtc.*, ported from
          # connectix.io/phone): keyed registry so a Membrane pipeline leg
          # (leg B, the SIP side) can find its browser peer (leg A) by the
          # same key `Connectix.WebRtc.Peer.start_link/1` registered under.
          {Registry, keys: :unique, name: Connectix.WebRtc.Registry},
          # The shared SIP UDP socket, then the one UA that dials through it.
          # Started even when CONNECTIX_SIP_* is unconfigured — `SipBridge`
          # reads credentials at register/dial time, not at boot, the same
          # way `ConnectixWeb.Plugs.BasicAuth` degrades to pass-through.
          Connectix.WebRtc.Transport,
          Connectix.WebRtc.SipBridge
        ] ++
        Connectix.Realtime.ApiProxy.children() ++
        Connectix.Heartbeat.children() ++
        [
          # Sagents infrastructure (registry + dynamic supervisors).
          #
          # After the stores/PubSub so agents shut down before them (reverse order),
          # allowing terminate/2 to persist state and broadcast shutdown events.
          #
          # Before the Endpoint for the same reason read the other direction: OTP
          # stops children in reverse, so the Endpoint stops accepting requests
          # first and the registry is still alive to serve whatever is in flight.
          # Listed after the Endpoint instead, every request for the rest of the
          # drain would land on a dead registry.
          Sagents.Supervisor,
          # Serves requests. After Sagents.Supervisor so OTP stops the listener
          # first and the registry is still alive for whatever is in flight.
          ConnectixWeb.Endpoint,
          # Last, so OTP stops it FIRST: its terminate/2 flips readiness to false
          # and waits, while the Endpoint above is still up to report it. Any
          # earlier position and the wait happens behind a stopped listener, where
          # the load balancer cannot observe it.
          {Connectix.Drain, delay: drain_delay()}
        ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Connectix.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Zero in dev and test. A drain delay that fires on every Ctrl-C is a delay
  # someone disables in week two, and then it is not there in production either.
  defp drain_delay do
    Application.get_env(:connectix, :drain_delay_ms, 0)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    ConnectixWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
