import { test, expect, chromium } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const EXT = path.resolve(__dirname, '../../angular/dist');
const DOMAIN = process.env.TEST_DOMAIN!;
const USER = process.env.TEST_USERNAME!;
const PASS = process.env.TEST_PASSWORD!;

/**
 * The screen pop, end to end, against a REAL stack — no mocks anywhere.
 *
 *   voipappz-api  ──NATS notifications.<uuid>──>  realtime server
 *                 ──/ws/events──>  this extension  ──>  a tab opens
 *
 * The decision to pop lives in the API (ScreenPopPopNode); the realtime server
 * only relays; the extension only opens what it is told. This asserts the whole
 * chain rather than any one hop, which is the only way the seams get tested.
 *
 * Gated on TEST_RECEIVE=1 because it needs a running stack it can publish
 * into — a realtime server at TEST_DOMAIN, and a docker daemon holding the
 * API container. Run it locally with:
 *
 *   TEST_RECEIVE=1 TEST_DOMAIN=http://127.0.0.1:4001 \
 *   TEST_USERNAME=… TEST_PASSWORD=…  npx playwright test real-receive
 *
 * TEST_DOMAIN may be http (a plain local server) or https (behind a proxy that
 * terminates TLS) — the worker follows the scheme, and a mismatch there is a
 * socket that silently never opens.
 */
test('an incoming call opens the agent tab in the extension', async () => {
  test.skip(process.env.TEST_RECEIVE !== '1',
    'set TEST_RECEIVE=1 with a running stack (see the comment above)');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-elixir-'));
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: false,
    args: ['--headless=new', '--no-sandbox', '--ignore-certificate-errors',
           `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15_000 });
    const id = sw.url().split('/')[2];

    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${id}/index.html#/main`);
    await page.waitForURL(/login/);
    await page.evaluate((d) => localStorage.setItem('_domain', d), DOMAIN);
    await page.locator('input[formcontrolname="username"]').fill(USER);
    await page.locator('input[formcontrolname="password"]').fill(PASS);
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL(/main/, { timeout: 20_000 });

    const uuid = await page.evaluate(() => localStorage.getItem('_id'));
    console.log('  logged in, user_uuid =', uuid);

    // The socket must be OPEN before publishing: the relay does not replay, so
    // anything sent before the subscription lands is simply not delivered.
    const live = await sw.evaluate(() => new Promise<boolean>((resolve) => {
      const ok = () => { const s = (self as any)._realtime; return !!s && s.readyState === 1; };
      if (ok()) return resolve(true);
      const i = setInterval(() => { if (ok()) { clearInterval(i); resolve(true); } }, 300);
      setTimeout(() => { clearInterval(i); resolve(false); }, 20_000);
    }));
    console.log('  realtime socket open:', live);
    expect(live, 'worker never opened /ws/events').toBe(true);

    // An INCOMING CALL, driven the way va-crystal drives one.
    //
    // Not a hand-made publish and not one node in isolation: this puts a
    // callcenter `agent-offering` session on `node.<uuid>` — the subject a
    // Crystal node publishes to — and lets the platform do the rest.
    // handle_node_event maps agent-offering -> user.ringing (CALLCENTER_MAPPING)
    // and appends the EventCall; the router then resolves the customer and
    // environment, selects the screen_pop service by that action, and the
    // PocketFlow graph resolves the agent, looks the caller up and publishes.
    //
    // So what is asserted is the whole chain a real ring takes:
    //   node.* -> user.ringing -> service selection -> screen pop -> NATS
    //   -> Elixir /ws/events -> this extension -> a tab
    //
    // Only the CRM is stubbed (POWERLINK_API_URL): it is a third-party HTTP
    // call to Fireberry, and the accountid it returns is what the pop node
    // templates into record_url.
    const contactId = 'contact-4242';
    const ruby = `
require_relative 'lib/application'
require 'nats/io/client'
$nats = NATS::IO::Client.new
$nats.connect(servers: [ENV['NATS_URL']], connect_timeout: 3)

user = ::User['${uuid}'] or abort 'no such user: ${uuid}'
env  = ::Environment[user.environment_uuid] or abort 'user has no environment'
call_uuid = SecureRandom.uuid

# The session a Crystal node publishes for an agent being offered a call.
# environment_uuid is what the router resolves the customer from; user_uuid is
# what ScreenPopResolveAgentNode resolves the agent from.
session = {
  type: 'callcenter', action: 'agent-offering',
  call_uuid: call_uuid,
  user_uuid: user.uuid,
  environment_uuid: env.uuid,
  caller_id_number: '0501234567'
}

# data is hstore, not jsonb — hstore has -> (text), not ->>.
ringing = ::Event.where(Sequel.lit("data -> 'action' = 'user.ringing'"))
before = ringing.count
handle_node_event(MultiJson.dump(session))

ev = ringing.order(Sequel.desc(:created_at)).first
abort 'no user.ringing event was appended' unless ev
STDERR.puts "ringing events: #{before} -> #{ringing.count} (routing #{ev.event_id})"

# The consumer half, exactly as Call#event_calls_process! runs it.
Mediators::Event::EventStoreRouter.new.perform(ev.event_id)
$nats.flush(2)
`;
    const opened = ctx.waitForEvent('page', { timeout: 20_000 });
    execFileSync('docker', ['exec',
      '-e', `RB=${ruby}`,
      '-e', `POWERLINK_API_URL=${process.env.POWERLINK_API_URL || ''}`,
      'va-app', 'sh', '-c',
      'cd /opt/va-voipbox-api && bundle exec ruby -e "$RB"'],
      { stdio: 'pipe' });
    console.log('  incoming call routed -> notifications.' + uuid);

    const tab = await opened;
    await tab.waitForURL(/contact-4242/, { timeout: 15_000, waitUntil: 'commit' });
    console.log('  extension opened:', tab.url());
    expect(tab.url()).toContain(contactId);
  } finally {
    await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
