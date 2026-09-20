defmodule ConnectixWeb.HealthController do
  @moduledoc """
  Liveness and readiness probes for the platform running this app.

  The two are answered by different questions and must not be wired to the
  same source.

  `alive/2` asks whether the BEAM is up. It never consults Sagents or the drain
  flag, because the correct response to a failed liveness probe is a restart,
  and a node that is merely draining must not be restarted.

  `ready/2` asks whether this node should receive traffic, and reads **two**
  sources:

    * `Connectix.Drain.draining?/0` flips at the very start of shutdown, which
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

  See `Connectix.Drain` and the Sagents `docs/deployment.md` guide for the full
  shutdown sequence.
  """
  use ConnectixWeb, :controller

  alias Connectix.Drain

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
      # THE ONLY SOURCE OF EVENTS. Every user's state, every notification and
      # the whole call firehose arrive on one broker subscription, so this
      # being down means no screen pops, nothing reaching a browser and an
      # empty store — and nothing else fails, which is why it has to be
      # reported rather than left as silence.
      #
      # Configured-but-not-subscribed is the real failure mode: a portal
      # pointed at a broker it cannot reach looks exactly like a quiet switch.
      nats: nats_check(),
      engine: check(engine?(), "ENGINE_URL is not set — /auth and /api are not forwarded"),

      # THE ONE THAT ENDS A DEPLOYMENT. The event store and Mnesia share this
      # volume; a live switch writes ~556MB of raw JSON a day, and when it
      # fills, the conversation store goes with the events. nimbus-connectix
      # sat at 71% used while this endpoint reported nothing at all.
      #
      # Reported here rather than in `ready/2` on purpose: that is the deploy
      # gate and the load-balancer signal, and a node low on disk can still
      # serve traffic. Failing it would take the site down AND block the
      # deploy that might fix it.
      disk: disk_check(),

      # An event store that cannot open its file records nothing, silently. It
      # happens on every deploy — kamal overlaps the containers and DuckDB is
      # single-writer — and it now retries, so this being down means the retry
      # is not winning and someone should look.
      events:
        check(Connectix.Events.open?(), "the event store is not open — events are not recorded"),

      # WHICH RULE THIS PORTAL IS ACTUALLY RUNNING. A container with no
      # customer rule mounted is a broken deployment, not a defaulted one: no
      # agents, so nobody can sign in, and no subjects, so nothing arrives.
      # Without this the two are indistinguishable from outside — it looks
      # exactly like a switch that has gone quiet.
      screen_pop: screen_pop_check()
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

  # TWO QUESTIONS, ONE CHECK, and the second is the one nothing else asks:
  # not "is the subscription up" but "is anything arriving on it". A dead feed
  # answers yes to the first — the socket is open and the producer says
  # `{:subscribed, …}` — which is exactly how a silent switch passed every
  # probe this app had.
  #
  # The numbers travel with the verdict for the same reason the disk check's
  # do: a monitor wants to alert on a gap SHORTER than the one that trips the
  # deadman, and it cannot do that with a bare ok/down.
  defp nats_check do
    if Connectix.Realtime.EventPipeline.enabled?() do
      status = Connectix.Realtime.NatsProducer.status()

      base = %{
        subjects: Connectix.Realtime.EventPipeline.subjects(),
        last_event_at: iso8601(Connectix.Realtime.NatsProducer.last_message_at()),
        silent_ms: Connectix.Realtime.NatsProducer.silent_ms(),
        deadman_ms: Connectix.Realtime.Deadman.threshold_ms()
      }

      # Asked ONCE and matched on. Calling it in the guard and again in the
      # body reads the clock twice, so a gap that crosses the threshold between
      # the two returns "down" with no detail to say why.
      case {status, Connectix.Realtime.Deadman.check()} do
        {{:subscribed, _subjects}, :ok} ->
          Map.put(base, :status, "ok")

        {{:subscribed, _subjects}, {:alarm, detail}} ->
          Map.merge(base, %{status: "down", detail: detail})

        {unsubscribed, _deadman} ->
          Map.merge(base, %{
            status: "down",
            detail:
              "the broker subscription is not up — no events, no screen pops " <>
                "(producer: #{inspect(unsubscribed)})"
          })
      end
    else
      check(false, "NATS_URL or NATS_SUBJECTS is not set — no events, no screen pops")
    end
  end

  defp screen_pop_check do
    source = Connectix.Realtime.PopRule.source()

    base = %{
      customer: source.customer,
      rule: source.customer_path || source.shared,
      agents: map_size(Connectix.Realtime.PopRule.agents()),
      triggers: Connectix.Realtime.PopRule.triggers(),
      record_url_set: Connectix.Realtime.PopRule.record_url() != nil
    }

    cond do
      not source.customer_loaded? ->
        Map.merge(base, %{
          status: "down",
          detail:
            "no customer rule at #{source.customer_path} — no agents, no subjects, " <>
              "nobody can sign in. Mount this site's file there."
        })

      base.agents == 0 ->
        Map.merge(base, %{
          status: "down",
          detail:
            "no agents are configured — /auth/user_login refuses everyone. Mount " <>
              "this site's rule at #{source.customer_path}."
        })

      not base.record_url_set ->
        Map.merge(base, %{
          status: "down",
          detail: "no profile.record_url — matched calls are found and then not popped"
        })

      true ->
        Map.put(base, :status, "ok")
    end
  end

  defp iso8601(nil), do: nil

  defp iso8601(epoch_ms) do
    epoch_ms |> DateTime.from_unix!(:millisecond) |> DateTime.to_iso8601()
  end

  # Numbers as well as a verdict: an external monitor wants to alert BEFORE
  # the threshold ("free_percent < 25"), and a bare ok/down cannot say that.
  defp disk_check do
    case Connectix.Disk.usage() do
      nil ->
        # Unmeasurable is not full. Say so rather than paging someone.
        %{status: "ok", detail: "disk usage could not be read"}

      %{mount: mount, free_percent: free, free_bytes: bytes, total_bytes: total} = usage ->
        floor = Connectix.Config.disk_min_free_percent()

        base = %{
          mount: mount,
          free_percent: free,
          used_percent: usage.used_percent,
          free_bytes: bytes,
          total_bytes: total,
          min_free_percent: floor
        }

        if free >= floor do
          Map.put(base, :status, "ok")
        else
          base
          |> Map.put(:status, "down")
          |> Map.put(
            :detail,
            "#{free}% free on #{mount} (floor #{floor}%) — the event store and Mnesia share it"
          )
        end
    end
  end

  defp engine? do
    (System.get_env("ENGINE_URL") || System.get_env("MOTHERSHIP_URL") || "") != ""
  end
end
