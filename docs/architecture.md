# Architecture — VoIPAppz portal

A pure-BEAM Elixir/Phoenix portal for VoIP/telecom **users**, built over
**one backend: the voipappz-api "mothership"**. Access is user-based: login
resolves one verified user → their permissions → the environments they may
act in. There is no tenant model or tenant selector in the app —
`customer_uuid`/`environment_uuid` are backend authorization and routing
metadata, not a UI concept. A customer deployment (fork) changes **env, not
code**.

The portal is this standalone repository, cloned beside the mothership repo.
It remains its own application and image with an independent Kamal deploy;
deployment policy lives in mothership and is invoked there with
`make portal-deploy DEST=nimbus`.

## The one rule: same-origin, always

The browser never carries a backend host — every client builds **relative
URLs**. The Elixir portal in front owns the actual upstream, in dev and prod
alike (one process, one container):

```
  Browser
    │
    ▼
  Elixir portal :4001
    ├─ /auth, /api/, /tasks/ ──► ENGINE_URL
    ├─ /ws/events               (its own socket)
    └─ /, /chat                 (the LiveView UI)
```

## Pieces

| Piece | Where | Role |
|---|---|---|
| Elixir portal | `connectix/` (:4001) | **The origin, and the whole app.** Serves the LiveView UI and `/ws/events`, forwards `/auth` · `/api/` · `/tasks/`, verifies user tokens through Cable and fans accepted events out over `Phoenix.PubSub`. It holds no direct NATS connection. |
| Mothership (voipappz-api) | external, env-pointed | Accounts + login (`/auth/user_login` + optional per-customer OTP), calls, reports, feature flags, portal branding. The source of truth. |
| PostgREST | external, **optional** | A second, direct-SQL data plane (`/rest/v1/*`) for tenant-custom tables/views — see below. Currently unserved (see below). |
| Core NATS | external | va-crystal's Cable backend and the mothership use the broker. It is not an Elixir portal transport. |
| Cable (va-crystal/Nimbus WS) | external, optional | The portal's platform transport: token verification and API relay on the application connection, per-user state/notifications, and one application-level `CallEvents` subscription. |

## Realtime: Cable owns the portal boundary

```text
Elixir portal ── cable connections ─► va-crystal ──► NATS / mothership
      │                │
      │                ├─ application: verify, API relay, CallEvents
      │                └─ per user: registration, state, notifications
      ▼
Phoenix.PubSub ──► one /ws/events socket per browser
```

Cable owns authentication, channel names, stream identifiers and the
`logged_in_at` registration a confirmed subscription performs. The portal
subscribes to no raw NATS subject and holds no broker connection; NATS remains
underneath va-crystal's Cable backend.

**Which streams a connection receives is derived from the token's claims**, never
from anything the client names. A client that could name a `user_uuid` could
stream another user's events; that defect has existed elsewhere in this system.

**The temporary screen-pop rule is static inside Elixir.** When a verified
websocket first activates any environment, `Realtime.InstructionLoader` creates
a validated `user.answer` → `screen_pop_pop` instruction for that environment,
with `https://google.com` as its URL. It performs no Ruby, HTTP or NATS request.
The cache and explicit refresh boundary remain so the static loader can later
be replaced without changing runtime event processing.

At runtime va-crystal enriches ESL events and publishes them to its `CallEvents`
Cable channel. The singleton application connection in `Realtime.ApiProxy`
subscribes once and passes them to `Realtime.ScreenPop`; per-user Cable clients
never subscribe to that node-wide stream. A cached instruction executes only
when the event supplies a user, environment and stable event/call id, that
user/environment pair has a live verified `/ws/events` process, the trigger and
environment match, and the configured URL is `https` with a host. Execution is
deduplicated in a bounded process-local 60-second cache, then PubSub sends only `{action, url}` to
the named user's socket. Nothing is persisted or replayed for an offline user.

`GET /metrics` exposes Prometheus counters for screen-pop event outcomes
(`received`, `queued`, `unloaded`, `dispatched`, `duplicate`, `offline`,
`rejected`) and instruction loads (`started`, `loaded`, `failed`). Labels are a
fixed allowlist: user, environment, call, URL and instruction identities never
enter metrics.

A Deno BFF used to sit behind the portal maintaining a local DuckDB projection
of CDR events, and served the Dashboard builder, the `/events` inspector,
transcript reads and a read-only MCP surface from it. It was removed when the
portal took over the origin; those routes 404 until each lands in Elixir.

## Auth (the spine)

Two credential paths, depending on which surface is asking:

```
Chrome extension / mothership-account flow:
  POST /auth/user_login (relative → forwarder → mothership)
    → { user, token }  or  OTP challenge → POST /auth/user/otp/verify
    → session (JWT), Authorization: Bearer <token> on every request
    → 401 anywhere → session dropped, re-login

LiveView UI (`/`, `/chat`):
  HTTP Basic Auth (ConnectixWeb.Plugs.BasicAuth), one operator identity —
  see connectix/CLAUDE.md for the auth conventions used inside connectix/.
```

## The optional PostgREST plane

For tenant-custom tables/views that live beside the mothership.
**Nothing serves `/rest/v1` today** — the forward lived in the Deno BFF and
went with it, so the route 404s and the app is mothership-only. The design is
kept because the tenant-custom-table need has not gone away; re-landing it
means one forwarder in the portal, plus whatever UI consumes it lands on
`connectix/` now, not a second frontend. When enabled, the connector JWT rides
through — PostgREST verifies it with its own shared secret
(`VA_PGRST_JWT_SECRET`), so RLS can scope rows by the token's claims.

## Configuration

Env is the whole tenant surface — every knob is documented inline in
[.env.example](../.env.example). The local stack points the portal and cable
at the API on port 5000 by default; `PORTAL_ENGINE_URL` and `CABLE_API_URL`
move those two hops together. Production Kamal destinations set `ENGINE_URL`
in mothership's deploy policy.

## Verify

```bash
make health         # portal probes, cable, events
curl -s localhost:4001/tasks/customer_portal_data           # mothership, public → 200
curl -s localhost:4001/api/calls                             # mothership, authed → 401 without a token
curl -s localhost:4001/health/alive                          # the portal itself → ok
# the extension's origin — the header that makes its login possible:
curl -si -X OPTIONS localhost:4001/auth/user_login \
  -H 'Origin: chrome-extension://kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk' \
  -H 'Access-Control-Request-Method: POST' | grep -i allow-origin
```
