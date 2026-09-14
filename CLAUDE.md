# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**This is a pure-BEAM app.** There is no Node, no Vite, no React anywhere in
this stack — the React SPA this repo used to ship was removed. `connectix/`
(a Phoenix/Elixir app) is the whole product: it serves the LiveView UI, the
realtime socket, and the API forwarder from one process, on one port.

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
| `make test` | `mix compile --warnings-as-errors` then the Elixir suite, in Docker — `TEST=path/pattern` narrows it |
| `make ci` | Run the CI workflow locally with `act` — `JOB=portal\|prod-image\|all` |
| `make iex` / `make tui` / `make tmux` | Cockpit — attach a shell to the running portal, a live terminal dashboard, or a three-pane log+health view |
| `cd ../mothership && make portal-deploy DEST=nimbus` | Deploy Nimbus through the mothership-owned Kamal policy |

**Never deploy.** Building, testing and probing a production image locally is
fine; `portal-deploy`, `kamal deploy`, pushing an image tag anything reads as
`:latest`, and recreating a container on a live host are the operator's calls,
not an agent's. Say what the command is and let a human run it.

`DEST` is required for exactly this reason: without it kamal falls back to
`config/portal/deploy.yml`, which is a **different live host** with a
**different image** from every named destination. A dropped `DEST=` does not
fail — it deploys somewhere else, and the first symptom is a timeout against a
host nobody meant to touch. The Makefile refuses rather than guessing.

## The local stack

`make dev` starts the portal — the whole app, one container.

The cable is NOT part of it: the portal dials a real va-crystal node directly
(`PORTAL_CABLE_URL`), local by default. Neither is the Chrome extension, which
lives in `../chrome` with its own Makefile — `make -C ../chrome build`, then
load `../chrome/angular/dist` unpacked.

| Service | Port | What it is |
|---|---|---|
| `elixir` | **4001** | The portal — **the origin, and the whole app**. Serves the LiveView UI and `/ws/events`, verifies tokens, holds the cable connection, forwards `/auth` · `/api/` · `/tasks/` to the mothership. |

**4001 is the origin and does not move.** The LiveView UI and the Chrome
extension both point at it, and neither should ever have to change.

**Everything uses `network_mode: host`**, because cable and NATS are published
on the host's loopback and a bridged container cannot see `127.0.0.1`.

### Local by default, deliberately

The portal's `ENGINE_URL` and `CABLE_URL` are scoped to their own variables
(`PORTAL_ENGINE_URL`, `PORTAL_CABLE_URL`) and default to local. They
deliberately do **not** fall back to `MOTHERSHIP_URL`: that is the
local-production fallback and may name the cloud, so the old chain silently
pointed the portal at production while the cable and broker beside it stayed
local — which presented as a login failing for a user who exists locally.

### The login pipeline

A login from the Chrome extension takes one path, and every hop is local except
the last:

```
Chrome extension
  │  POST /auth/user_login          (same origin it opens its socket on)
  ▼
Elixir portal            :4001      ../app/connectix
  │  cable frame: {action:"request", id, method, path, body}
  ▼
va-crystal cable         :4100      ../va-crystal, ApiProxy channel
  │  HTTP to API_URL
  ▼
Ruby API                            the remote server — the login database
```

**va-crystal performs the login, not Elixir.** The portal holds no user
database; it hands the request to the cable and waits for the reply. The node
forwards it to `API_URL` and transmits the response back to that one
subscriber. Nothing is stored on the way through — no session, no cache, no
`STATE` write.

**There is still an HTTP fallback, and it is not a hedge.** The relay needs a
node carrying the `ApiProxy` channel with `CABLE_API_PROXY=1`, and that is not
true of every deployed node — the channel ships in an image, and old images are
everywhere. `Plugs.EngineProxy` tries cable first and falls back to
`ENGINE_URL` over HTTP; a portal that answered 502 against an older node would
be a worse regression than one HTTP hop. It falls back only when *this hop*
failed, never on a status the API itself returned: a relayed 401 is a
successful relay.

