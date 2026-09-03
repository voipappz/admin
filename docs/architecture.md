# Architecture — VoIPAppz portal

A React 19 + Vite portal for VoIP/telecom **users**, built as reusable
components over **one backend: the voipappz-api "mothership"**. Access is
user-based: login resolves one verified user → their permissions → the
environments they may act in. There is no tenant model or tenant selector in
the app — `customer_uuid`/`environment_uuid` are backend authorization and
routing metadata, not a UI concept. A customer deployment (fork) changes
**env, not code**.

The portal is this standalone repository, cloned beside the mothership repo.
It remains its own application and image with an independent Kamal deploy;
deployment policy lives in mothership and is invoked there with
`make portal-deploy DEST=nimbus`.

## The one rule: same-origin, always

The browser never carries a backend host — every client builds **relative
URLs**. The app server in front owns the actual upstream:

```
         dev                              prod (single container, Kamal)

  Browser                                 Browser
    │                                       │
    ▼                                       ▼
  Vite :4200 ──proxy──►  Elixir portal :4001  ◄── serves dist/ itself
                              ├─ /auth, /api/, /tasks/ ──► ENGINE_URL
                              ├─ /ws/events               (its own socket)
                              └─ everything else          (the SPA)
```

`VITE_MOTHERSHIP_URL` exists only as a **direct-mode escape hatch** for
static-only hosting (e.g. the Fireberry embed) where no app server fronts the
bundle.

## Pieces

| Piece | Where | Role |
|---|---|---|
| React app | `src/` (Vite :4200) | UI. Strict data-access layering: `lib/auth.ts` (the one credential) → `lib/clients/` (transport) → `services/` (per-feature) → `components/` (folder-per-component; `Calls` is the blueprint). |
| Elixir portal | `agents_demo/` (:4001) | **The origin.** Serves `dist/` and `/ws/events`, forwards `/auth` · `/api/` · `/tasks/` to the mothership and owns the CORS policy on them, verifies tokens over NATS, holds one cable connection fanned out over `Phoenix.PubSub`. |
| Mothership (voipappz-api) | external, env-pointed | Accounts + login (`/auth/user_login` + optional per-customer OTP), calls, reports, feature flags, portal branding. The source of truth. |
| PostgREST | external, **optional** | A second, direct-SQL data plane (`/rest/v1/*`) for tenant-custom tables/views — see below. |
| Core NATS | external | The **ask** path: token verification is a request/reply to the API. Unset `NATS_URL` and the portal refuses every connection rather than falling back — see `Realtime.Bus`. One connection, no JetStream. |
| Cable (va-crystal/Nimbus WS) | external, optional | The **listen** path: per-user state/notifications plus one application-level `CallEvents` subscription. Credentials are minted by `Realtime.CableToken`; Elixir fans accepted events out over PubSub. |

## Realtime: two transports, two jobs

```text
Elixir portal ─┬─ NATS request/reply ──► voipappz-api     ASK:  is this token
               │                                                real, and whose?
               └─ cable connections ─► va-crystal          LISTEN: user state,
                        │                                  notifications, CallEvents
                        ▼
                 Phoenix.PubSub ──► one /ws/events socket per browser
```

The two are deliberately not interchangeable. Cable owns the stream semantics —
channel names, stream identifiers, and the `logged_in_at` registration a
confirmed subscription performs — so the portal subscribes to no raw NATS
subject and duplicates none of that model. Conversely, verification is an
*ask*, and answering it over the event transport would mean trusting a
broadcast to authenticate a caller.

**Which streams a connection receives is derived from the token's claims**, never
from anything the client names. A client that could name a `user_uuid` could
stream another user's events; that defect has existed elsewhere in this system.

**A screen pop is a Ruby-defined instruction executed by the portal.** When a
verified websocket first activates an environment, `Realtime.ScreenPop` asks
`screen_pop.instructions.load` over NATS and caches the enabled PocketFlow
screen-pop definitions for that environment. The bounded request runs outside
the event processor; events for an environment already loading wait in a
bounded in-memory queue, and an explicit refresh can replace its cache. Ruby
owns the trigger, graph and configured URL, but it is not in the runtime event
loop.

At runtime va-crystal enriches ESL events and publishes them to its `CallEvents`
Cable channel. The singleton application connection in `Realtime.ApiProxy`
subscribes once and passes them to `Realtime.ScreenPop`; per-user Cable clients
never subscribe to that node-wide stream. A cached instruction executes only
when the event supplies a user, environment and stable event/call id, that
user/environment pair has a live verified `/ws/events` process, the trigger and environment match,
and the configured URL is `https` with a host. Execution is deduplicated in a
bounded process-local 60-second cache, then PubSub sends only `{action, url}` to
the named user's socket. Nothing is persisted or replayed for an offline user.

A Deno BFF used to sit behind the portal maintaining a local DuckDB projection
of CDR events, and served the Dashboard builder, the `/events` inspector,
transcript reads and a read-only MCP surface from it. It was removed when the
portal took over the origin; those routes 404 until each lands in Elixir.

## Auth (the spine)

```
Login form → POST /auth/user_login (relative → proxy/forwarder → mothership)
  → { user, token }  or  OTP challenge → POST /auth/user/otp/verify
  → session (JWT) in localStorage.auth   [lib/auth.ts]
  → every request: Authorization: Bearer <token>   [lib/clients/api.ts]
  → 401 anywhere → session dropped, re-login       [AUTH_EVENTS.UNAUTHORIZED]
```

The user object also configures the softphone: `extension.{username,password}`
+ `environment.{domain,wss_server}` → `sipSettingsFromUser` — **no SIP endpoint
is baked into the code** (`VITE_SIP_*` is a dev/demo override only).

## The optional PostgREST plane

For tenant-custom tables/views that live beside the mothership. Enable it by
**Nothing serves `/rest/v1` today** — the forward lived in the Deno BFF and went
with it, so the route 404s and the app is mothership-only. The design, and the
frontend half of it, are kept because the tenant-custom-table need has not gone
away; re-landing it means one forwarder in the portal. When enabled, the
connector JWT rides through — PostgREST verifies it with its own shared secret
(`VA_PGRST_JWT_SECRET`), so RLS can scope rows by the token's claims.

Frontend building blocks, layered like everything else:

- `lib/clients/postgrest.ts` — `pgrstList` / `pgrstGet` (relative `/rest/v1`,
  bearer auth, exact counts via `Content-Range`).
- `components/PostgrestTable/` — a generic drop-in table with server-side
  paging + sorting: `<PostgrestTable table="my_view" />`.

## Configuration

Env is the whole tenant surface — every knob is documented inline in
[.env.example](../.env.example) (frontend `VITE_*` only; the portal reads the
unprefixed vars — never `VITE_`-prefix a secret). The local stack points the
portal and cable at the API on port 5000 by default; `PORTAL_ENGINE_URL` and
`CABLE_API_URL` move those two hops together. Production Kamal destinations
set `ENGINE_URL` in mothership's deploy policy.

## Verify

```bash
make verify        # portal probes + web + cable
# through the app server (any mode):
curl -s localhost:4200/tasks/customer_portal_data          # mothership, public → 200
curl -s localhost:4200/api/calls                           # mothership, authed → 401 without a token
curl -s localhost:4001/health/alive                        # the portal itself → ok
# the extension's origin — the header that makes its login possible:
curl -si -X OPTIONS localhost:4001/auth/user_login \
  -H 'Origin: chrome-extension://kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk' \
  -H 'Access-Control-Request-Method: POST' | grep -i allow-origin
```
