# Testing and verification

## Required local gates

| Command | Coverage |
|---|---|
| `npm run verify:push` | ESLint, frontend unit tests, a clean Elixir compile, production build and the Playwright end-user smoke. |
| `make unit` | Vitest unit tests (services, hooks) in Docker. |
| `make act-portal` | The exact GitHub Actions Elixir portal job, run locally with an empty env file. |
| `make act` | Complete GitHub Actions workflow locally. |
| `make prod` | Builds/runs the exact local production artifact on port 8000 and probes `/` and `/health/alive`. |

The Git pre-push hook runs `npm run verify:push`, so a normal push is rejected
when the core gate fails.

The portal's own suite needs a Postgres and is therefore **not** in the pre-push
gate — CI runs it against a service container. Run it locally against the dev
stack with:

```bash
docker compose exec -e MIX_ENV=test elixir mix test
```

## GitHub Actions

`.github/workflows/ci.yml` runs on pushes to `main` and pull requests.

| Job | What it proves |
|---|---|
| Frontend | Lint, Vitest, production frontend build and a generated-module round trip. |
| Elixir portal | Compiles with `--warnings-as-errors` and runs ExUnit against a real Postgres. |
| E2E smoke | Login/OTP, Dashboard, phone panel, Calls, Reports and unauthenticated route protection. |
| clean install · real mothership login | Installs the mothership with its public installer on a clean runner, onboards it, builds `Dockerfile.production` and signs in for real. `workflow_dispatch` only — it takes ~30 minutes. |
| Production image | Builds `Dockerfile.production`, starts it and probes the SPA, both health routes, and that the forwarder does not swallow a path it is not configured for. |

## Test ownership

| Area | Tests |
|---|---|
| Calls | `src/services/callsApi.test.js`, `src/components/Calls/*.test.*`, browser smoke. |
| Reports | `src/components/Reports/ReportChart.test.js`, browser smoke. |
| Authentication/OTP | Mothership/client unit tests and Playwright OTP scenarios. |
| WebRTC phone | `src/lib/sip/*.test.ts`, resilience context test and integrated phone-panel smoke. |
| The forwarder + its CORS policy | `agents_demo/test/agents_demo_web/plugs/engine_proxy_test.exs`, plus the production-image surface probes. |
| Token verification | `agents_demo/test/agents_demo/realtime/token_auth_test.exs`. |
| Optional PostgREST | `src/lib/clients/postgrest.test.ts` — client-side only; nothing serves `/rest/v1` since the Deno BFF was removed. |

## The CORS contract

The Chrome extension posts `/auth/user_login` from `chrome-extension://<id>` —
an origin no upstream allowlist can name. `Plugs.EngineProxy` therefore answers
preflights itself and **replaces** the upstream's CORS headers rather than
copying them through; the upstream sends no `access-control-allow-origin` for
that origin, and relaying its other `access-control-*` headers produces a
response the browser must refuse.

The failure mode is worth knowing because it does not look like CORS: the
browser reports a bare network error with no status, which reads as "the portal
is down". Verify against a running stack with:

```bash
curl -i -X OPTIONS localhost:4001/auth/user_login \
  -H 'Origin: chrome-extension://kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk' \
  -H 'Access-Control-Request-Method: POST'
# → 204, access-control-allow-origin: *
```

## Health contract

`GET /health/alive` is liveness: 200 for as long as the BEAM answers. It never
consults the drain flag, because the right response to a failed liveness probe
is a restart and a draining node must not be restarted.

`GET /health/ready` is readiness: 503 from the start of shutdown and whenever
the node cannot host or route agent sessions. Load balancers route on this one.

## What automated tests do not prove

These require credentials and live infrastructure and must not be described as
completed merely because mocks pass:

- a real mothership Calls/Reports query with tenant data;
- deployed va-crystal authentication/routing and sustained cable reconnect;
- a real SIP/WSS registration and two-way audio call;
- external notification delivery behavior controlled by the browser/OS.

Run those as environment acceptance tests after configuring the corresponding
services. Never commit their credentials or captured customer call data.
