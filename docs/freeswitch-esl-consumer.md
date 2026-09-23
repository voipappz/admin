# The FreeSWITCH consumer: ESL replaces NATS as the event source

Status: **implemented and connected to the live switch**, 2026-09-23. Branch
`esl-consumer`, worktree `.claude/worktrees/esl-consumer`, cut from
`connectix-v1` at `874f0078`. Phases 0–2 below are done. Confirmed against
`194.36.89.216:8021` (FreeSWITCH 1.10.7, password `ClueCon`): the app's own
supervision tree opened the Event Socket, authenticated, subscribed to
`HEARTBEAT CUSTOM callcenter::info`, and `HEARTBEAT` arrived on a clean
20-second cadence with the deadman clock advancing and `silent_ms` resetting
each cycle. **Still unverified: a real `bridge-agent-start` producing a pop** —
that needs an actual queue call on the switch, and the frame `id` should then
be compared against what the node produced for the same call. Two things the
implementation learned that the plan below did not know:

- **switchx is vendored** at `connectix/vendor/switchx` (MIT, 1.0.1 verbatim
  bar its deps). From hex it pulls the `uuid` package, but this tree already
  uses `elixir_uuid` (via sagents/langchain); both ship the module `UUID`
  under different OTP apps, so a clean build leaves one without an app file and
  `mix compile` fails with "could not find an app file at .../uuid.app". A
  seeded dev-container deps volume hid this — only a clean CI build (`make ci
  JOB=portal`) surfaced it. No `override`/`hex:` trick resolves it, since the
  two dep names still map to two apps. The vendored copy repoints that one dep
  at `elixir_uuid` (same `UUID` module, used only in call paths we never take)
  and widens its telemetry pin, which also removed a `telemetry` override.
- **The hex release of switchx (1.0.1) has no `Inbound.start/1`** (that is on
  master), so `FreeSwitch.connect/1` opens the TCP socket itself and hands it
  to `SwitchX.Connection.start_link/3` — the same three steps the library
  takes — which is also what gives the producer the PORT to monitor.
- **The library swallows `tcp_closed`** (a catch-all `handle_event(:info, …)`),
  so a socket the switch closes is invisible to its owner. The producer
  monitors the socket port as well as the connection process;
  `esl_server_test.exs` drives a real close through switchx to pin it.

Agent state (`agent-state-change` → `UserStreams`) is NOT wired: every frame
goes to `ScreenPop` only. `UserStreams` still exists for the socket
registration and is fed by nothing until that is done deliberately.

CI (`make ci JOB=portal`, nektos/act) is green: `mix compile
--warnings-as-errors` clean and 842 tests, 0 failures.

## The decision

The Broadway pipeline keeps its shape and swaps its producer: the portal opens
an **inbound Event Socket (ESL) connection to FreeSWITCH itself** and consumes
the switch's events first-hand, instead of subscribing to the copies the
va-crystal node relays onto NATS. The NATS consumer is **replaced, not joined**:
`Realtime.Nats` and `Realtime.NatsProducer` go, the `nats:` block in the rule
file becomes a `freeswitch:` block, and the local NATS container leaves
`docker-compose.yml`.

Same pattern, one module renamed for the other:

| today (NATS) | after (ESL) | what it is |
|---|---|---|
| `Realtime.Nats` | `Realtime.FreeSwitch` | owns "where the switch is" (settings from the rule file / env) and the child spec |
| `Realtime.NatsProducer` | `Realtime.EslProducer` | the Broadway producer: buffer, back-pressure, reconnect, `status/0`, deadman clock |
| `Realtime.EventPipeline` | unchanged name | decode, route, hand off to `ScreenPop` / `UserStreams` / `Events` |
| — | `Realtime.FreeSwitch.Frame` | **new, pure**: turns one ESL event into the frame shape every consumer already reads |
| `nats:` in `screen_pop.yaml` | `freeswitch:` | host, port, password, event names, deadman |
| `NATS_URL` / `NATS_SUBJECTS` | `ESL_URL` | fallback for a deployment without the file |

The ESL client is [`switchx`](https://github.com/kalmik/switchx) (hex
`1.0.1`, last commit 2026-04-07, deps `uuid` + `telemetry`). It is a protocol
client, not a consumer: reconnect, buffering, status and the event→frame
translation are ours, exactly as they were with `Gnat`.

