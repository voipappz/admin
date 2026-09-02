defmodule AgentsDemo.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do
    children =
      [
        AgentsDemoWeb.Telemetry,
        {DNSCluster, query: Application.get_env(:agents_demo, :dns_cluster_query) || :ignore},
        {Phoenix.PubSub, name: AgentsDemo.PubSub}
        # Log shipping to InfluxDB, beside the console — never instead of it.
        # Empty unless VA_MONITOR_TOKEN is set. See `Logging.Influx`.
      ] ++
        AgentsDemo.Logging.Influx.children() ++
        [
          # Mnesia-backed stores — the app's only database.
          AgentsDemo.Portal.Store,
          AgentsDemo.Accounts.Store,
          AgentsDemo.Bots.Store,
          AgentsDemo.Conversations.Store,
          # HTTP pool for outbound channel traffic (`AgentsDemo.Channels`). Named
          # separately from Req's own pool so a stalled WhatsApp send cannot
          # exhaust the connections the agent's web_lookup tool needs.
          {Finch, name: AgentsDemo.Finch},
          AgentsDemoWeb.Presence,
          # Realtime token cache (ETS). Started before anything can authenticate.
          %{
            id: :realtime_token_cache,
            start: {Task, :start_link, [&AgentsDemo.Realtime.TokenAuth.init_cache/0]},
            restart: :transient
          }
          # The ASK half. Everything this app needs FROM the mothership goes over
          # NATS request/reply; nothing goes over HTTP. See `Realtime.Bus`.
        ] ++
        AgentsDemo.Realtime.Bus.children() ++
        [
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
          {Registry, keys: :unique, name: AgentsDemo.Realtime.CableRegistry},
          {DynamicSupervisor, strategy: :one_for_one, name: AgentsDemo.Realtime.CableSupervisor}
        ] ++
        AgentsDemo.Realtime.ApiProxy.children() ++
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
          AgentsDemoWeb.Endpoint,
          # Last, so OTP stops it FIRST: its terminate/2 flips readiness to false
          # and waits, while the Endpoint above is still up to report it. Any
          # earlier position and the wait happens behind a stopped listener, where
          # the load balancer cannot observe it.
          {AgentsDemo.Drain, delay: drain_delay()}
        ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: AgentsDemo.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Zero in dev and test. A drain delay that fires on every Ctrl-C is a delay
  # someone disables in week two, and then it is not there in production either.
  defp drain_delay do
    Application.get_env(:agents_demo, :drain_delay_ms, 0)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    AgentsDemoWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
