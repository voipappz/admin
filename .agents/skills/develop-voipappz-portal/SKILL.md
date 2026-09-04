---
name: develop-voipappz-portal
description: Develop, debug, review, document, and verify the VoIPAppz React/Vite portal and its Elixir origin. Use for work in this repository involving src/, connectix/, Vite proxying, the mothership forwarder and its CORS policy, NATS token verification, the va-crystal cable client, /ws/events, health endpoints, Docker/CI/act, or deployment configuration. Do not use to change the external voipappz-api, va-crystal, or production systems unless the user explicitly puts them in scope.
---

# Develop the VoIPAppz portal

Follow the repository's same-origin architecture and select the smallest
verification matrix that proves a change. Preserve unrelated work in the dirty
tree and keep tenant credentials out of source, logs, browser bundles, and CI.

## Establish context

1. Read `CLAUDE.md` completely.
2. Read only the task-relevant canonical guide:
   - Frontend feature work: `DEVELOPING.md` and `docs/modules.md`.
   - Cross-service routing or event work: `docs/architecture.md`.
   - Portal work: `docs/architecture.md` and `connectix/`'s moduledocs.
   - CI or acceptance work: `docs/testing.md`.
   - Deployment work: `docs/deployment.md`.
3. Inspect `git status --short --branch` before editing. Treat existing changes
   as user-owned and do not overwrite or reformat unrelated files.

## Respect the system boundaries

- Keep browser URLs relative. Let Vite proxy in development and the Elixir
  portal forward in production. Do not put a backend host or secret in a
  `VITE_*` variable.
- Keep mothership data access in `src/lib/clients/` and `src/services/`.
  Components must not construct upstream URLs or duplicate server rules.
- Use the `Calls` service → hook → component shape for new frontend modules.
- Keep Calls, Reports, authentication, and feature flags mothership-owned. The
  portal forwards those routes; it does not reimplement them.
- Do not deploy, push, or mutate an external service unless the user explicitly
  asks for that action.

## Preserve the portal invariants

When changing `connectix/lib/connectix/realtime/` or the plugs:

- **Ask on NATS, listen on cable, never HTTP.** Token verification is a NATS
  request/reply (`Realtime.Bus`). With no bus configured it refuses — that is
  the designed behaviour, not a gap to fill with an HTTP fallback.
- **Derive streams from the verified token's claims.** A client never names a
  uuid and the server must never accept one.
- One upstream cable connection for the whole app, fanned out over
  `Phoenix.PubSub`. The credential is minted from the verified identity
  (`Realtime.CableToken`), not the browser's token forwarded onward.
- `Plugs.EngineProxy` owns CORS on the routes it forwards: it answers
  preflights itself and replaces the upstream's `access-control-*` headers.
  The Chrome extension's `chrome-extension://<id>` origin is unnameable by any
  upstream allowlist, and merging the two policies produces a response the
  browser rejects. Do not copy upstream CORS headers through.
- Keep `/health/alive` process-only and never drain-aware; keep `/health/ready`
  503 from the start of shutdown.
- Keep `NATS_URL` out of logs and health responses because it may contain
  credentials. The forwarder logs method and path only — never query strings or
  bodies, which carry credentials.

## Verify the change

Run targeted tests first, then the applicable gate:

| Change | Required verification |
|---|---|
| React component/service only | `npm run lint`, targeted Vitest, then `npm run test:run` |
| Vite config or production bundle | Frontend checks plus `npm run build -- --outDir <temporary-directory>` |
| Elixir portal | `docker compose exec -e MIX_ENV=test elixir mix test` (needs Postgres), then `mix compile --warnings-as-errors` |
| Forwarder, CORS, health routes, portal CI | `make act-portal` after targeted ExUnit tests |
| Cross-cutting or pre-handoff | `npm run verify:push` |
| Workflow-wide CI change | `make act` when its Docker/runtime cost is justified |

Use `scripts/ci-local.sh`; it auto-installs `act` into `/tmp` when absent and
always supplies an empty env file. Never let local `.env` tenant credentials
enter act containers.

If native `npm run build` cannot clean a Docker-owned `dist/`, do not delete or
chown user files casually. Build to a fresh temporary output directory or use
the documented Docker gate.

## Keep documentation synchronized

Update documentation in the same change when an endpoint, environment variable,
health rule, test command, data owner, or runtime dependency changes:

- Keep `README.MD` high-level and task-oriented.
- Put architecture and event contracts in `docs/architecture.md` and
  `api/README.md`.
- Put developer recipes in `DEVELOPING.md`.
- Put verification coverage and honest acceptance limits in `docs/testing.md`.
- Document every supported environment variable inline in `.env.example`.

## Hand off clearly

Report the implemented behavior, exact checks and counts, warnings that remain,
and any live-infrastructure acceptance that automation could not prove. Link to
the most useful changed files instead of dumping command logs.
