# The Ionic app

`ionic/` — Angular 21 / Ionic 8 / Capacitor 6 — is the portal UI and the mobile
app, bundled into the Elixir release and served at **`/app`**.

It came from `~/connectix.io-OLD/app/`, where it had already been half-pointed
at a DIFFERENT Elixir app: the old gateway on `:4000`, whose `/agent` Phoenix
socket does not exist in this repo. That is why almost every realtime and login
assumption in the source had to be re-decided rather than reused — see
[What is decided](#what-is-decided).

## How it is wired

```
browser / capacitor webview
  │
  │  GET /app, /app/calls, …          Plug.Static → priv/app, then AppController
  │  POST /auth/user_login            Portal.AuthController — the portal performs it
  │  GET  /api/calls, /tasks/…        Plugs.EngineProxy → ENGINE_URL
  │  ws   /ws/events                  the realtime feed (phase 2)
  ▼
Elixir portal :4001 — one origin, no CORS
```

Everything is same-origin by construction, which is the whole reason the bundle
lives inside the release instead of being hosted separately.

| | |
|---|---|
| `make app` | build `ionic/www` and copy it to `connectix/priv/app` |
| `make -C ionic serve` | dev server on :8100, proxying the portal (`proxy.conf.js`) |
| `make -C ionic apk` | debug APK, Android SDK container |
| `make -C ionic ios-sync` | sync `ios/`, print the Xcode command (macOS only) |
| `make -C ionic relock` | regenerate `package-lock.json` |

`Dockerfile.production`'s `ionic` stage runs the same build; the `builder` stage
copies `www/` to `priv/app`. Node lives and dies in that stage — the shipped
image has no node, no npm, no `node_modules`.

## Four things that are load-bearing

**`--base-href /app/`.** `index.html` references every asset relatively
(`assets/config/main.js`, the hashed chunks). Built at `/` and served at `/app`,
every one of them 404s — a build that compiles perfectly and renders a blank
page. Asserted by `make -C ionic check`, by the `ionic` Docker stage, and by the
`ionic` CI job, because it is invisible until a user sees it.

**`priv/app`, not `priv/static/app`.** `mix phx.digest` walks all of
`priv/static` whatever `static_paths/0` says, so a bundle there gets a second
content-hashed copy of every chunk and a `cache_manifest.json` entry — for
nothing, since Angular hashes its own filenames. Same reasoning as the
extension zip in `priv/extension`.

**The `.gz` files are made by the build.** `Plug.Static`'s `gzip: true` serves
`foo.js.gz` only if it exists, and it is `phx.digest` that normally writes
those. Since digest never sees this bundle, the compress step in the Makefile
and the Docker stage is the only thing that makes the option mean anything.
(`gzip: not code_reloading?`, so dev serves the plain files — a missing
`content-encoding` locally is expected, not a bug.)

**`/app` deep links need the router.** `/app/calls` is an Angular route, not a
file: `Plug.Static` finds nothing and falls through, so `AppController` answers
the shell for `/app` and `/app/*path`. Without it the app works until someone
presses F5. With no bundle in the image it answers **503 naming `make app`**,
not 404 — a 404 there reads as a broken mount or a wrong base href, which are
the two real failures this route has.

## What is decided

| | |
|---|---|
| **Role** | mobile + web; it eventually replaces the LiveView UI, phased |
| **Phone** | the **Ionic** SIP.js softphone, registered to the customer's SBC |
| **Realtime** | the app moves to `/ws/events`; no `/agent` socket is added here |
| **Login** | portal-owned, and the customer yaml's agent entries grow the SIP fields |
| **Queue dial** | in Elixir: prerecorded WAV intro, queues in the customer yaml, agents rung in yaml order |

**The Elixir SIP stack stays even though the Ionic phone wins.**
`Connectix.Voice.SipCallBridge` registers in `Connectix.WebRtc.Registry` under
the same `:bridge` key as `WebRtc.Peer`, and `WebRtcMediaPipeline`,
`BrowserSink` and `CallRecord` all hang off `SipBridge` — that stack is the
voice bot's leg. What retires with the LiveView UI is `ChatLive`'s phone *UI*
(11 `phone_*` handlers, three `webrtc_*` pushes, the `WebRtcPhone` JS hook),
not the transport. A side effect worth having: `:bridge` is a unique registry
key, so taking the agent phone off it ends the contention between an agent call
and a bot call.

**SIP and Janus addresses stay empty in `CONFIG`.** `webrtc-phone.ts` *prefers*
`CONFIG.WEBSOCKETS_SIP_URL` over the agent's own `environment.wss_server`, so
setting it would override every agent's real environment with one address —
which breaks the moment two agents are on different environments.

## Phases

**Superseded 2026-09-22:** all user interface becomes the Ionic app. The steps
are in [ionic-migration.md](ionic-migration.md); the list below is the earlier
embedding plan, kept for the record.

- [x] **1 — embedded.** `ionic/`, the dockerized Makefile, the `/app` mount and
      controller, the `ionic` Docker stage and CI job, `CONFIG` pointed at the
      portal, the bundle on `/release`.
- [ ] **2 — realtime and auth.** `ChannelAdapter` → `/ws/events` (token as
      `Sec-WebSocket-Protocol`, `welcome` before data, folded `user.state.view`
      — see `chrome/docs/REALTIME_CONTRACT.md`); drop the `phoenix` dep; portal
      accepts `Basic` as well as `Bearer`; `EngineProxy` CORS extended to
      `@own_prefixes`, which today have none and so break the Capacitor origin
      (`/api/events`, `/dashboard/*`).
- [ ] **3 — the login carries the phone.** Agent entries gain
      `extension`/`environment`/SIP fields so a portal-issued login can
      register the softphone without an engine.
- [ ] **4 — queue dial.** See below.
- [ ] **5 — retire the LiveView.** Sagents chat over a user-token API plus a
      streaming surface (`/api/conversations` is behind `Plugs.ApiAuth`, a
      machine key — a person cannot call it today), an Ionic chat page at
      parity, then delete `ChatLive` and its phone UI.

## Pages

33 pages arrived; that is not the target. The real navigation is three tabs —
dashboard, calls, actions — and the phone is not a page at all
(`core/providers/phone/*` driven from `app.component.ts`), so it survives any
trim.

- **Keep** (~2,000 lines): `login`, `calls`, `dashboard`, `tabs-page`,
  `settings`, `notifications-page`, `conversation-page`, plus the `dialpad`,
  `app-header` and `filter` partials.
- **Delete** (~2,000 lines of ionic-conference-app): `schedule`,
  `schedule-filter`, `session-detail`, `contact-list`, `contact-detail`, `map`,
  `about`, `about-popover`, `tutorial`, `chat-room`, `chat-room-list`,
  `conference-page`, `support`, `signup` — and `queue-page`, `number-page`,
  `extension-page`, which are 0 lines with live routes pointing at them.
- **Consolidate into the `actions` tab, cut from the first build** (~3,500
  lines, engine-only): `time-condition-page`, `actions-page`, `locations-page`,
  `ivr-page`, `identities-page`, `syslog-page`, `reports-page`,
  `automations-page`, `routing-select`.

## Queue dial in Elixir (phase 4)

**The portal is already a mod_callcenter consumer**, which decides the design.
`priv/pocketflow/screen_pop.yaml` triggers on `bridge-agent-start`, gates on the
agent state `In a queue call`, and reads the agent from `meta.CC-Agent`;
`screen_pop.ex` reads `CC-Member-CID-Number` and `CC-Agent-State`. The observed
transitions for a real call are recorded there: `Waiting → Receiving → In a
queue call → Waiting`.

So the rule is: **emit what mod_callcenter emits** — `agent-offering`,
`bridge-agent-start`, `bridge-agent-end`, `bridge-agent-fail`, carrying
`CC-Queue`, `CC-Agent`, `CC-Agent-State`, `CC-Member-UUID`,
`CC-Member-CID-Number`. Then the screen pop, the dedupe key, the TUI, `/metrics`
and the `agent_states` gate all work against our own queue with no rule change.

Both legs are SIP, so this needs no WebRTC, no ICE and no DTLS-SRTP — RTP/A-law
in, RTP/A-law out. The agent's leg rings their Ionic softphone through the SBC.

What exists: the 20 ms media clock in `Voice.SipCallBridge` (160-byte A-law
frames per tick, silence injection so Deepgram never sees a gap, barge-in),
`Alaw`, `CallRecord`, `Transport` with `CONNECTIX_SIP_PUBLIC_IP`, and parrot
already patched for inbound INVITE.

What is missing, largest first:

1. **A UAS answer path.** `WebRtc.SipHandler.handle_invite/2` is a hard refusal
   (`480 Temporarily Unavailable`) and `SipBridge`'s moduledoc says "UAC only —
   no inbound calls". Needs 200 OK with SDP, ACK, dialog, BYE both ways.
2. **A per-call UA.** `SipBridge` is `name: __MODULE__` with one `call_id`. Two
   live legs means a DynamicSupervisor and a `WebRtc.Registry` key per leg.
   `Transport` stays shared — SIP multiplexes on Call-ID.
3. **A WAV intro player** — read, `Alaw.encode`, feed the existing tick loop.
   No second clock.
4. **An A↔B media bridge** — forward leg A's `{:play, alaw}` to leg B and back.
   Small, because the bot leg already proves that seam.

The queue shape, one tier level, `position` = yaml order (mod_callcenter's
`top-down`):

```yaml
queues:
  support:
    did: "+972..."
    intro: sounds/support.wav
    max_wait_time: 300
    agents: [agent@example.com, other@example.com]   # ring order
    no_answer_delay_time: 20
    wrap_up_time: 10
    max_no_answer: 3
    reject_delay_time: 10
```

Four mod_callcenter behaviours are the difference between a demo and something
usable: **`wrap_up_time`** (without it the agent who just hung up is rung
instantly by the next caller), **`max_no_answer` → On Break** (without it a dead
extension is rung on every call forever), **reject/busy delay** (a 486
re-offered immediately is a tight loop), and the **status/state distinction** —
status is Available/On Break/Logged Out, state is Waiting/Receiving/In a queue
call; the portal already knows status-ish from `ScreenPop`'s live-socket
tracking, and state becomes ours to own per call.

Two constraints, not footnotes:

- **A deploy drops every in-flight queue call.** Kamal starts the new container,
  health-checks it, and only then stops the old one — there is no draining. This
  is the exposure that choosing the Ionic phone deliberately took OFF the portal,
  brought back for calls instead of registrations, so a SIGTERM drain (refuse
  new INVITEs, finish live ones) is part of the work rather than a follow-up.
- **The SBC must route the DID here**, with UDP 5060 and an RTP range published
  on the host. Today the switch owns queueing; this is the portal taking over
  call routing for one DID.

## Carried risk

Every page except login talks to `/api/*` forwarded to `ENGINE_URL`. The
"complete without an engine" property `Portal.AuthController` bought — a login
that depends on nothing being reachable — does **not** extend to this app: it
signs in standalone and then the screens are empty without the mothership.
Phase 4 is the first thing that makes the portal itself a source of call data.
