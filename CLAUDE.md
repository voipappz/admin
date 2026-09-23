# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**WHAT SHIPS IS PURE BEAM.** `connectix/` (a Phoenix/Elixir app) is the whole
runtime: one process, one port, serving the UI, the realtime socket and the
API forwarder. The release image carries no node, no npm and no
`node_modules`, and the React SPA this repo used to ship is gone.

**Two clients are BUILT here, in node, and they leave in different ways.**

| | | | |
|---|---|---|---|
| `chrome/` | Angular 11, node:20 | `make extension` | **compiled to a zip.** Not served — `/release/download` hands over the archive, and Chrome runs it from a folder the user unzipped. |
| `ionic/` | Angular 21 / Ionic 8 / Capacitor 6, node:22 | `make app` | **THE ONE THING THIS PORTAL SERVES.** Bundled into `connectix/priv/app` and served at **`/app`**, same-origin with `/auth`, `/api` and the socket. |

The difference matters: the extension is a download, so a stale one can sit in
somebody's folder for weeks; the app is inside the release, so deploying the
portal deploys the UI and the two cannot drift.

Each has its own `package.json`, its own container and its own `node_modules`
volume; node lives and dies in a build stage (`Dockerfile.production`'s
`extension` and `ionic` stages) and the final image copies one zip and one
directory out. "Pure BEAM" is a property of what **ships**, and it still holds
— but "there is no node in this repo" stopped being true and was worth
correcting rather than working around.

**VoipAppZ portal** — a VoIP/telecom portal for **users** — access is
user-based (user → permissions → environments); no tenant model in the app.
The app talks to **one backend: the voipappz-api "mothership"**, always
same-origin through the portal's forwarder. A customer deployment (fork)
changes **env, not code**.

- **Elixir/Phoenix conventions, Bot-first design, Sagents, LiveView guidelines** → [connectix/CLAUDE.md](./connectix/CLAUDE.md) — read that file before working inside `connectix/`; this file covers the top-level repo shape, deployment and env instead of duplicating it.
- **How it fits together** → [docs/architecture.md](./docs/architecture.md)
- **How to deploy** (Docker-only) → [docs/deployment.md](./docs/deployment.md)

## Commands

| Command | Description |
|---|---|
| `make env` | Create `.env` (never overwrites an existing one) |
| `make dev` | Run the local stack in Docker — portal :4001, attached logs. The usual loop; needs only Docker. |
| `make up` / `make down` | Same stack, detached |
| `make logs` | Follow the portal's logs |
| `make health` | Where it is, whether it answers, and whether events are arriving |
| `make app` | Build the Ionic app and bundle it into the portal — served at `/app` |
| `make extension` | Build the Chrome extension into `chrome/angular/dist` |
| `make test` | `mix compile --warnings-as-errors` then the Elixir suite, in Docker — `TEST=path/pattern` narrows it |
| `make ci` | Run the CI workflow locally with `act` — `JOB=portal\|prod-image\|all` |
| `make iex` / `make tui` / `make tmux` | Cockpit — attach a shell to the running portal, a live terminal dashboard, or a three-pane log+health view |
| `make deploy DEST=connectix` | Deploy — the Kamal policy lives in THIS repo now (`config/deploy.*.yml`, `.kamal/`), not the mothership |

**Never deploy.** Building, testing and probing a production image locally is
fine; `kamal deploy`, pushing an image tag anything reads as `:latest`, and
recreating a container on a live host are the operator's calls, not an agent's.
Say what the command is and let a human run it.

`DEST` is required for exactly this reason: without it kamal falls back to
`config/deploy.yml`, which is a **different live host** with a **different
image** from every named destination. A dropped `DEST=` does not
fail — it deploys somewhere else, and the first symptom is a timeout against a
host nobody meant to touch. The Makefile refuses rather than guessing.

## The local stack

`make dev` starts the portal — the whole app, one container.

