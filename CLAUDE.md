# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**VoipAppZ portal** — a React 19 + Vite portal for VoIP/telecom **users** — access is user-based (user → permissions → environments); no tenant model in the app.
The app is component-based and talks to **one backend: the voipappz-api
"mothership"**, always same-origin through the app server (Vite proxy in dev,
the Elixir portal's forwarder in prod). A customer deployment (fork) changes
**env, not code**.

- **How it fits together** → [docs/architecture.md](./docs/architecture.md)
- **How to add a feature** (service → hook → component recipe, data-access layer, feature flags) → [DEVELOPING.md](./DEVELOPING.md)
- **How to deploy** (Docker-only) → [docs/deployment.md](./docs/deployment.md)

## Commands

| Command | Description |
|---|---|
| `make env` | Create `.env` (never overwrites an existing one) |
| `make dev` | Run the whole local stack in Docker — Vite :4200 · portal :4001 · cable :4100, attached logs. The usual loop; needs only Docker. |
| `make up` / `make down` | Same stack, detached |
| `make cable` / `make cable-down` | Just va-crystal's cable on :4100 (opt-in profile; needs the API container running) |
| `make lint` / `make unit` | ESLint / Vitest one-shot — run in Docker (host `npm run lint` / `npm test` also work if you have node) |
| `make portal-compile` / `make portal-test` | Compile with warnings as errors / run ExUnit in the running Elixir container |
| `make test` | Playwright E2E in Docker — needs the app running; use `VITE_MOCK_LOGIN=1 make up` first for the offline suite |
| `make act-portal` / `make act` | Run the Elixir portal job / complete CI workflow locally with `act` (auto-installs to `/tmp` when absent; never imports `.env`) |
| `make build` | Production bundle → `dist/`, built in Docker. Must be clean before shipping. |
| `make verify` | Health check: the portal's `/health` probes, Vite and the cable |
| `make prod` / `make prod-down` | Run the production image on this box via docker compose (:8000) |
| `cd ../mothership && make portal-deploy DEST=nimbus` | Deploy Nimbus through the mothership-owned Kamal policy |

## The local stack

`make dev` starts the web, portal, cable and extension containers. They only work as a set, because the portal
verifies tokens against the API and listens on the cable — point any one of them
somewhere else and the failures look like broken auth rather than a mismatched
host.

| Service | Port | What it is |
|---|---|---|
| `react-app` | 4200 | Vite HMR. Proxies backend requests to the Elixir portal. |
| `elixir` | **4001** | The portal — **the origin**. Serves the SPA and `/ws/events`, verifies tokens, holds the cable connection, forwards `/auth` · `/api/` · `/tasks/` to the mothership. |
| `cable` | 4100 | va-crystal's node, `nirlevi/voipappz-crystal:latest`. The realtime endpoint the portal subscribes to. |

**4001 is the origin and does not move.** The SPA, the Chrome extension and
Vite's proxy all point at it, and none of them should ever have to change.

**Everything uses `network_mode: host`**, because cable (4100), NATS (4222) and
Postgres (5432) are published on the host's loopback and a bridged container
cannot see `127.0.0.1`.

### The cable, and why it is fiddly

`make cable` reads the API's `SECRET_KEY` and `NATS_URL` out of the running API
container (`API_CONTAINER`, default `va-app`) and passes them as environment —
neither belongs in this repo. It refuses to start without the secret on purpose:
cable would otherwise come up, answer `/health`, and reject every connection.

**The portal needs no secret of its own.** A cable connection authenticates with
a `?token=` the node verifies against its own `SECRET_KEY`, and it accepts a
mothership user token — so the login the browser already did *is* the cable
credential. `CABLE_TOKEN` exists only for a userless server-side tap.

The image is the legacy `nirlevi/voipappz-crystal:latest`, not the stack image:
its entrypoint runs the node binary alone, so it can share a box with an
installed node instead of fighting it for 5060/5080/8021. Five things are fatal
at const-init, each with a message that points away from the cause — all are set
in `docker-compose.yml` with a comment saying what breaks without them:
`SECRET_KEY`, `LICENSE_JWT_SECRET`, `LICENSE_ENCRYPTION_KEY`, `VA_PATH`
(→ `config/cable/va.yaml`), `FREESWITCH_PASSWORD`. A sixth is worse: bad NATS
credentials are retried ten times and then **downgraded to a warning**, so the
cable keeps running and silently delivers nothing.

**The node has no account credential for the API.** Every call it makes is
identified by `NODE_UUID` alone (`GET {API_URL}/switch/api/crystal/...`) — there
is no account, token or basic-auth path anywhere in va-crystal's source. So
`CABLE_API_URL` only answers usefully if `NODE_UUID` names a node registered on
that server, and pointing the cable at a remote API also means its `SECRET_KEY`
must be *that* API's signing secret, or every user token fails to verify.

**Do not edit `../va-crystal` and do not build it here.** It is a separate repo
on Bitbucket with its own install path; this compose consumes a published image.

### Local by default, deliberately

The portal's `ENGINE_URL` and `CABLE_URL` and the cable's `API_URL` are scoped
to their own variables (`PORTAL_ENGINE_URL`, `PORTAL_CABLE_URL`,
`CABLE_API_URL`) and default to local. They deliberately do **not** fall back to
`MOTHERSHIP_URL`: that is the local-production fallback and may name the cloud,
so the old chain silently pointed the portal at production while the cable and
broker beside it stayed local — which presented as a login failing for a user
who exists locally.

### The login pipeline

A login from the Chrome extension takes one path, and every hop is local except
the last:

```
Chrome extension
  │  POST /auth/user_login          (same origin it opens its socket on)
  ▼
Elixir portal            :4001      ../app/agents_demo
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

Two runtime pieces:

1. **React app** (`src/`, Vite :4200). All backend access goes through the
   mothership over the Vite proxy. Data-access layering is strict:
   - `src/lib/auth.ts` — the one credential (login JWT in `localStorage`, session helpers).
   - `src/lib/clients/` — transport: `api.ts` (`apiList`/`apiGet` — adds the Bearer token, reads `X-Total`, drops the session on 401), `mothership.ts` (two-step login: password → optional per-customer OTP), `customerPortal.ts` (public branding).
   - `src/services/` — one module per backend feature (`callsApi.js`, `reportsApi.js`, `featuresApi.js`): knows the endpoint, query params, and row normalization.
   - `src/components/<Feature>/` — folder-per-component with its own hook (`useCalls.js` pattern). Components never build URLs or set headers.

   **`Calls` is the blueprint feature** — replicate its service → hook →
   component shape for new pages (full recipe in DEVELOPING.md).

2. **The Elixir portal** (`agents_demo/`, :4001) — the origin. A `WebSock`
   handler at `/ws/events` (not a Phoenix Channel: the contract is a plain JSON
   frame protocol), one upstream cable connection fanned out over
   `Phoenix.PubSub`, and token verification as a **NATS request/reply** to the
   API — never over HTTP. `AgentsDemoWeb.Plugs.EngineProxy` forwards the
   mothership's own routes (`/auth`, `/api/`, `/tasks/`) upstream, and **owns
   the CORS policy on them**: the extension's origin is a
   `chrome-extension://<id>` no upstream allowlist can name, so the upstream's
   headers are dropped and replaced rather than copied through.

   In development it runs from the Dockerfile's `dev` stage against the mounted
   source, so an edit reloads instead of needing a rebuild. The release stages
   above it are what ships.

**There is no third piece.** A Deno BFF (`api/`) used to sit behind the portal
serving Dashboard extras — the DuckDB event projection, calls-per-hour, the
dashboard/widget store, transcript reads, an event inspector and a read-only
MCP surface. It was deleted when Elixir took over the origin, rather than kept
as a second backend nobody would finish migrating.

**What that leaves unserved**, until each lands in Elixir: `/dashboard/*`
(`src/services/dashboardsApi.js` — the Dashboard builder), `/events`
(`src/services/duckdbEventsApi.js` — the Event Explorer), `/transcript`, and
the `/rest/v1` PostgREST plane. Those screens 404. Everything else the SPA
calls is `/api/*`, which is forwarded to the mothership and was never Deno's.
The frontend code for them is intentionally still here; the git history has the
Deno implementation if it is wanted as a reference.

There is **no Supabase** — auth is mothership accounts + a JWT.

## Environment

Env is the whole tenant-configuration surface — see `.env.example` (documented
inline). The local stack keeps the portal and cable on the API at port 5000 by
default; change `PORTAL_ENGINE_URL` and `CABLE_API_URL` together when that API
lives elsewhere. Production Kamal destinations set `ENGINE_URL` in mothership.

- **The browser never carries a backend host.** Clients build relative URLs;
  the Vite proxy (dev) or the portal's forwarder (prod) owns the actual
  mothership host. `VITE_MOTHERSHIP_URL` is the direct-mode escape hatch for static-only
  hosting (e.g. the Fireberry embed) — leave it unset otherwise.
- **Never set `VITE_API_BASE_URL` in dev** — it bypasses the Vite proxy and
  trips CORS.
- **Never `VITE_`-prefix a secret** — `VITE_*` is baked into the public browser
  bundle; server-side vars (the cable secret, NATS credentials) must stay
  unprefixed.
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
- `VITE_MOCK_LOGIN=1` gives an offline login (any email, OTP `123456`) for
  frontend work with no backend, and is what the CI E2E job builds with so
  Playwright can drive the real login flow hermetically (no credentials, no
  network). It deliberately mirrors the mothership's two-step user-OTP shape
  (the server's `VA_TEST_OTP` knob) and returns a user with
  `extension`/`environment`, so post-login paths (session decode, SIP
  derivation) are exercised too. It is a **build-time** flag: production
  builds never set it, so the shipped bundle can't be toggled into mock auth.

## Conventions

- Folder-per-component (`Component.jsx` + hooks + css together), components
  under ~300 lines, don't share hooks between components.
- i18n via `react-i18next` — Hebrew (RTL) is the default; use `useTranslation()`
  for copy and `useDirection()` for layout. UI is MUI 7 + Radix/shadcn +
  Tailwind.
- Unit tests (Vitest) target service modules and hooks, mocked at the
  `apiList`/`apiGet` boundary — never the network. Playwright specs live in
  `tests/` (Input → Submit → capture response → assert).
- Elixir tests (ExUnit) live in `agents_demo/test/`; plug tests drive the plug
  directly with `Plug.Test` and stand up a real upstream when they need one —
  no network to the platform.
- Prefer simple solutions; exhaust existing patterns before introducing new
  ones. Never add fake/stub data outside tests. Never overwrite `.env` without
  confirmation.
