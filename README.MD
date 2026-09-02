# VoIPAppz portal

A **React + Vite** portal for VoIP/telecom tenants, built as reusable components
on top of the **voipappz-api mothership**. A tenant fork changes **env, not
code** — repoint the mothership with one var (`MOTHERSHIP_URL`) and the same app
lights up against that tenant's data (login, calls, reports, feature flags).

- **Documentation index** → [docs/README.md](./docs/README.md)
- **Building a feature?** → [docs/modules.md](./docs/modules.md)
- **How it fits together?** → [docs/architecture.md](./docs/architecture.md)
- **What is tested?** → [docs/testing.md](./docs/testing.md)
- **Repo conventions / gotchas?** → [CLAUDE.md](./CLAUDE.md)

---

## Start a tenant fork (this repo is a GitHub template)

```bash
gh repo create my-tenant-portal --template voipappz/app --private --clone
cd my-tenant-portal
make env                      # writes .env — set MOTHERSHIP_URL to your tenant
make dev                      # the whole stack in Docker
```

(Or click **Use this template** on GitHub.) A tenant fork changes **env, not
code** — branding, endpoints, and features are all `.env`-driven, and the
included GitHub Actions CI works out of the box in the new repo.

---

## Quick start

```bash
cp .env.example .env          # defaults work out of the box (cloud mothership)
make dev                      # → http://localhost:4200  (everything runs in Docker)
```

**Docker is the only requirement** — no local node/npm needed. Log in with a
real mothership user (or `VITE_MOCK_LOGIN=1 make up` for an offline login with
any email + OTP `123456`). Prefer host tooling? `npm install && npm run dev`
works too.

Every push is guarded by the repository's `.githooks/pre-push` hook. `npm
install` configures it automatically. Run the identical gate manually with
`npm run verify:push`. It covers ESLint, frontend unit tests, a clean Elixir
compile, a production build, and the mock-login browser flow through Dashboard,
Calls, and Reports.

## How it works

The browser always uses relative, same-origin URLs. In development Vite proxies
them to the Elixir portal; in production that same portal serves the built React
app and forwards the same routes. One origin, either way.

```text
Browser ──► Vite :4200 (dev only) ──► Elixir portal :4001
                                        ├─ /auth, /api/, /tasks/ ─► voipappz-api mothership
                                        ├─ /ws/events ────────────► its own socket
                                        └─ everything else ───────► the SPA from dist/

Elixir portal ─┬─ NATS request/reply ──► voipappz-api   (ASK: is this token real?)
               └─ one cable connection ► va-crystal     (LISTEN: events, fanned
                                                         out over PubSub)
```

Two transports, two jobs: *ask* on NATS, *listen* on cable. The portal never
reaches the API over HTTP to verify a credential. See
[the architecture guide](./docs/architecture.md) for the full contract.

## Two ways to run

| Mode | Command | When |
|---|---|---|
| **Attached** | `make dev` | Day-to-day work: stack up + Vite logs following. Ctrl-C detaches; the stack keeps running. |
| **Detached** | `make up` / `make down` | Same stack in the background. Vite :4200 + portal :4001 + cable :4100. |

> **Gotcha:** editing `.env` and running `docker compose restart` does *not*
> re-read env vars. Use `docker compose up -d --force-recreate <service>`.

## Surfaces the Deno BFF used to serve

A Deno BFF used to sit behind the portal with a local DuckDB projection of call
events. It served the Dashboard builder (`/dashboard/*`), the Raw events screen
(`/events`), transcript reads, an optional PostgREST plane (`/rest/v1`) and a
read-only MCP server over the same DuckDB rows.

It was **deleted** when the Elixir portal took over the origin, rather than kept
as a second backend nobody would finish migrating. Those screens 404 until each
route lands in Elixir; the git history holds the Deno implementation. Everything
else the SPA calls is `/api/*`, which goes to the mothership and never went
through Deno.

## Configuration

All configuration is env (see **[.env.example](./.env.example)** — copy it to
`.env`). Nothing is required out of the box — the browser uses relative URLs
and reaches the mothership through the app server (Vite proxy in dev, the
portal's forwarder in prod). Repoint a tenant fork with:

```bash
MOTHERSHIP_URL=https://tenant.example    # dev proxy + prod forwarder + preflight
```

Everything else (softphone SIP, dashboard extras, branding, mocks) is optional
and documented inline in `.env.example`. Do **not** set `VITE_API_BASE_URL` in
dev — it bypasses the Vite proxy and trips CORS.

## Make commands

```
make            # list targets
```

| Command | Description |
|---|---|
| `make dev` | Run the app in Docker (attached logs) |
| `make up` / `make down` | Start / stop the full Docker stack (web + portal + cable) |
| `make build` | Production build (`dist/`, in Docker) |
| `make lint` / `make unit` | ESLint / Vitest in Docker |
| `make test` | Playwright E2E (needs the app running) |
| `make act-portal` | Run the Elixir portal CI job locally; installs `act` into `/tmp` if needed |
| `make act` | Run the complete GitHub Actions workflow locally |
| `make verify` | Health check: the portal's probes, Vite and the cable |
| `make status` | Local git + production health (set `PROD_URL`) |
| `make deploy` / `make ship` | Deploy to the production server / push + deploy |

## Project layout

```
src/
  lib/          # auth (token/session) + clients/ (mothership api, login, portal)
  services/     # feature APIs (one module per backend feature)
  hooks/        # cross-cutting hooks (useFeatures, useACL)
  components/   # Calls, Reports, Dashboard, Raw Event Explorer, Phone, common/
  context/      # Auth, Direction
  i18n/         # react-i18next (Hebrew RTL default + English)
  theme/        # MUI theme
agents_demo/    # the Elixir portal: the origin — SPA, /ws/events, forwarder
.agents/skills/ # repository-scoped Codex workflows shared by the team
tests/          # Playwright E2E
```

To add a feature, follow the **service → hook → component** recipe with `Calls`
as the blueprint — see [DEVELOPING.md](./DEVELOPING.md).

## Testing

```bash
make unit           # Vitest unit tests (services, hooks) — in Docker
make test           # Playwright E2E in Docker (app must be running: VITE_MOCK_LOGIN=1 make up)
make lint           # ESLint — in Docker
make build          # must be clean before shipping
npm run verify:push # complete local gate, including a production browser smoke
make act-portal     # execute the Elixir portal CI job locally
```

## Developer skill

Codex discovers the checked-in `$develop-voipappz-portal` skill from
`.agents/skills/`. Invoke it explicitly when implementing or verifying changes;
it routes developers to the canonical architecture, the portal/Vite
invariants, and the correct test matrix. Codex can also select it automatically when a task
matches its description. See the official [OpenAI skill documentation](https://developers.openai.com/codex/skills).

## Internationalization

Hebrew (default, RTL) + English via `react-i18next`. Locales in
`src/i18n/locales/`. Use `useTranslation()` for copy and `useDirection()` for
layout direction.

## Deploy

Two ways, both Docker-only (nothing to install): `make prod` runs the
production image on this box (:8000); `make deploy` builds, pushes to the
registry, and swaps the container on the production server (`make ship` =
`git push` + deploy; `make status` probes the deployed version). See
[deployment guide](./docs/deployment.md).