There is no broker and no relay: the portal connects to **FreeSWITCH's own
Event Socket** (`mod_event_socket`, :8021) and consumes the switch's events
first-hand. The switch is named in the mounted customer rule
(`freeswitch.host`), its password in `FREESWITCH_ESL_PASSWORD`; `ESL_URL` is
the fallback for a deployment without the file. The Chrome extension is not
part of the stack, and lives in `../chrome` with its own Makefile —
`make -C ../chrome build`, then load `../chrome/angular/dist` unpacked.

| Service | Port | What it is |
|---|---|---|
| `elixir` | **4001** | The portal — **the origin, and the whole app**. Serves the LiveView UI and `/ws/events`, performs the login, verifies its own tokens, consumes events from the switch, forwards the rest of `/auth` · `/api/` · `/tasks/` upstream. |

**4001 is the origin and does not move.** The LiveView UI and the Chrome
extension both point at it, and neither should ever have to change.

**Everything uses `network_mode: host`**, because the broker is published on
the host's loopback and a bridged container cannot see `127.0.0.1`.

### Local by default, deliberately

The portal's `ENGINE_URL` is scoped to its own variable
(`PORTAL_ENGINE_URL`) and defaults to local. It
deliberately do **not** fall back to `MOTHERSHIP_URL`: that is the
local-production fallback and may name the cloud, so the old chain silently
pointed the portal at production while the broker beside it stayed
local — which presented as a login failing for a user who exists locally.

### The login pipeline

A login from the Chrome extension takes one hop, and it ends here:

```
Chrome extension
  │  POST /auth/user_login          (same origin it opens its socket on)
  ▼
Elixir portal            :4001      ConnectixWeb.Portal.AuthController
```

**THE PORTAL PERFORMS THE LOGIN.** It checks the credential against the agents
named in `connectix/priv/pocketflow/screen_pop.yaml`, mints a token, and
answers in the shape the extension already parses. Nothing upstream has to be
reachable, correct, or signing with a key this app agrees with.

It used to be forwarded to a mothership, and that put the one thing every
session depends on outside the app. When the upstream was wrong the failure
arrived as a login that simply did not work, with nothing local to inspect —
measured: `nimbus-prod` answered 500 to real credentials and
`cloud.voipappz.io` answered 401, both confirmed by calling them directly,
bypassing the portal.

**The token's `user_uuid` IS the agent's powerlink uuid.** The switch names an
agent by that value and publishes their state to `state.user.<powerlink>`, so
issuing it directly removes the lookup, the mapping step and the failure mode
where the two resolve apart and every frame is dropped as unattributable.

Two consequences worth knowing:

- **Verification is local.** `Realtime.Jwt` derives its signing key from the
  endpoint's `secret_key_base` (HMAC'd with a purpose string, so it shares no
  bytes with Phoenix's cookie key) and both mints and verifies with it. Expiry
  is checked, which the node's own verifier never did. Nothing is asked of
  anyone on the critical path of a socket open.
- **An entry with no password is a mapping only** and refuses to sign in,
  rather than accepting anything. `AGENT_PASSWORD` names the credential;
  unset, every agent refuses.

`/auth/user_login` and `/api/users/:uuid` are answered here
(`@portal_owned` in `Plugs.EngineProxy`); the rest of `/auth`, `/api/` and
`/tasks/` still forward to `ENGINE_URL` when one is set, and the portal is
complete without it.

**A route that moves into this app must stay in the CORS policy.** The
forwarder is what answers preflights and sets `access-control-allow-origin`,
and the extension's origin is a `chrome-extension://<id>` no upstream allowlist
can name. Moving `/auth/user_login` here silently moved it out of that policy:
it answered 200 to curl and was blocked by every browser. Portal-owned paths
are dressed on the way out for exactly that reason.

## Architecture (big picture)

