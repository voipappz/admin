defmodule Connectix.Realtime.EventPipeline do
  @moduledoc """
  The switch's events, consumed over the FreeSWITCH Event Socket through Broadway.

      FreeSWITCH (ESL) ──> EslProducer ──> processors ──> ScreenPop / Events
                           (buffer,         (headers → frame,
                            back-pressure)   route)

  ## Why a pipeline and not another GenServer

  The measured cost of the event stream is transforming it, not storing it:
  one process handling every frame in series was the dominant CPU consumer on
  nimbus-connectix. Broadway runs one processor per scheduler, so the
  translation is parallel, and the producer only hands over what the
  processors ask for, so a burst queues in one bounded place instead of a
  mailbox nobody can see.

  ## Routing

  Every event becomes a node-shaped frame (`FreeSwitch.Frame.from_esl/1`) and
  goes to `ScreenPop.handle_event/2`, which gates it by the rule file's
  `triggers:` before storing it as `CallEvents` — exactly where the relayed
  firehose used to land. There is nothing to route BY any more: the producer
  subscribes only to the events the rule file names, so everything that
  arrives was asked for.

  ## Which events, and where that is written

  `priv/pocketflow/screen_pop.yaml` (and the customer's overlay) carries the
  whole event configuration under `freeswitch:` — host, port, password,
  events, deadman — beside the `triggers:` that decide what pops. One file for
  "where events come from", "which ones arrive" and "what we do with them".
  `ESL_URL` remains the fallback for a deployment that has not adopted the file.

  ## This is the only source of events

  `children/0` is empty unless a switch is configured, and an unconfigured
  pipeline means no screen pops and an empty store — which `/health` reports
  as `freeswitch: down` rather than leaving as silence.
  """

  use Broadway

  require Logger

  alias Broadway.Message
  alias Connectix.Config
  alias Connectix.Realtime.FreeSwitch
  alias Connectix.Telemetry

  @doc """
  Child specs for the supervision tree — empty unless configured.

  NEVER IN TEST, whatever the environment says: `.env` is read by the test
  container too, and a suite run would otherwise open a real connection to a
  production switch. A test that wants a pipeline starts its own by name.
  """
  def children do
    if enabled?() and not Config.test?(), do: [__MODULE__], else: []
  end

  @doc "True when a switch is named in the rule file or in `ESL_URL`."
  def enabled?, do: FreeSwitch.configured?()

  @doc "The ESL event names the producer subscribes to, or `[]` when unconfigured."
  @spec events() :: [String.t()]
  def events do
    case FreeSwitch.settings() do
      nil -> []
      %{events: events} -> events
    end
  end

  @doc """
  Options, all optional and mostly for tests:

    * `:name` — the pipeline's registered name;
    * `:producer` — a `{module, opts}` producer, default `EslProducer` on
      `FreeSwitch.settings/0`;
    * `:concurrency` — processors, default one per scheduler;
    * `:screen_pop` / `:events` / `:user_streams` — the servers handed frames.
  """
  def start_link(opts \\ []) do
    producer =
      Keyword.get_lazy(opts, :producer, fn ->
        {Connectix.Realtime.EslProducer, settings: FreeSwitch.settings()}
      end)

    Broadway.start_link(__MODULE__,
      name: Keyword.get(opts, :name, __MODULE__),
      producer: [module: producer, concurrency: 1],
      processors: [
        default: [
          concurrency: Keyword.get(opts, :concurrency, System.schedulers_online()),
          # Small, so a burst is spread across processors rather than handed
          # to the first one that asked.
          max_demand: 10
        ]
      ],
      context: %{
        screen_pop: Keyword.get(opts, :screen_pop, Connectix.Realtime.ScreenPop),
        events: Keyword.get(opts, :events, Connectix.Events),
        user_streams: Keyword.get(opts, :user_streams, Connectix.Realtime.UserStreams)
      }
    )
  end

  @impl Broadway
  def handle_message(_processor, %Message{data: headers} = message, ctx) when is_map(headers) do
    frame = FreeSwitch.Frame.from_esl(headers)
    route(frame, ctx)
    Message.put_data(message, frame)
  end

  def handle_message(_processor, message, _ctx) do
    Telemetry.esl_event(:undecodable)
    Message.failed(message, :undecodable)
  end

  @impl Broadway
  def handle_failed(messages, _ctx) do
    Logger.warning("freeswitch: #{length(messages)} event(s) arrived without headers and were dropped")
    messages
  end

  @doc false
  # Public so the hand-off can be asserted without a pipeline. Every frame goes
  # to the pop evaluator, which stores it and decides whether it pops.
  def route(frame, ctx) when is_map(frame) do
    Connectix.Realtime.ScreenPop.handle_event(ctx.screen_pop, frame)
  end
end
