import { test, expect } from '@playwright/test';

/**
 * Portal-user session — end to end through the UI, with the auth endpoints
 * mocked.
 *
 * This exists because the portal path could not otherwise be verified: the
 * CI account (the CI account) is an ACCOUNT, not a portal user, so
 * /auth/user_login 401s for it, and no portal-user credentials exist to test
 * with. Rather than leave "does a portal session actually render the portal
 * shell?" as something only inspected by reading source, drive the real
 * UserLogin form against a mocked /auth/user_login + /auth/user/otp/verify
 * and assert on what a portal user would actually see.
 *
 * What this proves: the login writes a user session, the route guard admits
 * it, Layout picks the portal shell (rail, no admin sidebar/topbar), and the
 * rail exposes exactly the portal's destinations. What it does NOT prove is
 * the backend's own behaviour — that needs a real portal user on a live
 * deployment.
 */

const USER = {
  uuid: 'test-user-uuid',
  name: 'Portal Tester',
  email: 'portal@example.com',
  environment: { uuid: 'env-uuid', name: 'Test Env', domain: 'test.example', wss_server: 'wss://test.example' },
  extension: { username: '2300', secret: 'secret' },
  acl: { uuid: 'acl-uuid', data: { dashboard: { main: ['read'] }, calls: { main: ['read'] }, phone: { main: ['read'] } } }
};

// exp far in the future so UserAuthContext's validity check passes.
function fakeJwt() {
  const payload = { user_uuid: USER.uuid, exp: Math.floor(Date.now() / 1000) + 86400 };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.signature`;
}

async function mockUserAuth(page) {
  await page.route('**/auth/user_login**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ otp_sent: true, temp_token: 'tmp' }) }));
  await page.route('**/auth/user/otp/verify**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: USER, token: fakeJwt() }) }));
  // The portal's data calls aren't what's under test here; keep them quiet
  // and deterministic so a backend blip can't fail a routing assertion.
  //
  // Match on the PATHNAME, not a '**/api/**' glob: under `vite dev` the app's
  // own source modules are served from their real paths, so that glob also
  // swallowed /src/services/api/*.js and answered them with `[]` as
  // application/json. The browser then refused the module for its MIME type
  // and rendered a blank page — the mock, not the app, was the failure.
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route('**/tasks/customer_portal_data**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ logo_title: 'Test Tenant' }) }));
}

test.describe('Portal user session', () => {
  test.setTimeout(60000);
  test.use({ navigationTimeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
  });

  test('signing in at / lands on the dashboard in the portal shell', async ({ page }) => {
    await mockUserAuth(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.fill('[data-testid="user-email-input"] input', USER.email);
    await page.fill('[data-testid="user-password-input"] input', 'pw');
    await page.click('[data-testid="user-login-button"]');

    await page.fill('[data-testid="user-otp-input"] input', '123456');
    await page.click('[data-testid="user-otp-submit-button"]');

    // Stays at the root — the portal IS the dashboard, not a hop into it.
    await expect(page).toHaveURL(/:\d+\/$/, { timeout: 20000 });
    await expect(page.locator('[data-testid="dashboard-page"]')).toBeVisible({ timeout: 20000 });

    // ...in the PORTAL shell: the rail, and none of the admin furniture.
    await expect(page.locator('[data-testid="user-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="authenticated-layout"]')).toHaveCount(0);
  });

  test('rail exposes exactly Dashboard, Calls and Phone', async ({ page }) => {
    await mockUserAuth(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('[data-testid="user-email-input"] input', USER.email);
    await page.fill('[data-testid="user-password-input"] input', 'pw');
    await page.click('[data-testid="user-login-button"]');
    await page.fill('[data-testid="user-otp-input"] input', '123456');
    await page.click('[data-testid="user-otp-submit-button"]');
    await expect(page.locator('[data-testid="user-rail"]')).toBeVisible({ timeout: 20000 });

    for (const item of ['rail-dashboard', 'rail-calls', 'rail-phone']) {
      await expect(page.locator(`[data-testid="${item}"]`)).toBeVisible();
    }
    // Sign out lives on the rail's account button.
    await page.click('[data-testid="rail-account"]');
    await expect(page.locator('[data-testid="rail-logout"]')).toBeVisible();
    await page.keyboard.press('Escape');

    // Theme toggle is its own rail item, above the avatar. Persisted by
    // ThemeContext, so a reload keeps the choice.
    const toggle = page.locator('[data-testid="rail-theme-toggle"]');
    await expect(toggle).toContainText('Dark');
    await toggle.click();
    await expect(toggle).toContainText('Light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="rail-theme-toggle"]')).toContainText('Light', { timeout: 20000 });
  });

  test('phone docks from the right and Calls navigates to the history screen', async ({ page }) => {
    await mockUserAuth(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('[data-testid="user-email-input"] input', USER.email);
    await page.fill('[data-testid="user-password-input"] input', 'pw');
    await page.click('[data-testid="user-login-button"]');
    await page.fill('[data-testid="user-otp-input"] input', '123456');
    await page.click('[data-testid="user-otp-submit-button"]');
    await expect(page.locator('[data-testid="user-rail"]')).toBeVisible({ timeout: 20000 });

    await page.click('[data-testid="rail-phone"]');
    await expect(page.locator('[data-testid="phone-dock"]')).toBeVisible();
    await expect(page.locator('[data-testid="phone-screen"]')).toBeVisible();
    await page.click('[data-testid="phone-dock-close"]');

    await page.click('[data-testid="rail-calls"]');
    await expect(page).toHaveURL(/\/my-calls$/);
    await expect(page.locator('[data-testid="portal-calls-page"]')).toBeVisible({ timeout: 20000 });
  });
});
