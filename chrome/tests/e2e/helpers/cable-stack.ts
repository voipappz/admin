/**
 * The cable-events stack, from the extension suite's side.
 *
 * A copy of the few things `tests/cable-events/helpers.ts` provides — token,
 * NATS publisher, event shape — rather than an import: that file lives in the
 * root package, which is ESM, and this suite is CJS; Playwright transpiles
 * each under its own package.json and the import dies with "exports is not
 * defined". Keep the two in step by hand; they are small on purpose.
 */
import { createHmac, randomUUID } from 'crypto';
import * as net from 'net';
import * as path from 'path';

export const PORTS = {
  portal: Number(process.env.CABLE_EVENTS_PORTAL_PORT || 14001),
  nats: Number(process.env.CABLE_EVENTS_NATS_PORT || 14222),
};
export const PORTAL = `http://127.0.0.1:${PORTS.portal}`;
export const SECRET = process.env.CABLE_EVENTS_SECRET || 'cable-events-test-secret';
export const COMPOSE = ['-f', path.resolve(__dirname, '../../../../tests/cable-events/docker-compose.yml')];

export const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');
export const uuid = () => randomUUID();
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Identity { user: string; env: string; account: string }
export const identity = (): Identity => ({ user: uuid(), env: uuid(), account: uuid() });

/** A user token the node's `verify` accepts. */
export function mint(id: Identity, secret = SECRET): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ user_uuid: id.user, account_uuid: id.account, environment_uuids: [id.env] }));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** PUB one JSON payload and resolve once the broker PONGs. */
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
        sock.write(`CONNECT {"verbose":false,"pedantic":false,"name":"portal-receive-spec"}\r\n` +
                   `PUB ${subject} ${Buffer.byteLength(body)}\r\n${body}\r\nPING\r\n`);
      }
      const err = buf.match(/-ERR[^\r\n]*/);
      if (err) { clearTimeout(timer); sock.destroy(); reject(new Error(`nats: ${err[0]}`)); return; }
      if (sent && buf.includes('PONG')) { clearTimeout(timer); sock.end(); resolve(); }
    });
    sock.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

/** The normalized call event va-crystal publishes on `call_events`. */
export function callEvent(id: Identity, over: Record<string, unknown> = {}) {
  const call = uuid();
  return {
    type: 'call', action: 'user.answer', id: call, call_uuid: call,
    user_uuid: id.user, environment_uuid: id.env,
    caller_id_number: '0500000000', occurred_at: new Date().toISOString(),
    ...over,
  };
}