## Why now — what the log said about the NATS path

Asked to "check the issue with broadway connect", the local portal's log
(container up since 2026-09-21 19:22) showed 16 `Closing connection because we
did not receive a PONG back within 10000ms` since 2026-09-20 and two plain
`connection closed`. **Every one lined up with this WSL host losing its
network**: `:enetunreach` on the reconnect attempts, `WebRtc.Transport: local
address moved 192.168.1.97 -> 10.26.227.151` twenty seconds after the 06:51
drop, and a 20-hour hole in the log (laptop asleep) after the 21:46 one. The
producer re-subscribed within 1–31 s each time (its 1·2·4·8·16 s backoff), the
deadman logged `events are arriving again`, and `/health` reads `nats: ok,
silent_ms: 53` now. **The pipeline is not broken.** One wart, harmless: when
`Gnat` has registered its name but is still inside `connect`, the producer's
`Gnat.sub` call times out after 5 s (`nats: subscribe failed — {:timeout, …}`);
the backoff covers it.

What the exercise did show is how many hops sit between the switch and a pop:
FreeSWITCH → node (`node_event_consumer.cr`, ESL) → NATS on `185.28.152.124`
(public internet, 5 ms RTT from here) → portal. The events the portal
consumes are FreeSWITCH's own (the `complete` frame in the log is a
`CHANNEL_HANGUP_COMPLETE` with its `variable_*` under `meta`), so the relay
adds latency (measured before: one call's burst delivered ~18 s after the call
ended), a second machine to keep alive, and a broker shared with other
tenants (the 2026-09-17 "foreign agent ids" investigation). Reading the switch
directly removes all three.

## ESL facts that shape the design

- **Inbound mode**: we connect to `mod_event_socket` (default `:8021`), send
  `auth <password>`, then `event plain|json <names…>`. Events arrive as
  `text/event-plain` (URL-encoded `Header: value` lines) or `text/event-json`
  (a `Content-Length` body holding one JSON object). Core NATS semantics
  apply: **nothing is replayed**; an event fired while we were disconnected is
  gone.
- **`HEARTBEAT` every 20 s** is a subscribable event. It is the liveness signal
  NATS never had: the deadman can be tightened from today's 900 s to ~60 s,
  and a socket a NAT silently dropped is detected in a minute, not two hours.
- FreeSWITCH says goodbye with `Content-Type: text/disconnect-notice` on
  shutdown; a crash is a bare TCP close.
- **The pop triggers are `CUSTOM callcenter::info` events.** `CC-Action`
  carries `bridge-agent-start` / `agent-offering` / `agent-state-change`…,
  `CC-Agent` the agent, `CC-Member-CID-Number` the caller,
  `CC-Member-Session-UUID` / `CC-Member-UUID` the call. That is the entire
  event surface the screen pop needs; unlike a NATS wildcard, ESL lets us
  subscribe to **only** those names, so the firehose (146k frames/day, 86 %
  `CHANNEL_HANGUP_COMPLETE` at 8.6 KB) never enters the process.
- `mod_event_socket` binds `127.0.0.1` by default and gates clients with an
  ACL (`apply-inbound-acl`, default `loopback.auto`) and a password (default
  `ClueCon`). All three change on the switch before the portal can connect
  (see *Prerequisites*).

## What switchx gives, and what it does not

Read from the source (`lib/switchx/connection/inbound.ex`,
`lib/switchx/connection.ex`, `lib/switchx/connection/socket.ex`,
`lib/switchx/event/*.ex`):

- `SwitchX.Connection.Inbound.start_link(host:, port:)` connects
  (`:gen_tcp`, 5 s), then starts a linked `:gen_statem` whose **owner is the
  calling process**; every event is `send(owner, {:switchx_event,
  %SwitchX.Event{headers: %{…}, body: ""}})`. There is no connection
  supervisor and no way to move the owner, so **the producer must open the
  connection from its own process** — the reverse of `Gnat.ConnectionSupervisor`
  + `Process.monitor`, and simpler.
- `SwitchX.auth/2` and `SwitchX.listen_event/2` are synchronous calls.
  `listen_event` hard-codes `event plain <name>`; there is no `json` variant
  and no raw-command API. Two-line upstream change; see phase 3.