One runtime piece: **the Elixir portal** (`connectix/`, :4001) — the origin
and the whole app. A `WebSock` handler at `/ws/events` (not a Phoenix Channel:
the contract is a plain JSON frame protocol), one Event Socket connection to
FreeSWITCH (`Realtime.EslProducer`, a Broadway producer on the `switchx`
client) fanned out over `Phoenix.PubSub`, local token verification, and a
Phoenix LiveView UI (`ChatLive` at `/chat`, gated by
`ConnectixWeb.Plugs.BasicAuth` — see `connectix/CLAUDE.md` for the
LiveView/Bot-first conventions). Elixir holds no broker connection: the
switch is the source, and `docs/freeswitch-esl-consumer.md` records why the
NATS consumer was retired. `ConnectixWeb.Plugs.EngineProxy` forwards the
mothership's own routes (`/auth`, `/api/`, `/tasks/`) upstream, and **owns
the CORS policy on them**: the extension's origin is a
`chrome-extension://<id>` no upstream allowlist can name, so the upstream's
headers are dropped and replaced rather than copied through.

In development it runs from the Dockerfile's `dev` stage against the mounted
source, so an edit reloads instead of needing a rebuild. The release stages
above it are what ships (`Dockerfile.production`, single-stage: the Phoenix
release alone, no frontend build).

**There have been two prior "second pieces", and both are gone.** A Deno BFF
(`api/`) used to sit behind the portal serving Dashboard extras — the DuckDB
event projection, calls-per-hour, the dashboard/widget store, transcript
reads, an event inspector and a read-only MCP surface. It was deleted when
Elixir took over the origin. Later, a React SPA (`src/`) served as the UI
while the LiveView equivalent was being restored; it too is gone.

**The Ionic app at `/app` is not a third one of those.** The difference is
that it is not a second SERVER: it is static files inside this release, served
by this origin, with no process, port or deploy of its own. It is also
intended to become THE UI — the LiveView `/chat` retires when the Ionic app
reaches parity on the agent chat, and not before, because `ChatLive` is also
the only UI for the softphone. What is decided and what is left is in
`docs/ionic-app.md`.

**What that leaves unserved**, until each lands in Elixir: `/dashboard/*`,
`/events`, `/transcript`, and the `/rest/v1` PostgREST plane. Those routes
404. The git history has the Deno implementation and the React SPA if either
is wanted as a reference — `git log` on `src/`, `package.json`, `vite.config.js`.

There is **no Supabase** — auth is mothership accounts + a JWT, or (for the
LiveView UI specifically) HTTP Basic Auth — see `connectix/CLAUDE.md`.

## Environment

Env is the whole tenant-configuration surface — see `.env.example` (documented
inline). The `freeswitch:` block in the customer's rule file (host) and
`connectix/priv/pocketflow/screen_pop.yaml` (events, deadman, the password's
variable name) decide where events come from; `ESL_URL` is the fallback.
Production Kamal destinations set `ENGINE_URL` in mothership.

- Editing `.env` + `docker compose restart` does **not** re-read env vars — use
  `docker compose up -d --force-recreate <service>`.
- **A container reaches a host process at `172.18.0.1`, not
  `host.docker.internal`** (on WSL the latter resolves to the Windows host, and
  nothing answers). It fails as a timeout, so it reads as "the service is down".
  This is what silently broke the screen-pop e2e: the API could not reach the
  CRM stub, so `ScreenPopPopNode#exec` returned false before publishing and no
  notification was ever emitted.
- **`#` starts a comment inside a make *variable*** (not inside a recipe). A
  `sed 's#a#b#'` in a variable truncates mid-quote and fails as "Unterminated
  quoted string" with nothing pointing at the line. Use another delimiter.
- **Never use `${VAR:?...}` in `docker-compose.yml`.** Compose interpolates the
  whole file on every invocation, before it consults profiles — so a required
  variable on an opt-in service aborts every unrelated target, including
  `make dev`. Put the check in the Makefile target that starts the service.

## Conventions

- Elixir/Phoenix code, tests and LiveView conventions live entirely in
  [connectix/CLAUDE.md](./connectix/CLAUDE.md) — read it before editing
  anything under `connectix/`.
