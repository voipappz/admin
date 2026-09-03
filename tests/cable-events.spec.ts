import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import {
  PORTAL, COMPOSE, identity, mint, publish, publishUntil, openEvents, callEvent,
  screenPopMetrics, metricsDelta, brokerClients, uuid, sleep, type Events,
  waitEslConsumer, emitEsl, callcenterEsl, subscribeOnce,
} from './cable-events/helpers';

/**
 * The relay direction, driven through the REAL chain and nothing mocked:
 *
 *   NATS subject ──> va-crystal node (cable) ──> Elixir portal ──> /ws/events
 *
 * Two connections are on trial — Elixir → cable (A) and, for the screen-pop
 * executor that rides on it, the contract it implements (C) — and they are
 * tried the way they fail in production: a token the node must verify, a
 * subscribe the node must confirm, a node that goes away and comes back, a
 * portal that restarts, and events for the wrong person.
 *
 * `docs/cable-events-spec.md` is the contract; the scenario numbers here are
 * its Verification section. Gated on CABLE_EVENTS=1 because it needs the
 * stack in tests/cable-events/ — `make test-cable`, or the cable-events CI job.
 *
 * SERIAL. Every scenario shares one stack, and the restart scenarios run last
 * so a half-recovered node cannot poison the ones before them.
 */
test.describe.configure({ mode: 'serial' });
test.skip(process.env.CABLE_EVENTS !== '1', 'needs the cable-events stack — run through make test-cable');

const compose = (...args: string[]) =>
  execFileSync('docker', ['compose', ...COMPOSE, ...args], { stdio: 'pipe' }).toString();

async function health() {
  const res = await fetch(`${PORTAL}/health`);
  expect(res.status, 'GET /health').toBe(200);
  return res.json() as Promise<{ status: string; checks: Record<string, { status: string; detail?: string }> }>;
}

/** Wait until /health says the node has confirmed the relay again (after a restart). */
async function waitForRelay(ms = 60_000) {
  const deadline = Date.now() + ms;
  let last: any;
  while (Date.now() < deadline) {
    try { last = await health(); if (last.checks.api_relay.status === 'ok' && last.checks.cable.status === 'ok') return last; }
    catch { /* portal itself restarting */ }
    await sleep(1000);
  }
  throw new Error(`relay not confirmed within ${ms}ms; last /health: ${JSON.stringify(last)}`);
}

/** A per-user socket whose upstream cable subscriptions are proven live: a
 *  `notifications:<uuid>` publish came back through it. */
async function liveUser() {
  const id = identity();
  const events = await openEvents(mint(id));
  const marker = uuid();
  await publishUntil(events, `notifications:${id.user}`,
    () => ({ type: 'agent', message: { type: 'ringing', call: { uuid: marker }, screen: { uuid: 'scr' } } }),
    (f) => f.type === 'notification' && f.message?.message?.call?.uuid === marker);
  return { id, events };
}

// ── A. Elixir → cable ─────────────────────────────────────────────────────

test('A1 the node has confirmed the portal\'s ApiProxy subscribe', async () => {
  const h = await health();
  expect(h.checks.cable, 'CABLE_URL configured').toEqual({ status: 'ok' });
  // Green only on a CONFIRMED subscribe. A node that accepts the socket and
  // never answers the subscribe leaves this "down" while everything else
  // looks fine — which is the state this scenario exists to catch.
  expect(h.checks.api_relay, 'node confirmed the ApiProxy channel').toEqual({ status: 'ok' });
});

test('A2 tokens are verified by the node: right secret in, wrong secret out', async () => {
  const id = identity();
  const ok = await openEvents(mint(id));
  expect(ok.frames[0].type).toBe('welcome');
  ok.close();
  // Same claims, a different signing key. If this is welcomed, the portal is
  // not asking the node — and a permissive verifier would have passed the
  // first half of this test on its own.
  await expect(openEvents(mint(id, 'not-the-node-secret'))).rejects.toThrow(/closed before welcome/);
});

