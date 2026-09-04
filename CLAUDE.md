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

**Everything uses `network_mode: host`**, because cable, NATS and Postgres are
published on the host's loopback and a bridged container cannot see
`127.0.0.1`.

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
