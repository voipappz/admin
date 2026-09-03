defmodule AgentsDemoWeb.HealthController do
  @moduledoc """
  Liveness and readiness probes for the platform running this app.

  The two are answered by different questions and must not be wired to the
  same source.

  `alive/2` asks whether the BEAM is up. It never consults Sagents or the drain
  flag, because the correct response to a failed liveness probe is a restart,
  and a node that is merely draining must not be restarted.

  `ready/2` asks whether this node should receive traffic, and reads **two**
  sources:

    * `AgentsDemo.Drain.draining?/0` flips at the very start of shutdown, which
      is when the load balancer needs to know.
    * `Sagents.ready?/0` covers every other way the tree can be down: still
      booting, crashed, restarting.

  Both are needed. `Sagents.ready?/0` alone first reports 503 when
  `Sagents.Supervisor` stops, and by then the load balancer has been routing
  here for the whole shutdown: the node keeps accepting connections for the rest
  of the platform's grace period while every agent lookup on it fails. An
  endpoint reading only that answers 200 for the entire drain and then starts
  failing requests at the same instant it starts reporting unhealthy, which is
  worse than nothing because it looks finished.

  See `AgentsDemo.Drain` and the Sagents `docs/deployment.md` guide for the full
  shutdown sequence.
  """
  use AgentsDemoWeb, :controller

  alias AgentsDemo.Drain

  @doc """
  Liveness. 200 for as long as the BEAM answers at all.
  """
  def alive(conn, _params) do
    conn
    |> put_resp_content_type("text/plain")
    |> send_resp(200, "ok")
  end

  @doc """
  Readiness. 503 from the start of shutdown, and whenever this node cannot host
  or route agent sessions.

  503 rather than 500: the request is fine, this node just is not the place to
  serve it. That is the status clients and load balancers already know how to
  retry.
  """
  def ready(conn, _params) do
    {status, body} =
      if Drain.draining?() or not Sagents.ready?() do
        {503, "draining"}
      else
        {200, "ok"}
      end

    conn
    |> put_resp_content_type("text/plain")
    |> send_resp(status, body)
  end

  @doc """
  The dependency report the SPA's status dot polls.

  Configuration, not probes: it says which transports this deployment has been
  given, which is the question the dot actually answers ("is anything missing?")
  and the one that can be answered without a round trip on a 15-second poll.
  Whether a configured transport is currently passing traffic is `ready/2`'s
  job.

  Unauthenticated, like the probes above and like the report it replaces — the
  dot renders before a user is logged in.
  """
  def report(conn, _params) do
    checks = %{
      cable:
        check(
          AgentsDemo.Realtime.CableClient.enabled?(),
          "CABLE_URL is not set — no realtime events"
        ),
      # The exception to "configuration, not probes", and deliberately so.
      # Configured-but-not-confirmed is this relay's actual failure mode: an
      # older node accepts the connection and never answers the subscribe, and
      # every login then works over the HTTP fallback with nothing visible to
      # say so. A check that only reported CABLE_URL would be green for exactly
      # the state worth seeing.
      api_relay:
        check(
          not AgentsDemo.Realtime.ApiProxy.enabled?() or AgentsDemo.Realtime.ApiProxy.ready?(),
          "the node has not confirmed the ApiProxy channel — /auth is falling back to HTTP"
        ),
      engine: check(engine?(), "ENGINE_URL is not set — /auth and /api are not forwarded")
    }

    down? = Enum.any?(checks, fn {_name, check} -> check.status == "down" end)

    json(conn, %{
      status: if(down?, do: "degraded", else: "ok"),
      ready: not down?,
      checks: checks
    })
  end

  defp check(true, _detail), do: %{status: "ok"}
  defp check(false, detail), do: %{status: "down", detail: detail}

  defp engine? do
    (System.get_env("ENGINE_URL") || System.get_env("MOTHERSHIP_URL") || "") != ""
  end
end
