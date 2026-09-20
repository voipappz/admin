defmodule Connectix.Realtime.Deadman do
  @moduledoc """
  Alarms when the broker subscription is up and nothing is arriving on it.

  **This is the failure that reports itself as healthy.** Every other check in
  this app asks whether a thing is configured or connected, and all of them
  pass while the switch is silent: `NatsProducer.status/0` says
  `{:subscribed, …}` because the subscription exists, `/health` is green, the
  socket is open, the process is alive. The first person to notice is an agent
  saying their screen stopped popping, some unknown number of calls later.

  It is not hypothetical. A connection can die without saying so — a NAT or a
  load balancer drops an established socket, there is no close frame and no
  error, and the process holds a dead socket until something restarts it. The
  producer re-subscribes when the connection process dies; when it does not
  die, nothing notices at all.

  So the question this asks is the only one that cannot be answered by looking
  at configuration: **has anything actually arrived recently?**

  ## Silence is not the same as being unsubscribed

  `NatsProducer.silent_ms/0` returns `nil` when there is no subscription, and
  this treats that as "not my alarm". The subscription check already reports
  it, and an outage that fires two alarms reads as two faults.

  ## One line per episode

  A tripped deadman logs ONCE and stays quiet until events return, at which
  point it logs the recovery with how long the gap was. The alternative — a
  line per tick — turns a 40-minute outage into 80 identical lines that bury
  the one that matters. Same reasoning as the producer's overflow warning.

  ## Where the alarm goes

  Three places, and they are for different readers:

    * `Logger.error/1` — for whoever is reading logs, and it is the only one
      that works with no external service configured at all;
    * `Connectix.Heartbeat` — pushes the reason to Uptime Kuma, which is what
      actually wakes somebody up;
    * `/health` — the numbers, so a monitor can alert on a gap shorter than
      the one that trips this.

  `PopRule.nats_deadman_ms/0` is the threshold and `deadman: off` in the rule
  file disables it.
  """

  use GenServer

  require Logger

  alias Connectix.Realtime.EventPipeline
  alias Connectix.Realtime.NatsProducer
  alias Connectix.Realtime.PopRule

  # Frequent enough that the alarm is timely, rare enough to be free. The
  # check is two `:persistent_term` reads and an `:atomics.get`.
  @tick_ms 30_000

  @doc false
  def children do
    if EventPipeline.enabled?() and not Connectix.Config.test?() and enabled?() do
      [__MODULE__]
    else
      []
    end
  end

  @doc "Whether a threshold is set at all. `deadman: off` turns this off."
  @spec enabled?() :: boolean()
  def enabled?, do: threshold_ms() > 0

  @doc "The configured silence the portal tolerates, in milliseconds."
  @spec threshold_ms() :: non_neg_integer()
  def threshold_ms, do: PopRule.nats_deadman_ms()

  @doc """
  `:ok`, or `{:alarm, message}` naming how long it has been and what that means.

  The message is the whole point: it is pushed to Uptime Kuma verbatim and
  logged verbatim, so it has to read as a complete sentence to somebody who
  was not looking at the portal when it fired.
  """
  @spec check() :: :ok | {:alarm, String.t()}
  def check, do: evaluate(NatsProducer.silent_ms(), threshold_ms())

  @doc false
  # Pure, so the decision can be tested without a broker, a clock or a process.
  @spec evaluate(non_neg_integer() | nil, non_neg_integer()) :: :ok | {:alarm, String.t()}
  def evaluate(_silent, threshold) when threshold <= 0, do: :ok
  def evaluate(nil, _threshold), do: :ok
  def evaluate(silent, threshold) when silent < threshold, do: :ok

  def evaluate(silent, threshold) do
    {:alarm,
     "no events for #{humanize(silent)} — the broker subscription is up and " <>
       "nothing is arriving on #{subjects()} (deadman #{humanize(threshold)}). " <>
       "Screen pops are not firing."}
  end

  @doc """
  A duration a person can read: `45s`, `16m`, `1h 4m`.

  Rounded down and never zero-padded, because it is read in a log line and in
  a phone notification, not parsed.
  """
  @spec humanize(non_neg_integer()) :: String.t()
  def humanize(ms) when ms < 60_000, do: "#{div(ms, 1000)}s"
  def humanize(ms) when ms < 3_600_000, do: "#{div(ms, 60_000)}m"

  def humanize(ms) do
    hours = div(ms, 3_600_000)
    minutes = ms |> rem(3_600_000) |> div(60_000)
    if minutes == 0, do: "#{hours}h", else: "#{hours}h #{minutes}m"
  end

  defp subjects do
    case EventPipeline.subjects() do
      [] -> "any subject"
      named -> Enum.join(named, ", ")
    end
  end

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval_ms, @tick_ms)
    Process.send_after(self(), :tick, interval)
    {:ok, %{interval: interval, alarmed?: false}}
  end

  @impl true
  def handle_info(:tick, state) do
    Process.send_after(self(), :tick, state.interval)
    {:noreply, announce(state, check())}
  end

  def handle_info(_message, state), do: {:noreply, state}

  # ONE LINE PER EPISODE. The flag is the whole mechanism: it flips on the
  # transition and nowhere else, so a long outage is two lines — when it
  # started and when it ended — rather than one every tick.
  defp announce(%{alarmed?: false} = state, {:alarm, message}) do
    Logger.error("deadman: " <> message)
    %{state | alarmed?: true}
  end

  defp announce(%{alarmed?: true} = state, :ok) do
    Logger.info("deadman: events are arriving again")
    %{state | alarmed?: false}
  end

  defp announce(state, _unchanged), do: state
end