- Prefer simple solutions; exhaust existing patterns before introducing new
  ones. Never add fake/stub data outside tests. Never overwrite `.env` without
  confirmation.

## Running this in production — what was measured

Everything below was measured on the `connectix` destination
(nimbus-connectix.voipappz.io), not reasoned about. Each item cost real
debugging time; none of it is discoverable from the code alone.

### The screen pop

**Identity is the `powerlink_token`, and it is resolved once per socket
connect.** The switch names an agent by `meta.CC-Agent` — which it also copies
to `user_uuid` and into the event `id`'s last segment — and that value is the
user's `profile.powerlink_token`, never the portal uuid.

**This was the "pops never fire" bug, before the portal issued its own
tokens.** A user created minutes before they log in has no `powerlink_token`
yet, so the client starts with `agent_ids: []` and refuses every pop for as
long as it lived; logging in again did not help, because the old per-user
connection was already started and kept its empty list. The token carries the
agent id now, so there is nothing to resolve apart.
`{:already_started, _}`. It now hands the ids over instead. This was the "pops
never fire" bug, and the symptom is total silence, not an error.

**One trigger: `bridge-agent-start`.** The dedupe key is per
`(event name, agent, call)`, so accepting two spellings of the same fact pops
twice — `agent-offering` and `bridge-agent-start` for one call opened two tabs.
`agent-offering` also fires once per agent the queue *tries*, so one caller
ringing four agents would open a CRM record for three people who never took
the call. `agent-state-change` into "In a queue call" is the same fact a third
time and carries no call id to dedupe against, so it stays out until the key is
call-scoped.

**The rule file is the gate, and it runs first.** `priv/pocketflow/screen_pop.yaml`
names the events that pop, and a CallEvents or state frame whose name is not
in `triggers` is dropped before it is stored, before the agent lookup and
before any log line (`PopRule.trigger?/1`, counted as `ignored` in /metrics).
Measured on nimbus-connectix: evaluating and logging "no pop — not one of
[...]" for every `agent-offering`, `bridge-agent-fail` and `agent-state-change`
of every signed-in agent was most of the log and a good share of the CPU, and
it never changed an outcome. Add a name to `triggers` to make the portal look
at that event at all.

**`call_id/1` falls back to the event's own `id`**, which the switch builds as
`<action>_<session>_<member>_<agent>`. So anything derived from it silently
changes meaning when the trigger changes. That is why the CRM URL carries only
`{phone}`.

A frame arriving does not mean it arrives promptly: the node delivered one
call's entire event burst ~18 seconds AFTER the call ended.

### The event store

**Volume is the whole story.** A live switch produced ~146,000 rows and ~556MB
of raw JSON a DAY. 86% of it was `complete` frames at 8.6KB each and another 7%
`custom` — FreeSWITCH channel variables (`variable_*`), which nothing reads.
Trimming them took `complete` from 8,953 to 320 bytes, a 28× cut. `headers`
stored them too, so every frame counted twice.

**DuckDB has no TTL and never returns disk.** Measured on a copy of the live
store, v1.5.5: 39,865 rows occupied 348MB; deleting half left it at 348MB;
`CHECKPOINT` and `VACUUM` changed nothing. Freed space is reused by later
inserts, so pruning bounds growth but cannot shrink a file that has already
ballooned — hence compaction, which rewrites live rows into a fresh file.

**`Events.recent/1` silently caps at 1000 rows** and `search/2` does a `LIKE`
scan that can exceed its own 15s call timeout — and when it does, every other
call queues behind it and times out too, including `stats/0`, which then
reports the store as closed. Both of these produced confidently wrong
conclusions during debugging. Prefer `Events.open?/0` (a `:persistent_term`
read) on any hot path.

### Deploys