- **No reconnect, and no `{:tcp_closed, _}` clause.** In
  `:handle_event_function` mode an unmatched info crashes the statem with a
  `FunctionClauseError`, which reaches a linked, exit-trapping producer as
  `{:EXIT, conn, reason}`. That is our "connection lost" signal, mirroring the
  `:DOWN` clause in `NatsProducer`. Pin it with a fake-server test so an
  upstream fix (a clean `{:stop, …}`) cannot silently change the shape.
- Headers are `URI.decode`d (`Headers.uri_decode/1`), and a `Content-Length`
  body is read (`Socket.read_body/2`), so both `plain` and `json` framing
  parse. The parser is **one blocking `gen_tcp.recv` per header line** inside
  the connection process, with a 1 s idle timeout as "end of headers". On a
  LAN with only callcenter events subscribed this is fine; it is the thing to
  measure before widening the subscription (phase 3).
- `text/disconnect-notice` is delivered to the owner as an ordinary
  `{:switchx_event, …}` — the producer must recognise it and treat it as
  lost, since the socket close that follows may not.
- Socket options are fixed (`[:binary, active: :once, packet: :line]`);
  `Inbound.start/1` also returns the socket, so `:inet.setopts(socket,
  keepalive: true)` is available from the owner. With `HEARTBEAT` under the
  deadman it is belt-and-braces, not the fix.

## Design

### `Realtime.EslProducer`

A `GenStage` + `Broadway.Producer`, a line-for-line sibling of
`NatsProducer` (`lib/connectix/realtime/nats_producer.ex`). Keep verbatim: the
bounded queue with oldest-first drop and one-warning-per-episode hysteresis;
`status/0`, `last_message_at/0`, `subscribed_at/0`, `silent_ms/0`,
`resubscribe/0` on `:persistent_term` + `:atomics`; `trap_exit` so
`terminate/2` resets the status; `prepare_for_draining/1`; the
1 s → 30 s exponential retry. Change:

- `init/1` options: `host`, `port`, `password`, `events` (list of ESL names,
  default `["CUSTOM callcenter::info", "HEARTBEAT"]`), `max_buffer`, and an
  injectable `connect` function (default: `Inbound.start/1` → `auth` →
  `listen_event` per name → `{:ok, conn, socket}`), the test seam that
  `subscribe`/`unsubscribe` were.
- `handle_info(:subscribe, …)` calls `connect`; on `{:ok, conn, socket}` sets
  keepalive, stamps the `@subscribed_slot`, `put_status({:subscribed,
  events})`; on `{:error, _}` or a raised `:exit`, `schedule_retry/1`.
- `handle_info({:switchx_event, %{headers: %{"Content-Type" =>
  "text/disconnect-notice"}}}, …)` and `handle_info({:EXIT, conn, reason},
  …)` → `put_status(:disconnected)`, `send(self(), :subscribe)`.
- `handle_info({:switchx_event, %{headers: %{"Event-Name" => "HEARTBEAT"}}},
  …)` → stamp the clock, count `received`, emit nothing.
- Every other `{:switchx_event, event}` → stamp, count, `enqueue` a
  `%Broadway.Message{data: event.headers, metadata: %{subject:
  "freeswitch:" <> name_or_subclass, event_name:, subclass:}}`. `data` is
  already a map, so `EventPipeline.handle_message/3` gains a clause that
  skips `Jason.decode` when the data is a map (one line; the JSON clause stays
  for phase 3).