Which one served a request is in the log — `proxy: POST /auth/user_login -> 401
via cable`, or `via <host>`. Worth reading before concluding anything about the
transport, because both paths return the same body.

**A node without the channel is silent, not loud.** Cable has no frame for "no
such channel": `Connection#subscribe` raises `Missing hash key: "ApiProxy"` and
transmits nothing back — no rejection. `Realtime.ApiProxy` therefore times the
silence and logs an error five seconds after an unconfirmed subscribe, because
the only other symptom is that every login quietly takes the HTTP path.

The bootstrap is not circular even though a credential is needed to open the
cable, because the *browser's* credential is not what opens it. The portal
opens one connection with its own account credential; every user login then
rides over that already-authenticated socket. A browser credential never
reaches the node.

Two details that look optional and are not:

- **`id` is mandatory and echoed.** One connection carries every user's
  requests concurrently, so a reply is matched to its request by `id` alone.
  An implementation without it passes a single-request test and interleaves
  wrongly the moment two people log in at once.
- **The proxy is off unless `CABLE_API_PROXY=1`.** It is a new inbound surface
  on a node that otherwise accepts nothing but health and config, so deployed
  nodes must not acquire an API relay just by taking an image upgrade. Its
  path allowlist (`/auth`, `/api/`, `/tasks/`) mirrors the portal's
  `@engine_prefixes`.

The full frame contract, error table and limits are in
`docs/cable-api-proxy-spec.md`.

## Architecture (big picture)

One runtime piece: **the Elixir portal** (`connectix/`, :4001) — the origin
and the whole app. A `WebSock` handler at `/ws/events` (not a Phoenix Channel:
the contract is a plain JSON frame protocol), one application Cable connection
plus per-user Cable connections fanned out over `Phoenix.PubSub`, token
verification through the node's `ApiProxy` channel, and a Phoenix LiveView UI
(`ChatLive` at `/chat`, gated by `ConnectixWeb.Plugs.BasicAuth` — see
`connectix/CLAUDE.md` for the LiveView/Bot-first conventions). Elixir holds no
direct NATS connection. `ConnectixWeb.Plugs.EngineProxy` forwards the
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
while the LiveView equivalent was being restored; it too is gone — the
LiveView UI is the UI now.

**What that leaves unserved**, until each lands in Elixir: `/dashboard/*`,
`/events`, `/transcript`, and the `/rest/v1` PostgREST plane. Those routes
404. The git history has the Deno implementation and the React SPA if either
is wanted as a reference — `git log` on `src/`, `package.json`, `vite.config.js`.

There is **no Supabase** — auth is mothership accounts + a JWT, or (for the
LiveView UI specifically) HTTP Basic Auth — see `connectix/CLAUDE.md`.

## Environment

Env is the whole tenant-configuration surface — see `.env.example` (documented
inline). The local stack keeps the portal and cable on the API at port 5000 by
default; change `PORTAL_ENGINE_URL` and `CABLE_API_URL` together when that API
lives elsewhere. Production Kamal destinations set `ENGINE_URL` in mothership.

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

**The cable client outlives one browser socket, so the FIRST connect is the
only one that ever supplied agent ids — and it is the one most likely to have
none.** A user created minutes before they log in has no `powerlink_token`
yet, so the client starts with `agent_ids: []` and refuses every pop for as
long as it lives; logging in again does not help, because `ensure_cable/1` sees
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

### Monitoring

`/health` (unauthenticated, no content negotiation) reports `cable`,
`api_relay`, `engine`, `events` and `disk`, with numbers on the disk check so a
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
never armed: when a NAT or load balancer drops an established cable connection
there is no close frame and no error, `Mint` reports nothing, and the process
holds a dead socket until something restarts it. Default TCP keepalive is two
hours, which is why the symptom was "notifications stop after a few hours".
Both cable connections now treat 60s of silence as death. The singleton
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
