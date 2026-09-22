# The phone moves to Ionic; the chat stays LiveView

Decided 2026-09-22. Two UIs, split by job, both served by this portal:

| | UI | where |
|---|---|---|
| **Chat** — agent conversation, approvals, questions, takeover, file view, environment switch | Phoenix LiveView (`ChatLive`) | `/chat`, Basic Auth |
| **Phone** — and the telephony screens (calls, actions, extensions, numbers, queues, IVR, bots) | the Ionic app in `ionic/` | `/app`, login token |

Everything phone-related leaves the LiveView. Nothing chat-related moves. This
keeps `connectix/CLAUDE.md`'s LiveView Bot Studio direction intact and avoids
rebuilding ~4,200 lines of working chat UI.

Two decisions this rests on (both 2026-09-22):
- **Auth is entirely in the portal, like the Chrome extension.** `/auth/*` is
  portal-owned; the JWT is minted and verified here; the identity is the yaml
  agent's uuid. Nothing upstream on the login path.
- **The WebRTC phone connects to Elixir.** The Ionic phone talks WebRTC to this
  portal, which is the SIP UA — the same `WebRtc.Peer` + `SipBridge` stack the
  LiveView phone drives today. SIP.js to the SBC is dropped from the app.
- **One socket, the extension's.** The Ionic app connects to the portal exactly
  as the Chrome extension does: `POST /auth/user_login`, then `/ws/events` with
  the token as `Sec-WebSocket-Protocol` (`chrome/docs/REALTIME_CONTRACT.md`).
  No `/agent` Phoenix socket is ported: it carries the token as `?token=` in the
  URL, which that contract rejects, and it would be a second socket with a
  second auth path. Phone signalling rides `/ws/events` as new actions and
  frame types — the contract allows a server to add frame types.

## What the app expects, and what exists

| the app calls | exists where | status |
|---|---|---|
| `POST /auth/user_login` | `Portal.AuthController` | works; answer shape matches |
| `POST /auth/user_token_status?token=` on every boot; expects `res.user` to be a JWT | nowhere | **missing** — app redirects to `/login` on failure |
| `GET /tasks/customer_portal_data` on boot (title, logo) | forwarded to `ENGINE_URL` | portal-owned answer needed |
| `Authorization: Basic <token>` + `X-VA-Auth: user` | portal accepts `Bearer` only | **401 today** |
| `/agent` Phoenix socket (`?token=` in the URL), topics `notifications:`, `phone:` | the old phone project only | **not ported** — the app moves to `/ws/events`, the socket the extension uses |
| phone signalling: `offer`, `ice`, `dial`, `hangup` out; `answer`, `ice`, `status`, `error` back | `ChatLive`'s `phone_*` handlers + `WebRtcPhone` hook, over the LiveView socket | **move** onto `/ws/events` as actions/frames; drives `Peer` + `SipBridge`, already here |
| `/api/admin/{users,numbers,bots,statuses,calls}` | nowhere | **build**; bots/statuses/calls map onto existing contexts |
| `/api/*` for extensions, numbers, IVR, queues, time conditions | forwarded to the mothership | works with `ENGINE_URL` |

## Steps

