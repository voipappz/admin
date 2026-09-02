# VoIPAppz documentation

This directory is the canonical documentation set for the application. Root
README files are entry points; implementation and operational details belong
here.

| Document | Purpose |
|---|---|
| [architecture.md](architecture.md) | System boundaries, data ownership, authentication and connectors. |
| [modules.md](modules.md) | Complete frontend and backend module inventory. |
| [testing.md](testing.md) | Local tests, GitHub Actions coverage and live acceptance limits. |
| [deployment.md](deployment.md) | Local production image and Kamal deployment workflow. |

## Core decisions

- Calls, Reports, login and feature flags come from the voipappz-api
  mothership. This application does not duplicate that business logic.
- The Elixir portal is the origin. It serves the SPA and `/ws/events`, and
  forwards `/auth`, `/api/` and `/tasks/` to the mothership so the browser and
  the Chrome extension only ever need one host.
- It uses two platform transports and no HTTP: *ask* on NATS (token
  verification, request/reply), *listen* on the va-crystal cable (events, one
  connection fanned out over PubSub).
- The Dashboard builder, the Raw event explorer and the PostgREST plane were
  served by a Deno BFF that has been removed. Those routes 404 until each lands
  in Elixir.
- SIP/WebRTC settings come from the authenticated user's extension and
  environment. No production PBX endpoint is hard-coded.
- Webhooks are a possible future module and are not part of the current scope.

## Current verification status

The checked-in gate covers frontend unit tests, a clean Elixir compile, the
production build and end-user browser smoke tests. CI additionally runs the
portal's ExUnit suite against a real Postgres and boot-probes the production
image. See [testing.md](testing.md).
