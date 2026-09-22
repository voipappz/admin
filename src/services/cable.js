import { useSyncExternalStore } from 'react';
import { createConsumer, ConnectionMonitor } from '@rails/actioncable';
import { config } from '../config.js';
import { cableToken, cableUrlFor, redactCableUrl, tokenExpiresAt } from '../utils/cableToken.js';

/**
 * The cable — ONE consumer for the whole page, the way ActionCable is meant to
 * be used: every screen subscribes through it, so there is one socket to the
 * node however many channels are open, and one place that knows whether it is
 * healthy.
 *
 * The client is @rails/actioncable, not a hand-rolled socket, because the
 * parts that matter are the parts that are easy to get wrong:
 *
 * - it requests the `actioncable-v1-json` subprotocol (without it the browser
 *   drops the socket before `welcome`, which reads exactly like a bad token);
 * - it sends nothing before `welcome`, and resubscribes every subscription
 *   after a reconnect, retrying each until the server confirms or rejects it;
 * - its ConnectionMonitor treats two missed server pings (6s) as a dead link
 *   and reopens with exponential backoff and jitter, and checks again when the
 *   tab becomes visible — a half-open socket is noticed, not trusted;
 * - it honours the server's `disconnect` frame: `reason: "unauthorized",
 *   reconnect: false` stops the monitor instead of retrying a refused token.
 *
 * The URL is a FUNCTION, evaluated on every (re)open, so the token that goes
 * out is always the current one — a login, or a `va_cable_token` override set
 * for a local node, is picked up by the next connect.
 */

export const STALE_AFTER_MS = (ConnectionMonitor?.staleThreshold || 6) * 1000;

let consumer = null;
const listeners = new Set();

const INITIAL = {
  state: 'idle', // idle | connecting | open | closed
  openedAt: null,
  welcomedAt: null,
  pingedAt: null,
  lastCloseAt: null,
  lastCloseCode: null,
  disconnectReason: null,
  reconnectAttempts: 0,
  monitorRunning: false,
};

let snapshot = { ...INITIAL };

function publish(patch) {
  const monitor = consumer?.connection?.monitor;
  snapshot = {
    ...snapshot,
    ...patch,
    reconnectAttempts: monitor?.reconnectAttempts || 0,
    monitorRunning: Boolean(monitor?.isRunning?.()),
  };
  listeners.forEach((fn) => fn());
}

/**
 * Observe the connection without replacing it: each socket event is recorded,
 * then handed to the library's own handler unchanged. `events` is read per
 * connection when a socket opens, so an own property set before the first
 * open is what every later socket uses.
 */
function instrument(connection) {
  const base = connection.events;
  connection.events = {
    ...base,
    open(...args) {
      publish({ state: 'open', openedAt: Date.now(), welcomedAt: null, disconnectReason: null });
      return base.open.apply(this, args);
    },
    message(event, ...rest) {
      try {
        const frame = JSON.parse(event.data);
        if (frame.type === 'welcome') publish({ welcomedAt: Date.now() });
        else if (frame.type === 'ping') publish({ pingedAt: Date.now() });
        else if (frame.type === 'disconnect') publish({ disconnectReason: frame.reason || 'unspecified' });
      } catch {
        // The library parses it too; a bad frame is its concern, not ours.
      }
      return base.message.call(this, event, ...rest);
    },
    close(event, ...rest) {
      const result = base.close.call(this, event, ...rest);
      publish({ state: 'closed', lastCloseAt: Date.now(), lastCloseCode: event?.code ?? null });
      return result;
    },
    error(...args) {
      return base.error.apply(this, args);
    },
  };
  // `open()` is where a (re)connect starts; recording it here is what makes
  // "reconnecting" visible between the close and the next socket.
  const open = connection.open.bind(connection);
  connection.open = (...args) => {
    publish({ state: 'connecting' });
    return open(...args);
  };
}