### 0. Commit the moved code
`ionic/` (mobile's newer app: bot page, channel phone, Janus dropped, 17 pages),
`proxy.conf.js` (`/agent` proxied as a websocket), `ionic/docs/`.
**Gate:** `make app` green; `/app` serves `main.<hash>.js`; `/chat` still 401.

### 1. Auth, all in the portal
- Every `/auth/*` route portal-owned — remove `/auth` from `EngineProxy`'s
  forwarded prefixes; `/auth/user_login` already is.
- Accept `Basic <token>` as well as `Bearer`: one parser shared by
  `Plugs.UserTokenAuth` and `AuthController.verified/1`.
- Answer `/auth/user_token_status` (re-verify; return the JWT in `user`) and
  `/tasks/customer_portal_data` (title, logo) here.
- Remove OTP and forgot-password from the Ionic login page — no portal
  counterpart, and the extension has none.
- `X-VA-Auth` in the CORS allow-list (Capacitor builds only; web is same-origin).
**Gate:** log in at `/app`, reload, stay logged in; `GET /api/events` with
`Basic <token>` → 200.

### 2. The app onto `/ws/events`
In the app, two files: `websocket.ts` / `action-cable.service.ts`'s
`ChannelAdapter` (received/connected/perform/unsubscribe — the seam every page
uses) reimplemented over `/ws/events`: token as `voipappz-bearer.<base64url>`
subprotocol, dispatch on `type`, `welcome` first, `notification` and
`user.state` frames delivered as the `"message"` the pages expect. Drop the
`phoenix` dependency. Nothing in Elixir changes for this step — the socket, its
auth and its per-user fan-out already exist and are what the extension runs on.
**Gate:** the app receives `welcome`, then a `bridge-agent-start` frame, on the
same socket the extension uses; `phoenix` is gone from `package.json`.

### 3. The phone — signalling on `/ws/events`, stripped from the LiveView
- `ConnectixWeb.RealtimeSocket` gains client actions `phone.offer`, `phone.ice`,
  `phone.dial`, `phone.dial_agent`, `phone.hangup` → `WebRtc.Peer.start_link` /
  `Peer.offer` / `Peer.ice` / `SipBridge.dial` / `SipBridge.hangup` — the calls
  `ChatLive`'s `phone_*` handlers make today — and server frames `phone.answer`,
  `phone.ice`, `phone.status`, `phone.error` from `Peer`'s and `SipBridge`'s
  broadcasts. One Peer per socket, keyed by the socket's user. Documented in
  `REALTIME_CONTRACT.md` as an extension of the frame protocol.
- In the app, `webrtc-channel-phone.ts` sends/receives those over the step-2
  socket instead of a `phone:` channel (same events, different transport).
- `SipBridge` stays one env account (`CONNECTIX_SIP_*`) for v1; per-agent
  registration is a later step.
- In the app: remove the SIP.js phone (`webrtc-phone.ts`, `sip.js`,
  `WEBSOCKETS_SIP_URL`/`JANUS_URL` in `main.js`); `phone.ts` keeps one mode.
  Apply the three HIGH fixes from `ionic/docs/MOBILE_APP_PLAN.md` §6.
- In the LiveView, delete the phone: the 11 `phone_*` `handle_event`s and the
  `:webrtc`/`:webrtc_phone` `handle_info`s in `chat_live.ex`, the `WebRtcPhone`
  hook in `assets/js/app.js`, the phone markup in `chat_components.ex`,
  `Config.sip_credentials` / `phone_account` assigns, and the `phone_*` tests.
  `ChatLive` keeps the link to the Ionic dialpad instead.
- `SipBridge.dial(mode: :agent)` (the voice bot on a call) was only reachable
  from `ChatLive` — that is `phone.dial_agent` above.
**Gate:** dial from the Ionic dialpad, two-way audio, hang up from either side;
`/chat` has no phone and still works; `WebRtc.Peer` is only started by
`RealtimeSocket`.

### 4. `/api/admin/*` (the telephony screens)
Contract in `admin.service.ts`'s header (list `{data: [...]}`, 201/404/422,
`DELETE` → 204). Map onto what exists: `bots` → `Connectix.Bots`, `statuses` →
`Portal.StatusController`, `calls` → `Connectix.Events`, `users` → the customer
yaml agents (read-only), `numbers` → new or 404 (the app degrades). Behind the
user token.
**Gate:** `bot-page` lists, creates, edits and deletes a bot.

### 5. Tidy
- `docs/ionic-app.md`, `CLAUDE.md` (the two-UI split, which one owns what).
- `ReleaseController` already lists the app; the LiveView header links to
  `/app` for the phone.
- The `prod-image` CI probe (`GET /` → 401) and the surface tests are unchanged
  — the LiveView stays.

## What stays, and why
- `ChatLive`, `AgentLiveHelpers`, `chat_components`, the assets pipeline, Basic
  Auth on `/chat` — the chat UI, untouched apart from the phone removal.
- `WebRtc.Peer`, `Turn`, `Rtp`, `SipBridge`, `Transport`, `SipHandler`,
  `WebRtcMediaPipeline`, `Voice.*` — the phone's and the voice bot's engine.
- `/ws/events`, now shared by the extension and the Ionic app — one socket, one
  contract, one auth path.
- Two identities remain: the LiveView's Basic Auth operator and the Ionic
  login's agent. They no longer need to share anything — chat is one, phone is
  the other.

## Open
- **Per-agent SIP registration** on the portal's UA (one env account today).
- **`numbers`** in `/api/admin` — a real resource, or leave the app's empty-list
  fallback.
- **Android release** (signing, `versionCode`, CI) — `ionic/docs/MOBILE_APP_PLAN.md` §4.
