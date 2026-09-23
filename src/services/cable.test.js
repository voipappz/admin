import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The page's one consumer, and the verdict the /live screen shows about it.
 *
 * The verdict is pure, so every way the cable can fail is pinned here without
 * a socket — each branch is a message a person reads when the screen is not
 * live, and a wrong one sends them to the wrong machine. The instrumentation
 * is proven against the REAL @rails/actioncable connection with a fake
 * WebSocket adapter, because it wraps that library's handlers and a library
 * upgrade is exactly what would silently break it.
 */

vi.mock('../config.js', () => ({
  config: { ws: { cable: 'ws://node.test:4000/cable' } },
}));

const { cableVerdict, getConsumer, resetCable, __cable, STALE_AFTER_MS } = await import('./cable.js');
const { adapters } = await import('@rails/actioncable');

const NOW = 1_800_000_000_000;

const conn = (over = {}) => ({
  configured: true,
  tokenSource: 'portal',
  tokenExpiresAt: null,
  state: 'open',
  welcomedAt: NOW - 1000,
  pingedAt: NOW - 1000,
  disconnectReason: null,
  reconnectAttempts: 0,
  monitorRunning: true,
  lastCloseAt: null,
  ...over,
});

describe('cableVerdict', () => {
  it('is Live when the socket is welcomed, pinging and the subscription confirmed', () => {
    expect(cableVerdict(conn(), { status: 'confirmed' }, NOW)).toMatchObject({ level: 'ok', label: 'Live' });
  });

  it('is Connected when nothing has subscribed yet', () => {
    expect(cableVerdict(conn(), null, NOW)).toMatchObject({ level: 'ok', label: 'Connected' });
  });

  it('waits for the confirmation rather than claiming live', () => {
    expect(cableVerdict(conn(), { status: 'pending' }, NOW)).toMatchObject({ level: 'warn', label: 'Subscribing…' });
  });

  it('names a missing cable URL', () => {
    expect(cableVerdict(conn({ configured: false }), null, NOW)).toMatchObject({ level: 'error', label: 'Not configured' });
  });

  it('names a missing session', () => {
    expect(cableVerdict(conn({ tokenSource: null }), null, NOW)).toMatchObject({ level: 'error', label: 'No session' });
  });

  it('names an expired token before anything the socket says', () => {
    expect(cableVerdict(conn({ tokenExpiresAt: NOW - 1 }), { status: 'confirmed' }, NOW))
      .toMatchObject({ level: 'error', label: 'Token expired' });
  });

  it('says the token was refused when the node sends ActionCable’s unauthorized frame', () => {
    const v = cableVerdict(conn({ state: 'closed', welcomedAt: null, disconnectReason: 'unauthorized', monitorRunning: false }), null, NOW);
    expect(v).toMatchObject({ level: 'error', label: 'Token refused' });
    expect(v.hint).toMatch(/SECRET_KEY/);
  });

  it('points at the override when it is the override that was refused', () => {
    const v = cableVerdict(conn({ tokenSource: 'override', disconnectReason: 'unauthorized' }), null, NOW);
    expect(v.hint).toMatch(/va_cable_token/);
  });

  it('reports a rejected subscription as its own failure', () => {
    expect(cableVerdict(conn(), { status: 'rejected' }, NOW)).toMatchObject({ level: 'error', label: 'Subscription rejected' });
  });

  it('calls a link stale after two missed pings, as the client’s monitor does', () => {
    const v = cableVerdict(conn({ pingedAt: NOW - STALE_AFTER_MS - 1000 }), { status: 'confirmed' }, NOW);
    expect(v.level).toBe('warn');
    expect(v.label).toMatch(/^Stale — no ping for \d+s$/);
  });

  it('reports reconnecting with the attempt while the monitor is still trying', () => {
    const v = cableVerdict(conn({ state: 'connecting', welcomedAt: null, lastCloseAt: NOW - 5000, reconnectAttempts: 3 }), null, NOW);
    expect(v).toMatchObject({ level: 'warn', label: 'Reconnecting (attempt 3)' });
  });

  it('says Connecting on the very first attempt', () => {
    expect(cableVerdict(conn({ state: 'connecting', welcomedAt: null }), null, NOW)).toMatchObject({ label: 'Connecting…' });
  });

  it('calls a close before welcome with no retry a refusal, even without a reason (an older node)', () => {
    const v = cableVerdict(conn({ state: 'closed', welcomedAt: null, monitorRunning: false }), null, NOW);
    expect(v).toMatchObject({ level: 'error', label: 'Refused' });
  });

  it('says Disconnected when an accepted link closed and nothing will reopen it', () => {
    expect(cableVerdict(conn({ state: 'closed', monitorRunning: false }), null, NOW))
      .toMatchObject({ level: 'error', label: 'Disconnected' });
  });
});

