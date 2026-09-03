# Spec: the relay direction — va-crystal → Elixir → the browser

**Status:** IMPLEMENTED and proven through the real chain by
`tests/cable-events.spec.ts` (Elixir → cable, and the screen-pop contract) and
`chrome/tests/e2e/portal-receive.spec.ts` (Chrome → Elixir, with the real
extension), both driven by the stack in `tests/cable-events/` and run by the
`cable-events` CI job — `make act-cable` locally. One scenario (A4) is
intermittent on a known node defect and runs non-blocking; see *Known defects*.

- **Node:** `va-crystal node/realtime/app.cr` (the channels),
  `state_publisher.cr` (state events), `api_proxy_channel.cr` (`verify`),
  `va-shared/src/cable_nats_backend.cr` (stream ⇄ NATS subject). Those files
  are the authority on the node's side; `va-crystal/docs/CABLE_SPEC.md` is its
  own contract for the wire.
- **Portal:** `AgentsDemo.Realtime.ApiProxy` (the application connection:
  `verify`, and the one `CallEvents` subscription), `Realtime.CableClient` (one
  connection per signed-in user), `Realtime.ScreenPop` + `Realtime.Instruction`
  (the executor), `AgentsDemoWeb.RealtimeSocket` (`/ws/events`).
- **Browser:** `chrome/docs/REALTIME_CONTRACT.md` is the frame contract the
  extension and the SPA speak; nothing here changes it.

`docs/cable-api-proxy-spec.md` is the other direction — the portal *asking*
the platform over the same cable. This document is what comes *back*.

**Audience:** anyone changing either half, and anyone reading a red
`cable-events` job.

## Why

The portal's transport rule is one path to the platform: **cable, never HTTP
and never NATS**. Events therefore arrive the way everything else does — over
an ActionCable connection to a va-crystal node — and the portal holds no
broker client at all (scenario A7 proves it from the broker's side).

That puts three parties on one wire, each with one job:

```
NATS subject ──> va-crystal node ──cable──> Elixir portal ──/ws/events──> browser
 (crystal,        stream == subject          verifies tokens,                opens a tab,
  mothership)     verbatim                   holds the streams,             stores call state
                                             executes screen pops
```

- **Crystal** normalises FreeSWITCH events and publishes them; it also fans
  out anything the mothership publishes on a stream's subject. It knows no
  screen-pop rule and opens no tab.
- **Elixir** verifies who is on each browser socket (by asking the node),
  holds that user's streams, folds state, and executes screen-pop
  instructions against the `CallEvents` stream — for a user who is *currently
  connected and verified*, and nobody else.
- **The browser** receives a command, not an event.

## What exists today

Verified by reading the source and by the scenarios below, not assumed.

**Stream identifier == NATS subject, verbatim.** Cable's backend on the node
publishes and subscribes with the ActionCable stream name as the subject
(`cable_nats_backend.cr:81-87`). So a publish to `notifications:<uuid>`,
`call_events` or `state.user.<uuid>` on the broker is exactly what reaches a
subscriber of that stream — which is how the mothership reaches the portal
(`voipappz-api lib/mediators/notification/broadcast/nats.rb` publishes both the
dot-form subject for wildcard consumers and the colon-form stream for cable).

**Tokens are verified by the node, from its own `SECRET_KEY`.** A browser
socket's bearer token is sent to the node's `ApiProxy` channel as a `verify`
action and answered with the claims (`user_uuid`, `account_uuid`, the first
`environment_uuids`). The portal never decodes a JWT. A node image that
predates `verify` answers the unknown-action 400, and the portal then refuses
*every* browser socket — the readiness gate names this case.

**The node needs no mothership and no FreeSWITCH to serve cable.** Its
`/health` is a static `OK`; the ESL consumer and the API calls fail as
warnings. The test stack runs it with `API_URL` pointed at nothing.

**No replay.** A message published between `subscribe` and
`confirm_subscription` is not delivered (CABLE_SPEC §2). Every scenario that
publishes therefore publishes *until received*, never once.

## Design

### Connections the portal holds

| connection | identity | subscriptions | why |
|---|---|---|---|
| the application connection (`Realtime.ApiProxy`) | the portal's account credential (`CABLE_ACCOUNT_UUID`) | `ApiProxy` (requests, `verify`), `CallEvents` | one node-wide stream for the executor; the node admits `CallEvents` only to this account |
| one per signed-in user (`Realtime.CableClient`) | a token minted for that user from the verified claims | `DashboardUser{user_uuid}`, `Notifications{user_uuid}` | `DashboardUser#subscribed` is the presence registration (`user:<uuid>:logged_in_at`); `Notifications` is the user's own stream |

A per-user connection is opened by the first `/ws/events` socket of that user
and outlives the socket on purpose (a reload must not re-register presence).
It is reaped when its own connection dies.

### What a browser socket receives

| upstream | condition | frame on `/ws/events` |
|---|---|---|
| `Notifications{user}` message | always | `{type:"notification", message:<verbatim>}` |
| `DashboardUser{user}` / state message | always | `{type:"user.state", user_uuid, event, at, view:<folded>, message}` |
| `CallEvents` event | the executor matched it to a loaded instruction **and** the named user has a live, verified socket for that environment | `{type:"notification", message:{action:"tab:new", url}}` — identity stripped |
| anything else | — | nothing |

Protocol frames (`welcome`, `ping`, `confirm_subscription`, …) never reach a
browser. `welcome` precedes any data frame.

### The screen-pop executor

One supervised process (`Realtime.ScreenPop`) owns the instruction cache and
the dedupe set for the whole portal, fed by the single `CallEvents`
subscription. For an event it requires `action` in the instruction's triggers,
`user_uuid`, `environment_uuid`, and a stable id (`id` · `uuid` · `type_uuid`
· `call_uuid`, first present); the instruction's URL must be `https` with a
host and no userinfo. It executes at most once per event id (256 ids, 60 s),
and only when `(user_uuid, environment_uuid)` names a registered `/ws/events`
process — an offline user gets nothing, and nothing is queued or replayed.
Every outcome is a counter on `/metrics`
(`agents_demo_screen_pop_events_count{result=…}`: `received`, `dispatched`,
`duplicate`, `offline`, `unloaded`, `rejected`), which is what lets a test
prove *nothing happened* without a bare timeout.

Today's instruction is static (`Realtime.InstructionLoader`:
`user.answer → tab:new https://google.com`, every environment); the Ruby
loader contract (`screen_pop.instructions.load`) replaces it without changing
anything here.