**Kamal starts the new container, health-checks it, and only THEN stops the
old one** — so both run for a few seconds and DuckDB, being single-writer,
refuses the loser. It used to give up permanently and store nothing for the
life of that container; it now retries every 5s and recovers in about one
attempt, visible as `events: storing to … (opened on retry)`.

**buildkit's push to the registry hangs on this network** — three deploys froze
at `exporting to registry` with zero bytes of traffic and 0% CPU for minutes,
each having built the release successfully. `docker push` moved the same image
first try. Hence `builder: driver: docker` for this destination. MTU is 1500
everywhere, so it is the builder container's egress, not fragmentation.

**Kamal tags images by commit SHA**, so rewriting history orphans the tag of a
running container. Redeploy afterwards to restore traceability.

An SSH timeout while *releasing the deploy lock* is not a failed deploy — check
what is actually running before retrying.

### Troubleshooting a "disconnected" agent

`make tui` attaches to the local portal; `make tui YAML=config/deploy.connectix.yml`
(or `DEST=connectix`) attaches to the portal that kamal file deploys, through
`kamal app exec` and shows one row per signed-in agent: browser sockets,
socket age, last pong, the subjects subscribed,
reconnect attempts, and the last socket closes with reason and lifetime.
`x` kicks the agent's socket (the extension reconnects in ~3s), `c` reopens
the upstream subscription. The same data is `Realtime.Inspector.snapshot/0`
from `make iex`, and every socket close is now a log line:
`session: closed <user> after 1h29m (:remote)`.

What the 2026-09-14 investigation established from the portal and
kamal-proxy logs on nimbus-connectix: the server side was not dropping
anything at the 1–2 hour mark (no liveness reconnects, upstream errors only on
a node restart). Browser sockets lived 1h29m and 1h37m and were closed from
the BROWSER side about one second after the agent opened the popup; the agent
then logged in again by hand 25–40s later. The portal never refused those
sockets. So the trail to follow next is on the extension side, and the
`socket closes` pane is where the reason and lifetime now show up.

### Monitoring

`/health` (unauthenticated, no content negotiation) reports `freeswitch`,
`engine`, `events` and `disk`, with numbers on the disk check so a
monitor can alert BEFORE the floor. `/health/ready` deliberately does NOT fail
on low disk: it is the deploy gate and the load-balancer signal, and failing it
would take the site down and block the deploy that might fix it.

`/metrics` is Basic Auth'd (`:admin` pipeline, no `:accepts` — a scraper sends
no Accept header and would get 406). It carries host disk/CPU/load/memory and
BEAM gauges from `:os_mon`, so the node is its own collector and needs no
telegraf or node_exporter.

`Connectix.Heartbeat` pushes to an Uptime Kuma **push** monitor with the reason
attached (`down / disk: 8% free on /data`), which a `curl` healthcheck cannot
express — and the release image has neither `curl` nor `wget`.

**A connection can die without saying so.** `@recv_timeout` was declared and
never armed: when a NAT or load balancer drops an established connection
there is no close frame and no error, `Mint` reports nothing, and the process
holds a dead socket until something restarts it. Default TCP keepalive is two
hours, which is why the symptom was "notifications stop after a few hours".
The Event Socket producer monitors both its connection process and the socket
port (the client library swallows `tcp_closed`), reconnects with backoff, and
reads FreeSWITCH's 20-second `HEARTBEAT` under a one-minute deadman;
`/health` reports `freeswitch` down in between. The old singleton
`ApiProxy` is the worse one to lose: it carries `CallEvents` for every user, so
its death looks exactly like a quiet switch.

### The host

20GB volume shared by the DuckDB store, Mnesia and Docker's images. It reached
95% used with 1GB free while `/health/ready` answered 200 — six deploys' worth
of 1.18–2.17GB images plus an untrimmed event store. Prune images as well as
events; `docker system df` shows what is reclaimable.

Load reached 15 on 4 cores under event ingestion, with `ApiProxy` the dominant
consumer — decoding the firehose, not writing it. The trim reduces write cost,
not decode cost.
