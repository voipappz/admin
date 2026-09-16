import { test, expect } from './helpers/extension';

/**
 * THE WHOLE CHAIN, driven from the extension.
 *
 *   Chrome extension  ──POST /auth/user_login──>  Elixir portal  :4001
 *                                                      │
 *                                                      ▼
 *                                          it performs the login itself
 *
 * The portal owns `/auth/user_login` now. It checks the credential against the
 * agents in `screen_pop.yaml` and mints a token with the same secret it
 * verifies against, so a session depends on this app and on nothing else being
 * reachable — which is exactly the failure this file used to be unable to
 * distinguish from a wrong password.
 *
 * WHY THE HEALTH GUARD IS STILL HERE. A login that works proves nothing about
 * the events that follow it, and those come off the broker. `/health`'s `nats`
 * check is green only once the producer is actually subscribed, so it is
 * asserted first and the run fails loudly rather than leaving a green login
 * beside a silent socket.
 */

const PORTAL = process.env.TEST_DOMAIN ?? 'http://localhost:4001';
const USERNAME = process.env.TEST_USERNAME ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

const NEED_CREDS =
  'set TEST_USERNAME and TEST_PASSWORD — an agent named in the `agents:` block ' +
  'of connectix/priv/pocketflow/screen_pop.yaml, with a password beside it';

// The endpoint is configuration now (`CONFIG.API_ENDPOINT`), and `_domain` is
// its runtime override — the same seam the other specs use to aim the
// extension somewhere other than the built-in default.
const useDomain = (page, domain: string) =>
  page.evaluate((d) => localStorage.setItem('_domain', d), domain);

const usernameInput = (page) => page.locator('input[formcontrolname="username"]');
const passwordInput = (page) => page.locator('input[formcontrolname="password"]');
const loginButton = (page) => page.getByRole('button', { name: /login/i });

async function submit(page, username: string, password: string) {
  await useDomain(page, PORTAL);
  await usernameInput(page).fill(username);
  await passwordInput(page).fill(password);
  await loginButton(page).click();
}

test.describe('extension → portal', () => {
  test('the portal is subscribed to the broker, so events can follow a login', async ({
    request,
  }) => {
    // Asserted before anything else in this file is believed.
    const res = await request.get(`${PORTAL}/health`);
    expect(res.status(), await res.text()).toBe(200);

    const health = await res.json();
    expect(
      health.checks?.nats?.status,
      'the portal is not subscribed to the broker, so a login here would be ' +
        'followed by a socket that never delivers anything. Check NATS_URL and ' +
        'the `nats.subjects` block in screen_pop.yaml.',
    ).toBe('ok');
  });

  /**
   * NO CREDENTIAL REQUIRED, and that is the point: a refusal travels the same
   * path a success does. The portal composes the 401 and the popup renders it,
   * so this proves the chain is connected on a machine with no valid login to
   * hand.
   */
  test('a refusal comes back from the API through the whole chain', async ({ popupPage }) => {
    await submit(popupPage, 'nobody@invalid.test', 'definitely-wrong');

    // The API's own answer, surfaced by the popup. A broken relay gives a 502
    // and a dead portal gives a network error; neither reaches this.
    await expect(popupPage.locator('.mat-snack-bar-container')).toBeVisible({ timeout: 15_000 });
    await expect(popupPage).toHaveURL(/login/);
  });

  test('the portal answers user_login itself, on its own origin', async ({ request }) => {
    // Straight at the portal, no browser: it must ANSWER /auth/user_login
    // rather than forward or redirect it. A 3xx or a 404 here means the route
    // left this app, which presents in the popup as a bare snackbar with no
    // message.
    const res = await request.post(`${PORTAL}/auth/user_login`, {
      form: { email: 'nobody@invalid.test', password: 'definitely-wrong' },
      maxRedirects: 0,
    });

    expect(res.status(), await res.text()).toBe(401);
    expect(await res.text()).toContain('Invalid email or password');
  });

  test('a real user logs in and the extension holds the session', async ({ popupPage }) => {
    test.skip(!USERNAME || !PASSWORD, NEED_CREDS);

    await submit(popupPage, USERNAME, PASSWORD);
    await expect(popupPage).toHaveURL(/main/, { timeout: 20_000 });

    // "Connected" is three keys. The background worker is handed `_id` over the
    // port and reconnects from `_domain` on every later login, so a missing one
    // is a session that looks fine until the first notification never arrives.
    const session = await popupPage.evaluate(() => ({
      token: localStorage.getItem('_token'),
      id: localStorage.getItem('_id'),
      domain: localStorage.getItem('_domain'),
    }));

    expect(session.token).toBeTruthy();
    expect(session.id).toBeTruthy();
    expect(session.domain).toBe(PORTAL);
  });

  test('the realtime socket targets the portal it logged in against', async ({
    context,
    popupPage,
  }) => {
    test.skip(!USERNAME || !PASSWORD, NEED_CREDS);

    await submit(popupPage, USERNAME, PASSWORD);
    await expect(popupPage).toHaveURL(/main/, { timeout: 20_000 });

    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });

    const realtimeUrl: string | null = await sw.evaluate(
      () =>
        new Promise((resolve) => {
          const read = () => (self as any)._realtime_url as string | undefined;
          if (read()) return resolve(read()!);
          const id = setInterval(() => {
            const v = read();
            if (v) {
              clearInterval(id);
              resolve(v);
            }
          }, 200);
          setTimeout(() => {
            clearInterval(id);
            resolve(null);
          }, 10_000);
        }),
    );

    expect(realtimeUrl, 'the worker never reached the realtime connect step').not.toBeNull();

    // The scheme FOLLOWS the portal's: http -> ws, https -> wss. Forcing wss at
    // a plaintext portal is a TLS handshake against a port that speaks none,
    // which surfaces as a socket that simply never opens.
    const expected = PORTAL.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
    expect(realtimeUrl).toBe(`${expected}/ws/events`);
  });
});
