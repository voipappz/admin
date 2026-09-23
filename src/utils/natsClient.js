// Browser NATS client over WebSocket (nats.ws).
//
// Counterpart of services/cable.js: instead of subscribing to the cable
// bridge (StateChannel), consumers subscribe straight to the NATS subjects the
// node publishes — `state.<scope>.<uuid>` (see va-crystal
// node/realtime/state_channel.cr). Browsers cannot open raw TCP to NATS, so
// this requires the server's websocket listener (va-crystal
// nats/nats-server.conf, port 9222; wss:// behind TLS in production).
//
// Auth: the session JWT is passed as the connection token. It is ignored
// until the NATS auth callout is wired (va-crystal nats/AUTH_CALLOUT.md), at
// which point the server starts enforcing subject-scoped permissions.

import { connect } from 'nats.ws';

let ncPromise = null;

const decoder = new TextDecoder();

// wss URL for the NATS websocket listener.
// VITE_NATS_WS_URL wins; else derive from the page origin (nginx is expected
// to proxy /nats to the listener in deployed environments).
export function natsWsUrl() {
  const explicit = import.meta.env?.VITE_NATS_WS_URL;
  if (explicit) return explicit;
  if (typeof window !== 'undefined' && window.location?.host) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/nats`;
  }
  return 'ws://localhost:9222';
}

// Lazily connect (once) and share the connection app-wide.
export function getNatsConnection({ token } = {}) {
  if (!ncPromise) {
    ncPromise = connect({
      servers: [natsWsUrl()],
      token,
      reconnect: true,
      maxReconnectAttempts: -1,
      waitOnFirstConnect: true,
      name: 'nimbus-admin',
    }).catch((err) => {
      ncPromise = null; // allow a later retry
      throw err;
    });
  }
  return ncPromise;
}

// Subscribe to one entity's state stream: scope ∈ user | queue | call |
// environment | campaign | conference | extension. Returns an unsubscribe fn.
export async function subscribeState(scope, id, onMessage, opts = {}) {
  const nc = await getNatsConnection(opts);
  const sub = nc.subscribe(`state.${scope}.${id}`);
  (async () => {
    for await (const msg of sub) {
      let payload;
      try { payload = JSON.parse(decoder.decode(msg.data)); }
      catch { payload = decoder.decode(msg.data); }
      try { onMessage(payload); } catch { /* consumer errors don't kill the loop */ }
    }
  })();
  return () => sub.unsubscribe();
}

export async function closeNatsConnection() {
  if (!ncPromise) return;
  const nc = await ncPromise.catch(() => null);
  ncPromise = null;
  if (nc) await nc.close().catch(() => {});
}
