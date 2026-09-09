# VoIPAppz Chrome Extension

#
Screen pops, call state and agent availability, live in the browser.

## Install

**The install guide lives on the node you are installing against**, at
`https://<your-node>/release` — because the two things people get wrong there
are which build this is and which address it talks to, and only the node
serving the package can answer either.

That page carries the download, the version, the SHA-256, the sign-in fields
with the domain already filled in, and the troubleshooting table. This file
used to hold a copy of all of it, pointing at a GitHub release that was the
same zip for every customer.

```
https://<your-node>/release           the page
https://<your-node>/release/download  the package
https://<your-node>/release/info      the same facts, as JSON
```

The extension is built into the portal image (the node stage in
`Dockerfile.production`) and stamped with the portal's own version, so the
build a node hands out is always the one it is running.

## Realtime feed

Sign-in works against any node serving `/auth/user_login`. Events additionally
need a NATS `websocket` listener, a `/nats` route at the edge, and a NATS user
matching the credential in `chrome/src/backgroundPage.ts`. **That user is not
configured yet** — the shared credential would need a wildcard
`notifications.>` subscribe, which is a cross-tenant read. Per-user scoping via
NATS `auth_callout` is the intended fix; until then the feed is inert.

## Develop

```bash
npm ci --legacy-peer-deps
npm run watch                                            # → angular/dist
NODE_OPTIONS=--openssl-legacy-provider npm run build:production
npm run test:e2e                                         # needs TEST_DOMAIN/USERNAME/PASSWORD
```

Load `angular/dist` unpacked. Background and content script changes need a
reload in `chrome://extensions`; popup changes don't. The legacy OpenSSL flag is
required on Node 17+ (webpack 4).

`angular/` is the popup UI, `chrome/src/` the background worker and content script.
