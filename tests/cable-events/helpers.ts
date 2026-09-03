/**
 * The three things the cable-events scenarios need, with no dependencies:
 *
 *   - a token the node will verify (HS256 with the stack's shared secret);
 *   - a NATS publisher — the raw protocol, INFO → CONNECT → PUB → PING/PONG,
 *     because a PONG after the PUB is the broker saying it processed it;
 *   - a /ws/events client that records every frame and can wait for one.
 *
 * Plus the two rules that make the scenarios honest: publish-until-received
 * (cable has NO replay between subscribe and confirm, so a single publish can
 * be lost with nothing wrong), and "nothing arrived" proven by a following
 * marker on the same stream, never by a bare timeout.
 */
import { createHmac, randomUUID } from 'node:crypto';
import net from 'node:net';

export const PORTS = {
  portal: Number(process.env.CABLE_EVENTS_PORTAL_PORT || 14001),
  cable: Number(process.env.CABLE_EVENTS_CABLE_PORT || 14100),
  nats: Number(process.env.CABLE_EVENTS_NATS_PORT || 14222),
  natsMon: Number(process.env.CABLE_EVENTS_NATS_MON_PORT || 18222),
};
export const PORTAL = `http://127.0.0.1:${PORTS.portal}`;
export const SECRET = process.env.CABLE_EVENTS_SECRET || 'cable-events-test-secret';
export const COMPOSE = ['-f', new URL('./docker-compose.yml', import.meta.url).pathname];

export const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');
export const uuid = () => randomUUID();

export interface Identity { user: string; env: string; account: string }
export const identity = (): Identity => ({ user: uuid(), env: uuid(), account: uuid() });

/** A user token the node's `verify` accepts — or, with `secret` wrong, refuses. */
export function mint(id: Identity, secret = SECRET): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    user_uuid: id.user, account_uuid: id.account, environment_uuids: [id.env],
  }));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** PUB one JSON payload and resolve once the broker PONGs — i.e. it took it. */
export function publish(subject: string, payload: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const sock = net.connect({ host: '127.0.0.1', port: PORTS.nats });
    let buf = '', sent = false;
    const timer = setTimeout(() => { sock.destroy(); reject(new Error(`nats: no PONG within 5s for ${subject}`)); }, 5000);
    sock.on('data', (chunk) => {
      buf += chunk.toString();
      if (!sent && buf.startsWith('INFO')) {
        sent = true;
        sock.write(`CONNECT {"verbose":false,"pedantic":false,"name":"cable-events-spec"}\r\n` +
                   `PUB ${subject} ${Buffer.byteLength(body)}\r\n${body}\r\nPING\r\n`);
      }
      const err = buf.match(/-ERR[^\r\n]*/);
      if (err) { clearTimeout(timer); sock.destroy(); reject(new Error(`nats: ${err[0]}`)); return; }
      if (sent && buf.includes('PONG')) { clearTimeout(timer); sock.end(); resolve(); }
    });
    sock.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

export type Frame = Record<string, any>;

export interface Events {
  frames: Frame[];
  socket: WebSocket;
  /** The next frame matching `pred` that arrives after this call, or null after `ms`. */
  next(pred: (f: Frame) => boolean, ms: number): Promise<Frame | null>;
  close(): void;
}

/**
 * Open /ws/events with the bearer subprotocol and resolve after `welcome`.
 * Rejects with the close code when the portal refuses the upgrade — a refusal
 * closes the socket before any frame, which is what "auth refused" looks like.
 */
export function openEvents(token: string, base = PORTAL): Promise<Events> {
  return new Promise((resolve, reject) => {
    const url = base.replace(/^http/, 'ws') + '/ws/events';
    const frames: Frame[] = [];
    const waiters: Array<{ pred: (f: Frame) => boolean; resolve: (f: Frame) => void }> = [];
    let welcomed = false;
    const socket = new WebSocket(url, ['voipappz-bearer.' + b64url(token)]);
    // A refused upgrade surfaces as `error` and/or `close`, and WHICH ones fire
    // differs between Node versions (22's undici reported only `error` in CI,
    // 20's fired `close`). Both refuse, and a deadline refuses too: a socket
    // that never answers must read as a refusal, never as a hang.
    const refuse = (why: string) => {
      clearTimeout(deadline);
      if (!welcomed) reject(new Error(`/ws/events closed before welcome — ${why} — the portal refused the upgrade`));
    };
    const deadline = setTimeout(() => refuse('no welcome within 15s'), 15_000);
    socket.onmessage = (ev) => {
      let f: Frame; try { f = JSON.parse(String(ev.data)); } catch { return; }
      frames.push(f);
      if (f.type === 'welcome' && !welcomed) { welcomed = true; clearTimeout(deadline); resolve(api); return; }
      for (const w of [...waiters]) if (w.pred(f)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(f); }
    };
    socket.onerror = () => refuse('error event');
    socket.onclose = (ev) => refuse(`close code ${ev.code}`);
    const api: Events = {
      frames, socket,
      next(pred, ms) {
        return new Promise((res) => {
          const w = { pred, resolve: (f: Frame) => { clearTimeout(t); res(f); } };
          const t = setTimeout(() => { waiters.splice(waiters.indexOf(w), 1); res(null); }, ms);
          waiters.push(w);
        });
      },
      close() { try { socket.close(); } catch { /* already closed */ } },
    };
  });
}

/**
 * Publish every 500ms until a frame matching `pred` arrives on `events`, or
 * give up after `ms`. `make` builds each attempt's payload, so a scenario that
 * must not repeat an id (dedupe) can mint a fresh one per try.
 */
export async function publishUntil(
  events: Events, subject: string, make: () => unknown, pred: (f: Frame) => boolean, ms = 20_000,
): Promise<Frame> {
  const deadline = Date.now() + ms;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts++;
    await publish(subject, make());
    const f = await events.next(pred, 500);
    if (f) return f;
  }
  throw new Error(`nothing matching arrived on /ws/events after ${attempts} publishes to ${subject} in ${ms}ms; frames seen: ${JSON.stringify(events.frames.slice(-5))}`);
}

/** The screen-pop counters from /metrics, by result label. */
export async function screenPopMetrics(base = PORTAL): Promise<Record<string, number>> {
  const text = await (await fetch(`${base}/metrics`)).text();
  const out: Record<string, number> = {};
  for (const m of text.matchAll(/agents_demo_screen_pop_events_count\{result="(\w+)"\} (\d+)/g)) out[m[1]] = Number(m[2]);
  return out;
}

export const metricsDelta = (before: Record<string, number>, after: Record<string, number>) =>
  Object.fromEntries(
    [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .map((k) => [k, (after[k] || 0) - (before[k] || 0)])
      .filter(([, v]) => v !== 0),
  ) as Record<string, number>;

/** The broker's view of who is connected: {name, lang} per client. */
export async function brokerClients(): Promise<Array<{ name?: string; lang?: string; ip?: string }>> {
  const res = await fetch(`http://127.0.0.1:${PORTS.natsMon}/connz`);
  const body = await res.json() as { connections?: Array<{ name?: string; lang?: string; ip?: string }> };
  return body.connections || [];
}

/** The normalized call event the node publishes on `call_events` (enriched by va-crystal). */
export function callEvent(id: Identity, over: Record<string, unknown> = {}) {
  const call = uuid();
  return {
    type: 'call', action: 'user.answer', id: call, call_uuid: call,
    user_uuid: id.user, environment_uuid: id.env,
    caller_id_number: '0500000000', occurred_at: new Date().toISOString(),
    ...over,
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