/** The page's consumer, created on first use. Null when there is no cable to use. */
export function getConsumer() {
  if (consumer) return consumer;
  if (!config?.ws?.cable || !cableToken().token) return null;
  // The library calls this on every open; a token removed since is a close
  // it cannot recover from, so it falls back to the one it was created with.
  const initial = cableToken().token;
  consumer = createConsumer(() => cableUrlFor(config.ws.cable, cableToken().token || initial));
  instrument(consumer.connection);
  return consumer;
}

/** Close the socket and forget the consumer — logout, or a token swap. */
export function resetCable() {
  if (consumer) {
    try { consumer.disconnect(); } catch { /* already closed */ }
  }
  consumer = null;
  snapshot = { ...INITIAL };
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const getSnapshot = () => snapshot;

/**
 * The connection as it is right now, plus what the page cannot see from the
 * socket alone: where it points and which token it carries.
 */
export function useCable() {
  const conn = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { token, source } = cableToken();
  return {
    ...conn,
    configured: Boolean(config?.ws?.cable),
    url: redactCableUrl(cableUrlFor(config?.ws?.cable, token)),
    tokenSource: source,
    tokenExpiresAt: tokenExpiresAt(token),
  };
}

/**
 * One verdict for the connection and a subscription on it — pure, so every
 * branch is pinned by a test without a socket.
 *
 *   level: ok | warn | error | idle
 */
export function cableVerdict(conn, sub, now = Date.now()) {
  if (!conn.configured) {
    return { level: 'error', label: 'Not configured', hint: 'No cable URL: set VITE_WS_URL (dev) or config.ws.cable.' };
  }
  if (!conn.tokenSource) {
    return { level: 'error', label: 'No session', hint: 'Sign in — the cable authenticates with the session token.' };
  }
  if (conn.tokenExpiresAt && conn.tokenExpiresAt <= now) {
    return { level: 'error', label: 'Token expired', hint: 'The node refuses an expired token. Sign in again.' };
  }
  if (conn.disconnectReason === 'unauthorized') {
    return {
      level: 'error',
      label: 'Token refused',
      hint: conn.tokenSource === 'override'
        ? 'The va_cable_token override does not verify with this node’s SECRET_KEY.'
        : 'The node’s SECRET_KEY is not the key that signed this login.',
    };
  }
  if (sub?.status === 'rejected') {
    return {
      level: 'error',
      label: 'Subscription rejected',
      hint: 'The node would not open this environment for this session — not its tenant, or it could not resolve it (broker link down).',
    };
  }
  if (conn.state === 'open' && conn.welcomedAt) {
    const quiet = now - (conn.pingedAt || conn.welcomedAt);
    if (quiet > STALE_AFTER_MS) {
      return { level: 'warn', label: `Stale — no ping for ${Math.round(quiet / 1000)}s`, hint: 'The link looks dead; the client will reopen it.' };
    }
    if (!sub || sub.status === 'idle') return { level: 'ok', label: 'Connected', hint: null };
    if (sub.status === 'confirmed') return { level: 'ok', label: 'Live', hint: null };
    return { level: 'warn', label: 'Subscribing…', hint: null };
  }
  if (conn.state === 'idle') return { level: 'idle', label: 'Not connected', hint: null };
  if (conn.state === 'closed' && !conn.monitorRunning && !conn.welcomedAt) {
    return { level: 'error', label: 'Refused', hint: 'The node closed the socket before accepting it — usually the token.' };
  }
  if (conn.state === 'closed' && !conn.monitorRunning) {
    return { level: 'error', label: 'Disconnected', hint: 'The client stopped reconnecting. Reload to try again.' };
  }
  const attempt = conn.reconnectAttempts ? ` (attempt ${conn.reconnectAttempts})` : '';
  return { level: 'warn', label: conn.state === 'connecting' && !conn.lastCloseAt ? 'Connecting…' : `Reconnecting${attempt}`, hint: null };
}

// Test seam.
export const __cable = {
  reset: () => { consumer = null; snapshot = { ...INITIAL }; listeners.clear(); },
  snapshot: () => snapshot,
};