- `resubscribe/0` (the cockpit's `c`) closes the socket and reconnects.

Telemetry keeps the counter but renames it: `connectix_nats_messages_count`
→ `connectix_esl_events_count{result=received|dropped|undecodable}`.

### `Realtime.FreeSwitch.Frame` — the one new idea

Every consumer reads the **node's** frame shape, and none of that should
change: `ScreenPop` reads `action` (`event_name/1`), the agent through
`PopRule.agent_fields` (customer yaml, today `meta.CC-Agent` / `user_uuid`),
the caller from `caller_id_number` or `meta.CC-Member-CID-Number`, the call
from `call_uuid`/`id`; `Events.record/3` labels by `action`, trims
`variable_*` under `meta`, and derives identity from `id`. So
`Frame.from_esl(headers)` produces that shape, pure and unit-tested against
captured events:

| frame key | from ESL | note |
|---|---|---|
| `action` | `CC-Action` for `callcenter::info`; else `Event-Name` lower-cased | `bridge-agent-start` stays the trigger, untouched in every customer yaml |
| `meta` | the whole header map | so `meta.CC-Agent`, `meta.CC-Member-CID-Number`, `meta.CC-Agent-State` keep working, and the store's `variable_*` trim still applies |
| `user_uuid` | `CC-Agent` | the node's normalisation, kept for `agent_fields` |
| `caller_id_number` | `CC-Member-CID-Number`, else `Caller-Caller-ID-Number` | |
| `id` | `<action>_<CC-Member-Session-UUID>_<CC-Member-UUID>_<CC-Agent>` | **the dedupe key**; must be built the way `node_event_consumer.cr` builds it, verified against one frame captured from both paths. CLAUDE.md documents the shape `<action>_<session>_<member>_<agent>` |
| `uuid` | `Unique-ID` | |
| `type` | `"call"` | |
| `create_date` | `Event-Date-Timestamp` (µs) | the store already accepts epoch microseconds |

`EventPipeline.route/3` gets one clause: `["freeswitch" | _] →
ScreenPop.handle_event(ctx.screen_pop, Frame.from_esl(headers))`. The
`call_events` / `node:` / `state.` / `notifications:` / `dashboard_user:`
clauses are deleted with the producer that fed them.

### What the replacement drops, and what covers it

NATS carried four streams; ESL carries one. Decided per stream:

- **`node:<uuid>` / `call_events`** — replaced outright; this is the
  callcenter feed, now first-hand.
- **`state.user.<powerlink>`** — the agent's state changes. Covered:
  `agent-state-change` and `agent-status-change` are `callcenter::info`
  actions too, so `route/3` also calls `UserStreams.state_event(ctx,
  "user", cc_agent, frame)` for those, and the browser's state fold keeps
  working. Gate: the `UserStreams` tests pass with an ESL-shaped state frame.
- **`notifications:<uuid>`** and **`dashboard_user:<uuid>`** — mothership
  products, not switch events. **They retire with the relay.** Nothing in the
  extension's pop path depends on them (the pop is a `tab:new` the portal
  itself emits); if a client turns out to read them, the mothership's HTTP
  API is the source, not this pipeline.
- **`Realtime.Nats.publish/2`** — the presence stamp `RealtimeSocket`
  publishes on `state.user.<uuid>` at socket open. With no broker it has no
  reader; the call and its `presence: not announced` debug line go.

### Configuration

The rule file stays the one place "where events come from" is written:

```yaml
freeswitch:
  host: ${FREESWITCH_HOST}        # the switch's ESL address
  port: 8021
  password: ${FREESWITCH_ESL_PASSWORD}
  events:                          # ESL names; the fewer the better
    - CUSTOM callcenter::info
    - HEARTBEAT
  deadman: 60s                     # HEARTBEAT is every 20 s
```

`PopRule.freeswitch/0` replaces `nats/0` (`url`, `subjects`,
`nats_deadman_ms`), with the same `${VAR}` expansion. `ESL_URL=esl://:pass@host:8021`
is the env fallback for a file that names none, parsed by
`Realtime.FreeSwitch.settings/1` the way `Nats.settings/1` parses `NATS_URL`,
so the credential never sits in the yaml. `EventPipeline.children/0` keeps its
two guards: empty unless configured, **never in test**.

### Everything wired to `NatsProducer` today

Rename the call, keep the contract: `HealthController` (`nats` check →
`freeswitch`, same `subjects`→`events`, `last_event_at`, `silent_ms`,
`deadman_ms` fields, so the Uptime Kuma reason strings still read),
`Realtime.Deadman.check/0`, `Heartbeat`'s "subscribed" predicate,
`Realtime.Inspector.snapshot/0` and `resubscribe/0`, the TUI's broker row and
its `c` key.

## Prerequisites on the switch (operator, not code)

- `event_socket.conf.xml`: `listen-ip` on an address the portal can route to
  (it is `127.0.0.1` by default), a password that is not `ClueCon`, and an
  `apply-inbound-acl` naming the portal host. Firewall `:8021` to that host
  alone; ESL is plaintext and a full control channel, not read-only.
