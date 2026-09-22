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
| [ionic-app.md](ionic-app.md) | The Ionic app: how it is bundled and served, what is decided, the phases left. |
| [ionic-migration.md](ionic-migration.md) | The Ionic app replaces the LiveView: seven steps, each with a gate. |

## Core decisions

- Calls, Reports, login and feature flags come from the voipappz-api
  mothership. This application does not duplicate that business logic.
- The Elixir portal is the origin. It serves the Ionic app at `/app` and
  `/ws/events`, and forwards `/auth`, `/api/` and `/tasks/` to the mothership
  so the browser and the Chrome extension only ever need one host.
- **The Ionic app is the only client the portal SERVES** — bundled into the
  release, same origin as everything it calls. The Chrome extension is
  compiled to a zip and downloaded from `/release`; Chrome runs it from an
  unzipped folder. See [ionic-app.md](ionic-app.md).
- The Chrome extension lives in `chrome/` and ships INSIDE the portal image.
  A node stage in `Dockerfile.production` builds it, stamps it with the
  portal's own `mix.exs` version, and the release serves it from `/release`.
  Node exists only in that build stage; the image that ships is still pure
  BEAM. Deploying the portal therefore deploys the extension, and the
  post-deploy hook fails the deploy if the two versions disagree.
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
