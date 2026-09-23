# Module inventory

The project uses a feature-module shape:

```text
transport/auth → feature service → feature hook → feature component
```

Components do not construct backend URLs or duplicate backend business rules.
Calls is the reference implementation for new list modules.

## End-user modules

| Module | Main code | Data owner | Responsibility |
|---|---|---|---|
| Login | `src/components/Login/`, `src/lib/auth.ts`, `src/lib/clients/mothership.ts` | Mothership | Password login, optional OTP, trusted session and logout. |
| Calls | `src/components/Calls/`, `src/services/callsApi.js` | Mothership | Server-filtered and paginated call list, details and transcript presentation. |
| Reports | `src/components/Reports/`, `src/services/reportsApi.js` | Mothership | Mature report definitions, date filtering and charts. |
| Dashboard | `src/components/Dashboard/`, `src/components/DashboardBuilder/` | **unserved** | KPIs, calls per hour, recent calls, and the full-screen builder (dashboard CRUD, Counter/Table/Pie/Line/Bar/Gauge/Stat widgets). Its backend was the removed Deno BFF's DuckDB projection — `/dashboard/*` 404s until the portal serves it. |
| Phone | `src/components/Phone/`, `src/lib/sip/` | Authenticated user/PBX | SIP registration, presence, inbound/outbound call lifecycle, audio and call notifications. |
| Navigation/Layout | `src/components/MainMenu/`, `src/components/Layout/` | Frontend | End-user menu, responsive hamburger behavior and authenticated layout. |
| Notifications | `src/components/Notifications/` | Frontend | Application notifications and notification state. |
| System status | `src/components/Status/`, `src/components/common/SystemHealth.jsx` | Portal health | Connector and transport visibility. |
| Raw event explorer | `src/components/EventExplorer/`, `src/services/duckdbEventsApi.js` | **unserved** | Server-paged/searchable table over the removed DuckDB event store — `/events` 404s. |
| PostgREST table | `src/components/PostgrestTable/`, `src/lib/clients/postgrest.ts` | **unserved** | Reusable server-paged table for tenant-specific data; the `/rest/v1` forward went with the Deno BFF. |

## Shared frontend layers

| Layer | Location | Rule |
|---|---|---|
| Authentication | `src/lib/auth.ts` | One stored session and one source of bearer credentials. |
| API transport | `src/lib/clients/` | Relative same-origin requests, common auth, paging and 401 behavior. |
| Feature services | `src/services/` | Endpoint/query construction and response normalization per feature. |
| Feature hooks | Inside each component folder | Loading, error, paging, sorting and lifecycle state owned by that feature. |
| Shared presentation | `src/components/common/`, `src/components/ui/` | Filters, cards, charts and small presentation primitives only. |
| Access control/features | `src/services/aclService.js`, `src/hooks/` | User permissions and feature flags; inaccessible services degrade safely. |
| Internationalization | `src/i18n/`, direction context | Hebrew/RTL and English copy/layout. |

## Portal modules

| Module | File | Responsibility |
|---|---|---|
| Origin/forwarder | `connectix/lib/connectix_web/plugs/engine_proxy.ex` | Forwards `/auth`, `/api/`, `/tasks/` to the mothership; answers preflights and owns the CORS policy on those routes. |
| Realtime socket | `connectix/lib/connectix_web/realtime_socket.ex` | `/ws/events` — a raw WebSock upgrade speaking the flat JSON frame contract shipped clients already use. |
| Token verification | `connectix/lib/connectix/realtime/token_auth.ex` | Local: the portal signs and verifies its own tokens. |
| Event source | `connectix/lib/connectix/realtime/free_switch.ex`, `esl_producer.ex`, `free_switch/frame.ex`, `event_pipeline.ex` | FreeSWITCH Event Socket → Broadway producer → node-shaped frames → `ScreenPop`. |
| Cable client | `connectix/lib/connectix/realtime/cable_client.ex`, `cable_token.ex` | One upstream cable connection for the whole app, on a credential the portal mints from the verified identity. |
| Health probes | `connectix/lib/connectix_web/controllers/health_controller.ex` | `/health/alive` (liveness, never drain-aware) and `/health/ready` (readiness, 503 from the start of shutdown). |

## Data ownership

| Data | Source of truth | Stored locally? |
|---|---|---|
| Users, authentication and OTP | Mothership | Session only in the browser. |
| Calls list and call metadata | Mothership | No. |
| Reports and report definitions | Mothership | No. |
| Transcripts/logs | Engine/mothership service | No; read on demand. |
| CDR events received by this app | va-crystal / the mothership | No longer — the DuckDB store left with the Deno BFF. |
| User state and DashboardLive values | va-crystal via cable | Runtime relay only, fanned out over PubSub. |
| Dashboard definitions and widgets | User configuration | Was DuckDB; currently nothing persists them. |
| SIP credentials/settings | Authenticated user payload | Runtime only. |

## Adding a future module

Use the generator to create the standard service, test, hook and page shape:

```bash
make module NAME=Agent ENDPOINT=/api/agents
```

Then add the route and navigation item printed by the generator, replace its
placeholder normalization/columns, add filters using the shared filter model,
and extend the browser smoke test. The generator never overwrites an existing
module.

Webhooks are deliberately not generated now. If added later, keep their
configuration UI separate from call processing and support transport-specific
adapters without coupling Calls, Reports or Dashboard to webhook logic.
