defmodule Connectix.Realtime.EventPipeline do
  @moduledoc """
  The platform's events, consumed from NATS through Broadway.

      NATS subject ──> NatsProducer ──> processors ──> ScreenPop / Events
                       (buffer,          (decode JSON,
                        back-pressure)    route by subject)

  ## Why a pipeline and not another GenServer

  The measured cost of the event stream is decoding it, not storing it: the
  single upstream connection was the dominant CPU consumer on nimbus-connectix
  because ONE process decoded every frame of the firehose in series. Broadway runs one
  processor per scheduler, so the decode is parallel, and the producer only
  hands over what the processors ask for, so a burst queues in one bounded
  place instead of in a GenServer mailbox nobody can see.

  What comes out the other end is what the relay path delivered:
  `ScreenPop.handle_event/2` for anything that may pop a screen (the rule file
  gates it there, before it is stored) and `Realtime.UserStreams` for a
  signed-in user's own state and notifications. Every hand-off is a cast, so a
  processor never blocks on one.

  ## Routing

  By the subject, so an operator names a subject in `NATS_SUBJECTS` without
  also naming a handler:

  | subject | handler |
  |---|---|
  | `call_events`, `node:<uuid>` | `ScreenPop.handle_event/2` — the firehose, gated by the rule file and stored as `CallEvents` |
  | `state.<scope>.<id>` | `UserStreams.state_event/4` — stored, and for `scope == "user"` folded and delivered to that agent's browser |
  | `notifications:<uuid>` | `UserStreams.notification/3` — delivered verbatim to that user |
  | `dashboard_user:<uuid>` | `UserStreams.user_state/3` — folded and delivered to that user |
  | anything else | stored as `StateChannel`, and nothing more |

  Those are the platform's four streams, named as subjects. `node:<uuid>` is
  there because the node relays it onto `call_events` unchanged, so it is the
  same stream one hop earlier.

  A subject is split on both separators, never parsed: the node's stream names
  carry colons (`node:test1`, `notifications:<uuid>`) which NATS does not treat
  as separators, while state subjects use dots.

  The body is the JSON the relay delivered as `message` — the node's backend
  publishes the stream payload as the subject's body, verbatim. A body that is
  not a JSON object is counted (`result="undecodable"`) and dropped.

  ## This is the only source of events

  The relay is gone. `children/0` is empty unless BOTH `NATS_URL` and
  `NATS_SUBJECTS` are set, and an unconfigured pipeline means no screen pops,
  no state reaching a browser, and an empty store — which `/health` reports as
  `nats: down` rather than leaving as silence.

  Measured on the broker 2026-09-16: `node:test1` (colon form) carried the
  full frames — the same JSON the relay delivered as `message` — while
  `node.test1` beside it carried trimmed copies. Name the colon form.
  """

  use Broadway

  require Logger

  alias Broadway.Message
  alias Connectix.Config
  alias Connectix.Telemetry

  @doc """
  Child specs for the supervision tree — empty unless configured.

  NEVER IN TEST, whatever the environment says. `.env` is read by the test
  container too, so a suite run on a developer's machine would otherwise open a
  real subscription to whatever broker that file names and consume production
  events for the length of the run — silently, and with the pop evaluator
  live at the other end. A test that wants a pipeline starts its own by name.
  """
  def children do
    if enabled?() and not Config.test?(), do: [__MODULE__], else: []
  end

  @doc "True when a broker URL and at least one subject are configured."
  def enabled?, do: Config.nats_url() != nil and Config.nats_subjects() != []

  @doc """
  Options, all optional and mostly for tests:

    * `:name` — the pipeline's registered name;
    * `:producer` — a `{module, opts}` producer, default `NatsProducer` on
      `Config.nats_subjects/0`;
    * `:concurrency` — processors, default one per scheduler;
    * `:screen_pop` / `:events` / `:user_streams` — the servers handed decoded
      events.
  """
  def start_link(opts \\ []) do
    producer =
      Keyword.get_lazy(opts, :producer, fn ->
        {Connectix.Realtime.NatsProducer, subjects: Config.nats_subjects()}
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
  def handle_message(
        _processor,
        %Message{data: body, metadata: %{subject: subject}} = message,
        ctx
      ) do
    case Jason.decode(body) do
      {:ok, event} when is_map(event) ->
        route(subject, event, ctx)
        Message.put_data(message, event)

      _not_an_object ->
        Telemetry.nats_message(:undecodable)
        Message.failed(message, :undecodable)
    end
  end

  @impl Broadway
  def handle_failed(messages, _ctx) do
    # One line per batch. The counter carries the rate; the log carries the
    # subject, which is what says WHICH publisher is sending something that is
    # not JSON.
    subjects = messages |> Enum.map(& &1.metadata.subject) |> Enum.uniq()

    Logger.warning(
      "nats: #{length(messages)} undecodable message(s) on #{Enum.join(subjects, ", ")}"
    )

    messages
  end

  @doc false
  # Public so the routing decision can be asserted without a pipeline.
  def route(subject, event, ctx) do
    case String.split(subject, [".", ":"]) do
      # `call_events`, and the colon-form subject the node relays onto it
      # VERBATIM (`node_event_consumer.cr`: "a relay, not a pipeline"), so the
      # two carry the same payload and either is the CallEvents stream.
      ["call_events"] ->
        Connectix.Realtime.ScreenPop.handle_event(ctx.screen_pop, event)

      ["node" | _rest] ->
        Connectix.Realtime.ScreenPop.handle_event(ctx.screen_pop, event)

      ["state", scope, id] ->
        Connectix.Realtime.UserStreams.state_event(ctx.user_streams, scope, id, event)

      ["notifications", user_uuid] ->
        Connectix.Realtime.UserStreams.notification(ctx.user_streams, user_uuid, event)

      # The other half of what the per-user connection held. It carries state,
      # not notifications, and names its user in the subject — so unlike
      # `state.user.<id>` it needs no lookup to attribute.
      ["dashboard_user", user_uuid] ->
        Connectix.Realtime.UserStreams.user_state(ctx.user_streams, user_uuid, event)

      _unrecognised ->
        # Named in NATS_SUBJECTS, so somebody wanted it stored; there is just
        # nothing this app knows to do with it beyond keeping it.
        Connectix.Events.record(ctx.events, "StateChannel", event)
    end
  end
end