test('A3 the per-user cable connection is opened and its streams deliver', async () => {
  const { id, events } = await liveUser();
  // A second publish on the now-confirmed stream is delivered verbatim —
  // `message` is the upstream payload untouched (REALTIME_CONTRACT.md).
  const payload = { type: 'agent', message: { type: 'ringing', call: { uuid: uuid() }, screen: { uuid: 'scr-2' } } };
  await publish(`notifications:${id.user}`, payload);
  const f = await events.next((x) => x.type === 'notification' && x.message?.message?.call?.uuid === payload.message.call.uuid, 5000);
  expect(f, 'second notification delivered').not.toBeNull();
  expect(f!.message).toEqual(payload);
  events.close();
});

test('A7 the portal holds no broker connection', async () => {
  // From the broker's side: every client identifies its language on CONNECT.
  // The node is crystal, this spec names itself; an Elixir client (gnat sends
  // lang "elixir") would be the portal talking to NATS behind cable's back.
  const clients = await brokerClients();
  const langs = clients.map((c) => `${c.lang || '?'}:${c.name || '?'}`);
  expect(clients.length, `broker clients: ${langs.join(', ')}`).toBeGreaterThan(0);
  expect(clients.some((c) => (c.lang || '').toLowerCase().includes('elixir')), `an Elixir client is on the broker: ${langs.join(', ')}`).toBe(false);
});

// ── C. The screen-pop contract (Crystal event → Elixir executor → browser command) ──

