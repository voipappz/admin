# Live dashboard (`/live`) — client side

The screen shows agents, queues and calls in progress for one environment,
live, from the va-crystal node's cable. The server side — how switch events
become the documents this screen receives — is documented in va-crystal:
`docs/LIVE_DASHBOARD.md` and `docs/CABLE_SPEC.md`.

## Connection

| Setting | Value |
|---|---|
| `VITE_WS_URL` | the node's cable, e.g. `ws://localhost:14000/cable` |
| `VITE_API_BASE_URL` | the API (logins, agent list, everything else) |

- The socket is `new WebSocket(url + '?token=<jwt>', ['actioncable-v1-json'])`.
  **The subprotocol is required** — without it the browser closes the socket
  before `welcome`, which looks exactly like a refused token. Both
  `useWebSocket.js` and the sidebar probe `useCableHealth.js` request it.
- The token is the login's JWT (`auth.access` for an admin,
  `user_auth.token` for a portal user). The node verifies it with its own
  `SECRET_KEY`, which must equal the API's signing key.
- `localStorage.va_cable_token`, when set, is used for the cable only — for a
  local node holding a different key. Remove it once the node has the real key:
  `localStorage.removeItem('va_cable_token')`.

## Subscription

`src/hooks/useLiveEntities.js` subscribes:

```json
{ "channel": "LiveChannel", "environment_uuid": "<uuid>" }
```

The environment is the portal user's `user.environment.uuid`, or the first
environment selected in the admin top bar. **With no environment the page opens
no socket at all.**

The node sends the current document of every agent, queue and environment,
then every change. Each frame is a whole document:

```json
{ "scope": "user", "id": "<uuid>", "revision": 40052, "deleted": false, "doc": { } }
```

The hook keeps one entity per `scope:id`, drops it on `deleted`, clears
everything when the environment changes, and coalesces re-renders every 250ms.

## What the screen shows

- **Rows.** Cable rows when the socket has delivered any; otherwise
  `/api/users?action=agents` polled every 5s.
- **Name, extension, status.** The switch never publishes a name or extension,
  and a status only when it changes, so these three are merged from the polled
  agent list by uuid. On a portal-user login the API returns only that user, so
  names are complete only for an admin session.
- **Active calls.** The size of the environment document's `live_calls_*`
  lists. The node drops an entry 24h after it started if its end was never seen.
- **Columns.** `DEFAULT_COLUMNS` in `src/services/liveSettings.js`. Order and
  visibility are saved per browser; the render mode is always taken from the
  code, so a render fix reaches every browser. `elapsed` is a running duration
  (`status_updated_at`, `call_answer_at`); `time` is a clock time
  (`first_call_at`).
- **Colours.** Per browser, in localStorage (`va-live-settings:<scope>`).

## Troubleshooting

| What you see | Look at |
|---|---|
| Empty page, no socket in DevTools → Network → WS | no environment selected / no `environment.uuid` on the login |
| Socket opens and closes before `welcome` | subprotocol missing, or token refused (node log: `Cable auth: rejected`) |
| Table repaints every second | the socket is closing and reopening; node log `Finished "/cable"` lines |
| Rows present, never update | the node's broker link or blocked TCP 4222/8021 (server side) |
| Names blank | portal-user login — log in as an admin |