### Failure behaviour

- **Token refused or node unreachable:** the upgrade is refused (401) within
  a bound. There is no HTTP fallback for verification — a socket that would
  stay silent is refused instead (`TokenAuth`).
- **Node restarts:** the application connection and every per-user connection
  reconnect with exponential backoff (1 s → 30 s) and re-subscribe; the browser
  socket is *not* closed.
- **Portal restarts:** nothing is persisted; a new browser socket re-verifies,
  re-registers and re-subscribes from its token alone.

## Verification

Every scenario runs against the stack in `tests/cable-events/`:
`nats:2-alpine` on 14222 (no auth, monitoring on 18222), the node image
(`VA_CRYSTAL_IMAGE`) on 14100, the **production** portal image on 14001 —
its own compose project, all host-networked, coexisting with `make dev`.
`tests/cable-events/ready.sh` gates every run on a *proven* chain: the node
has confirmed the portal's relay, and one `/ws/events` upgrade with a token
minted from the stack's secret is answered 101.

Run: `make test-cable [VA_CRYSTAL_IMAGE=…]` on the host, or `make act-cable`
for the CI job under act. Both refuse to start on a port the stack needs.

### A — Elixir → cable (`tests/cable-events.spec.ts`)

| # | scenario | proven by |
|---|---|---|
| A1 | the node confirmed the portal's `ApiProxy` subscribe | `/health` `cable.ok && api_relay.ok` — green only on a confirmed subscribe |
| A2 | tokens are verified by the node | right secret → `welcome`; the same claims signed with a wrong secret → refused |
| A3 | the per-user connection opens and its streams deliver | a `notifications:<uuid>` publish comes back verbatim |
| A4 | **node restart** — reconnect, re-subscribe, deliver again on the surviving browser socket | relay confirmed again, browser socket never closed, then delivery — **intermittent: known node defect**, non-blocking in CI |
| A5 | **portal restart** — nothing persisted, a new socket is welcomed and delivered to | relay confirmed, then A3 again |
| A6 | node down — an upgrade is refused within a bound, never hung | refusal < 15 s with the node stopped |
| A7 | the portal holds no broker connection | the broker's `/connz` lists no Elixir client |