test.describe('C the screen-pop executor', () => {
  let user: { id: ReturnType<typeof identity>; events: Events };

  test.beforeAll(async () => { user = await liveUser(); });
  test.afterAll(() => user?.events.close());

  test('C1 a matching user.answer becomes exactly {action, url} for that user', async () => {
    const before = await screenPopMetrics();
    const f = await publishUntil(user.events, 'call_events', () => callEvent(user.id),
      (x) => x.type === 'notification' && x.message?.action === 'tab:new');
    expect(f.message.url).toMatch(/^https:\/\//);
    // Identity stripped: the browser gets a command, not the event.
    expect(Object.keys(f.message).sort()).toEqual(['action', 'url']);
    const d = metricsDelta(before, await screenPopMetrics());
    expect(d.dispatched, `metrics Δ ${JSON.stringify(d)}`).toBeGreaterThanOrEqual(1);
  });

  test('C2 the same event id is executed once', async () => {
    const ev = callEvent(user.id);
    await publishUntil(user.events, 'call_events', () => ev, (x) => x.type === 'notification' && x.message?.action === 'tab:new');
    const before = await screenPopMetrics();
    await publish('call_events', ev);
    const again = await user.events.next((x) => x.type === 'notification' && x.message?.action === 'tab:new', 2000);
    expect(again, 'a second tab:new for the same event id').toBeNull();
    const d = metricsDelta(before, await screenPopMetrics());
    expect(d.duplicate, `metrics Δ ${JSON.stringify(d)}`).toBeGreaterThanOrEqual(1);
    expect(d.dispatched || 0).toBe(0);
  });

  for (const [name, over, expectLabel] of [
    ['C3 another user\'s event (same environment)', { user_uuid: uuid() }, 'offline'],
    ['C4 another environment\'s event (same user)', { environment_uuid: uuid() }, undefined],
    ['C5 an event with no environment', { environment_uuid: undefined }, undefined],
    ['C5 an event with no id', { id: undefined, call_uuid: undefined }, 'rejected'],
    ['C6 a non-trigger action', { action: 'user.ringing' }, 'rejected'],
  ] as const) {
    test(`${name} is dropped`, async () => {
      const before = await screenPopMetrics();
      await publish('call_events', callEvent(user.id, over as any));
      // "Nothing" is proven by ordering: a marker that MUST arrive is published
      // behind it on the same stream, and only the marker may show up.
      const marker = callEvent(user.id);
      const got = await publishUntil(user.events, 'call_events', () => marker,
        (x) => x.type === 'notification' && x.message?.action === 'tab:new');
      expect(got.message.action).toBe('tab:new');
      const d = metricsDelta(before, await screenPopMetrics());
      expect(d.dispatched, `only the marker dispatched; metrics Δ ${JSON.stringify(d)}`).toBe(1);
      if (expectLabel) expect(d[expectLabel], `counted as ${expectLabel}; Δ ${JSON.stringify(d)}`).toBeGreaterThanOrEqual(1);
    });
  }

  test('C7 a user notification is relayed verbatim, identity and all', async () => {
    // The legacy mothership pop and the call-state notifications ride the
    // per-user Notifications stream untouched — the executor only owns
    // CallEvents. This pins that the two paths stay distinct.
    const payload = { action: 'tab:new', url: `https://crm.example.test/${uuid()}` };
    await publish(`notifications:${user.id.user}`, payload);
    const f = await user.events.next((x) => x.type === 'notification' && x.message?.url === payload.url, 5000);
    expect(f, 'legacy notification relayed').not.toBeNull();
    expect(f!.message).toEqual(payload);
  });

  test('C8 another user\'s socket sees none of it', async () => {
    const other = await liveUser();
    const before = other.events.frames.length;
    await publish(`notifications:${user.id.user}`, { type: 'agent', message: { type: 'hangup', call: { uuid: uuid() } } });
    await publishUntil(user.events, 'call_events', () => callEvent(user.id), (x) => x.type === 'notification' && x.message?.action === 'tab:new');
    await sleep(1000);
    expect(other.events.frames.slice(before), 'frames on the other user\'s socket').toEqual([]);
    other.events.close();
  });
});

// ── D. From the switch: a FreeSWITCH event mimicked into the node ───────────
//
// Everything above publishes what the node WOULD publish. These push the
// FreeSWITCH event itself into the node over ESL (the faked switch in the
// stack) and watch each hop: first what the node puts on the broker — the
// crystal component on its own — then what the portal makes of it.

test.describe('D the switch reports, the node normalises, the portal executes', () => {
  let user: { id: ReturnType<typeof identity>; events: Events };

  test.beforeAll(async () => {
    await waitEslConsumer();
    user = await liveUser();
  });
  test.afterAll(() => user?.events.close());

  test('D1 crystal: an agent answering becomes a call_events message with its identity on top', async () => {
    const callUuid = uuid();
    const seen = subscribeOnce('call_events', (m) => m.type_uuid === callUuid || m.call_uuid === callUuid, 10_000);
    await sleep(200); // the SUB must be registered before the event is emitted
    await emitEsl(callcenterEsl('bridge-agent-start', user.id, callUuid));
    const msg = await seen;
    expect(msg, 'the node published nothing for the event on call_events').not.toBeNull();
    // The shape the executor reads: identity at the top level, not only in
    // metadata (sessions.cr stamp_identity), the mothership's event name,
    // and a stable id.
    expect(msg).toMatchObject({
      type: 'call', action: 'user.answer', type_uuid: callUuid,
      user_uuid: user.id.user, environment_uuid: user.id.env, call_uuid: callUuid,
    });
    expect(typeof msg.node_uuid).toBe('string');
    expect(typeof msg.occurred_at).toBe('string');
  });

  test('D2 the whole chain from the switch: bridge-agent-start opens a tab for that agent', async () => {
    const before = await screenPopMetrics();
    const callUuid = uuid();
    // Re-emitting the same call is safe: the node re-publishes it under the
    // same type_uuid and the executor executes it once — so an event that
    // raced the subscription is simply pushed again.
    const f = await (async () => {
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        await emitEsl(callcenterEsl('bridge-agent-start', user.id, callUuid));
        const got = await user.events.next((x) => x.type === 'notification' && x.message?.action === 'tab:new', 1000);
        if (got) return got;
      }
      throw new Error(`no tab:new after ESL bridge-agent-start; frames: ${JSON.stringify(user.events.frames.slice(-5))}`);
    })();
    expect(Object.keys(f.message).sort()).toEqual(['action', 'url']);
    await sleep(500);
    const d = metricsDelta(before, await screenPopMetrics());
    expect(d.dispatched, `metrics Δ ${JSON.stringify(d)}`).toBe(1);
  });

  test('D3 the offer (agent-offering → user.ringing) reaches the portal and is not a pop', async () => {
    const callUuid = uuid();
    const seen = subscribeOnce('call_events', (m) => (m.type_uuid === callUuid || m.call_uuid === callUuid), 10_000);
    await sleep(200);
    const before = await screenPopMetrics();
    await emitEsl(callcenterEsl('agent-offering', user.id, callUuid));
    const msg = await seen;
    expect(msg, 'the node published nothing for the offer').not.toBeNull();
    expect(msg.action).toBe('user.ringing');
    // Then a marker answer on ANOTHER call must arrive — and only it.
    const marker = uuid();
    const got = await (async () => {
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        await emitEsl(callcenterEsl('bridge-agent-start', user.id, marker));
        const f = await user.events.next((x) => x.type === 'notification' && x.message?.action === 'tab:new', 1000);
        if (f) return f;
      }
      throw new Error('marker answer never popped');
    })();
    expect(got.message.action).toBe('tab:new');
    await sleep(300);
    const d = metricsDelta(before, await screenPopMetrics());
    expect(d.dispatched, `only the marker dispatched; Δ ${JSON.stringify(d)}`).toBe(1);
    expect(d.rejected, `the offer counted as rejected; Δ ${JSON.stringify(d)}`).toBeGreaterThanOrEqual(1);
  });

  test('D4 an event for an agent nobody is logged in as pops nothing', async () => {
    const nobody = identity();
    const before = await screenPopMetrics();
    await emitEsl(callcenterEsl('bridge-agent-start', nobody));
    const marker = uuid();
    await (async () => {
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        await emitEsl(callcenterEsl('bridge-agent-start', user.id, marker));
        if (await user.events.next((x) => x.type === 'notification' && x.message?.action === 'tab:new', 1000)) return;
      }
      throw new Error('marker answer never popped');
    })();
    await sleep(300);
    const d = metricsDelta(before, await screenPopMetrics());
    expect(d.dispatched, `Δ ${JSON.stringify(d)}`).toBe(1);
    expect((d.offline || 0) + (d.unloaded || 0), `the stranger's event counted offline/unloaded; Δ ${JSON.stringify(d)}`).toBeGreaterThanOrEqual(1);
  });
});

