defmodule Connectix.Heartbeat do
  @moduledoc """
  Pushes this node's health to an Uptime Kuma **push** monitor.

  A push monitor is the right shape for a portal behind a proxy: Kuma does not
  have to reach in, and a node that has stopped — crashed, wedged, cut off,
  never booted — stops pushing and Kuma notices on its own timer. The failure
  we hit today is exactly the one a poll would have missed: the process was
  alive and answering HTTP while its event subscription was dead.

  It reports WHY, not merely whether. Kuma's push endpoint takes `status` and
  `msg`, so a node with a full disk arrives as
  `status=down&msg=disk: 3% free on /data …` rather than as a timeout someone
  has to go and investigate.

  In-app rather than a container healthcheck running `curl`:

    * the release image has no `curl`, and adding one to run a health check is
      a strange reason to grow the image;
    * a healthcheck sees an HTTP status, so it can only report up/down, while
      this reports the failing check by name;
    * it uses `Req`, which is already a dependency and already the way this
      app makes HTTP requests.

  Inert unless `UPTIME_KUMA_PUSH_URL` is set, so nothing changes for a
  deployment that has no monitor.
  """

  use GenServer

  require Logger

  @doc false
  def children do
    if enabled?(), do: [__MODULE__], else: []
  end

  def enabled?, do: is_binary(url()) and url() != ""

  defp url, do: Connectix.Config.uptime_push_url()

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval_ms, Connectix.Config.uptime_push_interval_ms())
    # Push immediately: a node that has just booted after a crash should clear
    # the alarm now, not one interval from now.
    send(self(), :push)
    {:ok, %{interval: interval}}
  end

  @impl true
  def handle_info(:push, state) do
    Process.send_after(self(), :push, state.interval)
    push(report())
    {:noreply, state}
  end

  def handle_info(_message, state), do: {:noreply, state}

  @doc """
  The health this node would report right now: `{:up, message}` or
  `{:down, message}`.

  Deliberately the same questions `/health` answers, so the push and the
  endpoint cannot disagree about whether this node is well.
  """
  @spec report() :: {:up | :down, String.t()}
  def report do
    failures =
      []
      |> check(
        Connectix.Realtime.EventPipeline.enabled?() and
          match?({:subscribed, _}, Connectix.Realtime.NatsProducer.status()),
        "broker subscription down — no events"
      )
      # SUBSCRIBED AND SILENT, which the check above cannot see: it asks
      # whether the subscription exists, and a dead feed has one. This is the
      # failure that reports itself as healthy, so it is the one most worth
      # pushing somewhere that rings.
      |> alarm(Connectix.Realtime.Deadman.check())
      |> check(Connectix.Events.open?(), "event store not open — events are not recorded")
      |> check(Connectix.Disk.ok?(), disk_detail())
      |> Enum.reverse()

    case failures do
      [] -> {:up, ok_message()}
      reasons -> {:down, Enum.join(reasons, "; ")}
    end
  end

  defp check(failures, true, _detail), do: failures
  defp check(failures, false, detail), do: [detail | failures]

  # Same shape as `check/3`, for a check that carries its own message rather
  # than being a boolean with one written beside it.
  defp alarm(failures, :ok), do: failures
  defp alarm(failures, {:alarm, detail}), do: [detail | failures]

  defp disk_detail do
    case Connectix.Disk.usage() do
      nil -> "disk usage unreadable"
      %{free_percent: p, mount: m} -> "disk: #{p}% free on #{m}"
    end
  end

  # Kuma shows `msg` on the monitor, so put the number worth glancing at there
  # even when everything is fine.
  defp ok_message do
    case Connectix.Disk.usage() do
      nil -> "ok"
      %{free_percent: p} -> "ok, disk #{p}% free"
    end
  end

  defp push({status, message}) do
    query = URI.encode_query(%{"status" => to_string(status), "msg" => message})

    case Req.get(url() <> "?" <> query, receive_timeout: 10_000, retry: false) do
      {:ok, %{status: code}} when code in 200..299 ->
        :ok

      {:ok, %{status: code}} ->
        Logger.warning("heartbeat: uptime kuma answered #{code}")

      {:error, reason} ->
        # The monitor being unreachable is not this node's problem to escalate;
        # Kuma will alarm on the missing push, which is the whole point.
        Logger.warning("heartbeat: could not reach uptime kuma (#{inspect(reason)})")
    end
  end
end