### B — Chrome → Elixir, the real extension (`chrome/tests/e2e/portal-receive.spec.ts`)

The session is seeded the way the popup hands it to the worker after login
(`{event:"login", data:{user_uuid, token}, domain}` over a runtime port), with
a token minted from the stack's secret — there is no mothership to log into.

| # | scenario | proven by |
|---|---|---|
| B1 | the worker connects with the bearer subprotocol and is welcomed | `_realtime` open on `ws://…:14001/ws/events`, still open 2 s later |
| B2 | **the whole chain**: a call event for this user opens a tab | `call_events` publish → `tab:new` frame in the worker → a page opens on that host |
| B3 | portal restart — the worker reconnects on its own | socket back to OPEN with no re-seed, then B2 again |
| B4 | CORS for `chrome-extension://<id>` is answered by the portal | `OPTIONS /auth/user_login` → 204, `allow-origin: *` |
| B5 | no bearer, no socket | a bare upgrade → 401 |
| B6 | a call-state notification lands in `chrome.storage` as `call:ringing` | `notifications:<uuid>` `{type:"agent",…}` → storage |

### C — the screen-pop contract (`tests/cable-events.spec.ts`)

| # | publish on `call_events` | expect |
|---|---|---|
| C1 | a matching `user.answer` | exactly `{action:"tab:new", url}` for that user; `dispatched` +1 |
| C2 | the same event id again | nothing; `duplicate` +1, `dispatched` +0 |
| C3 | another user's event | nothing (`offline`); a marker behind it arrives |
| C4 | another environment's event | nothing; marker arrives |
| C5 | no environment · no id | nothing; marker arrives (`rejected` for no id) |
| C6 | a non-trigger action | nothing (`rejected`); marker arrives |
| C7 | a `notifications:<uuid>` message | relayed verbatim — the executor owns `CallEvents` only |
| C8 | all of the above, watched from another user's socket | nothing at all |

## Known defects (need va-crystal)

Observed 2026-09-03 against `va-crystal-cable:screen-pop`, an image built from
`ed137-lua-hooks` at `168feb5`; each reproduces with the scenarios above.

1. **Subscriptions confirmed in the node's first seconds are never bound to
   the broker (A4).** A race, not a certainty: it reproduced twice in a row on
   this box and passed once under act. After `restart cable`, the portal
   reconnects ~5–8 s after the node binds its port; the node logs `Notifications is streaming
   from notifications:<uuid>` and `CallEvents is streaming from call_events`,
   confirms both — and neither ever delivers. A client subscribing a minute
   later is served normally. Because the singleton `CallEvents` subscription
   dies the same way, **a node restart silently ends screen pops** until the
   portal's application connection happens to reconnect again. The portal
   cannot detect a dead-but-confirmed stream. (`Cable::NATSBackend#subscribe`
   calls `@nats.subscribe` at once; the bind is lost around the node's own
   NATS bring-up — `NATS sync command handlers started` lands in the same
   millisecond as the confirmations.)
2. **Duplicate delivery after reconnects.** The backend keeps one NATS
   subscription per stream *name* and never unsubscribes when the cable
   connection that asked for it terminates, so after N portal reconnects
   every `call_events` message is transmitted N times to the surviving
   connection (`Cable::NATSBackend#subscribe channel:call_events` × 3 per
   publish, with 3 confirmed and 2 terminated connections). The executor's
   dedupe hides it for pops; `received` counts it.
3. **Credentials in the node log at INFO.** The full `?token=<jwt>` URL of
   every cable connection and the `verify` payload (token included) are
   logged; the api-proxy spec already flags the request-body case.
4. **`nirlevi/voipappz-crystal:latest` predates `verify`** — the readiness
   gate fails by name on it. Publish an image from a commit that has it.

## Out of scope

- `DashboardLive`, `AccountNotifications`, `StateChannel` scope other than
  `user`; backpressure and coalescing (contract obligations of
  `REALTIME_CONTRACT.md`, not exercised here).
- The two cable defects the api-proxy spec records (`exp` unchecked on the
  node; the historical client-named `Notifications` stream — the node now
  derives it from the token).
- The request direction: `docs/cable-api-proxy-spec.md`.
