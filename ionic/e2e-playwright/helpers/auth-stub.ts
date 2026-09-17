import { Page } from '@playwright/test';

/**
 * Authenticated mobile-test harness — renders the app's protected pages
 * (/app/**) on a phone viewport WITHOUT a real backend or credentials.
 *
 * How it works:
 *  - Seeds the auth token localStorage key the app checks on boot.
 *  - Stubs /auth/user_token_status to return a decodable user JWT so the
 *    boot guard treats us as logged in (instead of redirecting to /login).
 *  - Stubs /customer (branding) and installs a permissive /api/** catch-all
 *    that returns []. Tests register more specific /api/<x> routes AFTER
 *    calling stubAuth(), so their routes win (Playwright matches the most
 *    recently registered route first).
 */

// localStorage key SimpleAuthService.getToken() reads.
const TOKEN_KEY = 'authce9d77b308c149d5992a80073637e4d5';

function b64url(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

// Minimal JWT — the app's jwtHelper only base64-decodes the payload, no verify.
export function makeUserJwt(user: Record<string, any> = {}): string {
  const payload = {
    first_name: 'Test',
    last_name: 'User',
    email: 'test@demo.io',
    username: 'tester',
    user_uuid: 'user-uuid-1',
    profile: {},
    acl: { data: [] },
    ...user,
  };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;
}

const json = (body: any) => ({
  status: 200,
  contentType: 'application/json',
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

export async function stubAuth(page: Page, user?: Record<string, any>) {
  const jwt = makeUserJwt(user);

  await page.addInitScript((token) => {
    try {
      localStorage.setItem('authce9d77b308c149d5992a80073637e4d5', token as string);
      localStorage.setItem('language', 'en');
    } catch {}
  }, 'mobile-test-token');

  // Swallow ALL websocket connections so the app doesn't spend boot time
  // retrying the real ActionCable/Janus servers (502s) — that retry storm was
  // the main source of flaky, variable render timing under serial test load.
  try {
    await page.routeWebSocket(/.*/, () => { /* intercept, never connect upstream */ });
  } catch { /* older Playwright without routeWebSocket — ignore */ }

  // Generic first; specific routes added by the test override these.
  await page.route('**/api/**', (r) => r.fulfill(json('[]')));
  await page.route('**/auth/user_token_status**', (r) => r.fulfill(json({ user: jwt })));
  await page.route('**/customer**', (r) => r.fulfill(json({ name: 'demo', language: 'en', logo_url: '', logo_icon: '' })));
}

// Register a JSON stub for an API path glob. Call AFTER stubAuth so it wins.
export async function stubApi(page: Page, glob: string, body: any) {
  await page.route(glob, (r) => r.fulfill(json(body)));
}

// Register a failing (500) stub to exercise error states.
export async function stubApiError(page: Page, glob: string, status = 500) {
  await page.route(glob, (r) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ message: 'stubbed error' }) }));
}

// Navigate to an authed app route and give Ionic time to hydrate + load data.
export async function gotoApp(page: Page, path: string, settle = 2500) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(settle);
}