- **Routing.** The frames name the switch as `192.168.25.12` (private). The
  `connectix` destination (nimbus-connectix) must reach it — a tunnel, or
  deploying the portal beside the switch (a `pbx20` destination already
  exists in `config/deploy.pbx20.yml`). Decide this before phase 1 lands,
  because it is the only part that cannot be tested from here.
- Local development has no switch. A fake ESL server in the test suite covers
  the protocol; a real one is either a `freeswitch` compose profile beside
  `sipp` (the SIPp container already exists for the phone) or a lab switch
  the developer's VPN reaches. Pick per developer; neither blocks the code.

## Phases and gates

**Phase 0 — dependency.** `{:switchx, "~> 1.0"}` in `connectix/mix.exs`;
`mix deps.get` in the dev container; compile clean with
`--warnings-as-errors`. Check `uuid` does not collide with an existing dep.

**Phase 1 — producer, frame, routing.** `EslProducer`, `FreeSwitch`,
`FreeSwitch.Frame`, the `route/3` clause, the map-data clause in
`handle_message/3`, `PopRule.freeswitch/0`, `ESL_URL`. Delete `Nats`,
`NatsProducer`, `Config.nats_url/nats_subjects`, the NATS `route/3` clauses,
`RealtimeSocket`'s presence publish, `:gnat` from `mix.exs`.
Tests: `esl_producer_test.exs` mirrors `nats_producer_test.exs` with an
injected `connect` returning a test-driven fake connection (events via
`send(owner, {:switchx_event, …})`, loss via `Process.exit(conn, :closed)`
and via a `disconnect-notice` event); `frame_test.exs` on captured
`callcenter::info` plain events; `esl_server_test.exs` runs a real
`:gen_tcp` fake ESL server on port 0 to pin auth, one event, disconnect
notice and bare close **through switchx** — this is the test that guards the
crash-on-close assumption. `event_pipeline_test.exs` gains "an ESL
`bridge-agent-start` reaches `ScreenPop` node-shaped".
Gate: `make test` green; the ~31 seed-stable chat failures aside.

**Phase 2 — everything around it.** Health, deadman (threshold from the
file, default 60 s), heartbeat, inspector, TUI; `.env.example`,
`docker-compose.yml` (drop the `nats` service and volume, `make nats-send`),
CLAUDE.md's "local stack" and "pipeline" sections, `docs/architecture.md`,
`docs/deployment.md`, `docs/testing.md`, the customer yamls under
`priv/pocketflow/customers/`. Gate: `/health` shows `freeswitch`, `make
health` and `make tui` read right against the fake server or a lab switch.

**Phase 3 — measure, then widen.** Against a real switch: connect, wait for
one `bridge-agent-start`, confirm exactly one pop and one stored row with
the same `id` the node produced for the same call (the dedupe check). Then
`:observer`/`/metrics` on the connection process while subscribing
`CHANNEL_HANGUP_COMPLETE` for the store. If the per-line `recv` parser is the
bottleneck, send switchx the two-line PR that adds a format argument to
`listen_event/3` (`event json …`), and let the producer emit the JSON body
undecoded so Broadway's processors decode in parallel — which is the reason
the pipeline exists. Only then decide whether the store gets the hangup
frames at all.

## Risks, named

- **Double pops during any overlap.** If a customer's node still relays
  `callcenter::info` onto a NATS subject somebody else consumes, that is
  their pipeline; ours reads one source. But `id` must match the node's or a
  later comparison of the two stores is meaningless — hence the phase-3 check.
- **Loss on reconnect** is the same as core NATS, with one difference that
  helps: FreeSWITCH restarts drop every ESL client at once and `HEARTBEAT`
  resumes within 20 s, so the gap is visible and bounded.
- **switchx is small and single-maintainer.** 1,084 lines, MIT, readable in
  an hour; if it stalls, the framer is a weekend to own. The fake-server test
  is what makes swapping it safe.
- **The rule-file `triggers` gate stays first.** Subscribing only
  `callcenter::info` does not remove `PopRule.trigger?/1`; it just means the
  `ignored` counter should read near zero, which is itself a check.

## Working notes

- The main checkout has uncommitted edits to `docs/README.md` and
  `docs/ionic-app.md` (the Ionic work). This worktree branched from the
  committed tree, so the README row added here will need a trivial merge.
- switchx was cloned to the session scratchpad for reading only; it is not
  vendored.