/** A WebSocket the real ActionCable connection can drive, and a test can speak through. */
class FakeSocket {
  static last = null;
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0;
    this.sent = [];
    FakeSocket.last = this;
  }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; this.onclose?.({ code: 1000 }); }
  // The node negotiates the subprotocol; without it the client closes as unsupported.
  open() { this.readyState = 1; this.protocol = 'actioncable-v1-json'; this.onopen?.({}); }
  frame(obj) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}
FakeSocket.CONNECTING = 0;
FakeSocket.OPEN = 1;
FakeSocket.CLOSING = 2;
FakeSocket.CLOSED = 3;

describe('the page consumer', () => {
  const realSocket = adapters.WebSocket;

  beforeEach(() => {
    resetCable();
    __cable.reset();
    localStorage.clear();
    adapters.WebSocket = FakeSocket;
    return () => { adapters.WebSocket = realSocket; resetCable(); };
  });

  it('has no consumer without a session token', () => {
    expect(getConsumer()).toBeNull();
  });

  it('is one consumer for the page', () => {
    localStorage.setItem('user_auth', JSON.stringify({ token: 'tok' }));
    expect(getConsumer()).toBe(getConsumer());
  });

  it('connects with the current token and the ActionCable subprotocol', () => {
    localStorage.setItem('user_auth', JSON.stringify({ token: 'login-tok' }));
    localStorage.setItem('va_cable_token', 'override-tok');
    getConsumer().subscriptions.create({ channel: 'LiveChannel', environment_uuid: 'e' }, {});

    expect(FakeSocket.last.url).toBe('ws://node.test:4000/cable?token=override-tok');
    expect(FakeSocket.last.protocols).toContain('actioncable-v1-json');
  });

  it('subscribes only after welcome, and records the handshake and the heartbeat', () => {
    localStorage.setItem('user_auth', JSON.stringify({ token: 'tok' }));
    getConsumer().subscriptions.create({ channel: 'LiveChannel', environment_uuid: 'e' }, {});
    const ws = FakeSocket.last;

    ws.open();
    expect(ws.sent).toEqual([]);

    ws.frame({ type: 'welcome' });
    expect(ws.sent[0]).toMatchObject({ command: 'subscribe' });

    ws.frame({ type: 'ping', message: 1 });
    const snap = __cable.snapshot();
    expect(snap.state).toBe('open');
    expect(snap.welcomedAt).toEqual(expect.any(Number));
    expect(snap.pingedAt).toEqual(expect.any(Number));
    expect(snap.monitorRunning).toBe(true);
  });

  it('stops reconnecting when the node refuses the token, and says why', () => {
    localStorage.setItem('user_auth', JSON.stringify({ token: 'tok' }));
    const consumer = getConsumer();
    consumer.subscriptions.create({ channel: 'LiveChannel', environment_uuid: 'e' }, {});
    const ws = FakeSocket.last;
    ws.open();

    ws.frame({ type: 'disconnect', reason: 'unauthorized', reconnect: false });

    expect(consumer.connection.monitor.isRunning()).toBe(false);
    const snap = __cable.snapshot();
    expect(snap.disconnectReason).toBe('unauthorized');
    expect(snap.state).toBe('closed');
    expect(snap.monitorRunning).toBe(false);
  });
});
