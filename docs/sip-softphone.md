# SIP softphone: where the WSS URL comes from

The softphone's WebSocket endpoint — the SBC/FreeSWITCH `ws` binding sip.js
connects to — is **not** configured in this repo. For a portal user it arrives
in the login response as `user.environment.wss_server`, and everything else is a
fallback for when that is absent.

This note traces the resolution because there are two unrelated "WS URLs" in the
codebase and picking the wrong one costs an afternoon.

## Not `src/config.js`

`src/config.js` exports `getWebSocketUrl` and `config.ws.cable` / `config.ws.ws`.
That is the **app's own** `/ws` socket, derived from `window.location` or
`VITE_WS_URL` / `VITE_API_BASE_WS` / `VITE_WSS_BASE_URL`.

Nothing in the SIP path reads it. The softphone has its own config module at
`src/lib/sip/config.js`.

## The chain

**1. Login hands the user object to the softphone** — `src/components/Login/UserLogin.js:209`

```js
try { sipConnect(sipSettingsFromUser(authData.user, password)); } catch { /* phone optional */ }
```

Fire-and-forget on purpose: a registration failure must never block landing on
the dashboard.

**2. The URL is derived from the user's environment** — `src/lib/sip/sipSettings.js:86-106`

```js
const ext = user?.extension ?? {};
const env = user?.environment ?? ext.environment ?? {};   // environment is at USER level

const rawWss = env.wss_server || '';
const wssUrl = rawWss
  ? (rawWss.startsWith('ws') ? rawWss : `wss://${rawWss}`)   // bare host gets the scheme
  : cur.wssUrl;                                              // fallback, see below
```

`cur` is `loadSipSettings()` — localStorage `sip-settings`, else
`defaultSipSettings()`, which reads `loadSipConfig().wssUrl` →
`import.meta.env.VITE_SIP_WSS_URL || ''` (`src/lib/sip/config.js:40`).

The rest of the credentials come from the same object: `ext.username`,
`ext.password || ext.secret || loginPassword`, `env.domain`. This shape —
extension for credentials, environment for transport — is what
voipappz-api's `Serializers::User#login` returns.

**3. Passed to the phone as a config override** — `src/context/SoftphoneContext.jsx:105-108`

```js
await phone.register(
  { username: s.username, password: s.password, domain: s.domain, displayName: ... },
  { wssUrl: s.wssUrl, domain: s.domain }        // cfgOverrides
);
```

**4. Handed to sip.js** — `src/lib/sip/useSipPhone.js:485`, then `:397`

```js
cfgRef.current = loadSipConfig({ ...overrides, ...cfgOverrides });
...
ua = new UserAgent({ uri, transportOptions: { server: cfg.wssUrl }, ... });
```

`loadSipConfig` resolves `overrides.wssUrl || VITE_SIP_WSS_URL || ''`
(`config.js:40`), so the value passed in step 3 wins.

## Precedence, at login

1. `user.environment.wss_server` — the normal path
2. localStorage `sip-settings.wssUrl` — whatever last registered
3. `VITE_SIP_WSS_URL` — dev/demo builds
4. `''` — unconfigured

The SIP **domain** rides alongside: `env.domain || cur.domain`
(`sipSettings.js:93`), and if it is set nowhere `loadSipConfig` falls back to the
WSS hostname via `hostFromWss` (`config.js:41`).

## Three things that surprise people

**The admin surface never gets an environment WSS.** `sipSettingsFromAccount`
(`sipSettings.js:61-74`) derives username, domain and password from the account
email but leaves `wssUrl` untouched — so on `/admin` it can only come from
`VITE_SIP_WSS_URL` or a previously stored value. This is deliberate: one SBC
fronts many account domains, so the endpoint is not a property of the account.
The portal path is the asymmetric one, and only because a portal user's
environment does carry `wss_server`.

**An empty `wssUrl` fails silently.** `sipSettingsReady` requires
`wssUrl && domain && username && password` (`sipSettings.js:110-112`), and
`connect` returns early without it (`SoftphoneContext.jsx:104`). No registration
is attempted, no error is raised, status stays `idle`. If `wss_server` is
missing from the login response and no env var is set, the phone simply never
registers — check the login response body before suspecting the SIP stack.

**The precedence flips between login and reload.** At login the environment's
`wss_server` beats `VITE_SIP_WSS_URL` (step 2 computes `wssUrl` after spreading
`cur`). But `connect` persists the derived settings (`SoftphoneContext.jsx:103`),
and on the next page load `loadSipSettings` spreads `envSipOverrides()` **last**:

```js
if (raw) return { ...defaultSipSettings(), ...JSON.parse(raw), ...envSipOverrides() };
```

So a set `VITE_SIP_WSS_URL` then overrides the stored per-user value. This only
bites on a build with `VITE_SIP_*` baked in, which `src/lib/sip/config.js`
describes as a dev/demo arrangement — but it means the same account can register
against two different endpoints depending on whether it just logged in or the
tab was reloaded.

## Related files

| File | Role |
|---|---|
| `src/lib/sip/sipSettings.js` | Derivation from the user/account, persistence, readiness gate |
| `src/lib/sip/config.js` | `VITE_SIP_*` env config, ICE servers, register/reconnect timings |
| `src/context/SoftphoneContext.jsx` | App-wide softphone state, connect/disconnect, logout teardown |
| `src/lib/sip/useSipPhone.js` | The sip.js `UserAgent`, registration, calls, transfer |
| `src/config.js` | The app's own `/ws` socket — unrelated to SIP |