// ── A, continued: recovery. Last, on purpose. ───────────────────────────────
//
// Each of these waits on real backoff (the portal reconnects with up to 30s
// between attempts, then re-subscribes every per-user stream), so the budget
// is theirs, not the config default's. Phases are logged with their durations
// so a failure says which hop was slow.

const phase = (() => { let t = Date.now(); return (label: string) => { const now = Date.now(); console.log(`    ${label} +${now - t}ms`); t = now; }; })();

test('A4 the node restarts: the portal reconnects, re-subscribes, and delivers again', async () => {
  test.setTimeout(180_000);
  const { id, events } = await liveUser();
  phase('user live before the restart');
  let browserClosed = false;
  events.socket.addEventListener('close', () => { browserClosed = true; });

  compose('restart', 'cable');
  phase('node restarted');
  await waitForRelay();
  phase('relay confirmed again');
  // The BROWSER socket must have survived: the portal's reconnect is its own
  // business, and a reload on every node hiccup is what users would notice.
  expect(browserClosed, 'the portal closed the browser socket during the node restart').toBe(false);

  const marker = uuid();
  await publishUntil(events, `notifications:${id.user}`,
    () => ({ type: 'agent', message: { type: 'ringing', call: { uuid: marker }, screen: { uuid: 'after-node-restart' } } }),
    (f) => f.type === 'notification' && f.message?.message?.call?.uuid === marker, 60_000);
  phase('delivered on the surviving browser socket');
  events.close();
});

test('A5 the portal restarts: a new socket is welcomed and delivered to, nothing persisted', async () => {
  test.setTimeout(180_000);
  compose('restart', 'portal');
  phase('portal restarted');
  await waitForRelay(90_000);
  phase('relay confirmed again');
  const { events } = await liveUser();  // welcome + a delivered publish IS the assertion
  phase('new user live');
  events.close();
});

test('A6 with the node down, an upgrade is refused within a bound — never hung', async () => {
  test.setTimeout(180_000);
  compose('stop', 'cable');
  phase('node stopped');
  try {
    const t0 = Date.now();
    await expect(openEvents(mint(identity()))).rejects.toThrow(/closed before welcome/);
    expect(Date.now() - t0, 'refusal took too long — no HTTP fallback may be hiding here').toBeLessThan(15_000);
  } finally {
    compose('start', 'cable');
    await waitForRelay(90_000);
    phase('node back, relay confirmed');
  }
});
