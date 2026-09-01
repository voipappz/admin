import { test, expect } from '@playwright/test';

/**
 * Real login against a REAL mothership.
 *
 * The `smoke` spec next door builds with VITE_MOCK_LOGIN=1 and proves the
 * entry path with no backend at all: any email, OTP 123456. That is fast and
 * it is honest about what it covers — it cannot catch a change to the actual
 * /auth/login contract, a forwarder that stops forwarding, or a token the app
 * mints but the API rejects. Every one of those ships green today.
 *
 * This spec logs in with credentials the install itself produced (`make
 * onboard`), through the production image's own forwarder, against a
 * mothership installed by its public installer on the runner. Same recipe as
 * the mothership's own `health-check` job, which proves the chrome extension
 * the same way.
 *
 * Requires MOTHERSHIP_E2E_EMAIL / MOTHERSHIP_E2E_PASSWORD; skipped otherwise,
 * so a laptop run of `npx playwright test` is unaffected.
 */
const email = process.env.MOTHERSHIP_E2E_EMAIL;
const password = process.env.MOTHERSHIP_E2E_PASSWORD;
const otp = process.env.MOTHERSHIP_E2E_OTP;

test.skip(!email || !password, 'MOTHERSHIP_E2E_EMAIL/PASSWORD unset — no install to log into');

test('a real mothership login reaches the dashboard', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

  // A 5xx from the forwarder is the failure this spec exists to catch, and it
  // is invisible if we only assert on the URL.
  const serverErrors: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('/login');
  await page.getByTestId('email-input').locator('input').fill(email!);
  await page.getByTestId('password-input').locator('input').fill(password!);
  await page.getByTestId('login-button').click();

  // OTP is per-customer on a real install: challenge or straight through.
  // Waiting on either keeps the spec valid whichever way this tenant is set up.
  const otpInput = page.getByTestId('otp-input');
  await Promise.race([
    otpInput.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null),
    page.waitForURL('**/dashboard', { timeout: 15_000 }).catch(() => null),
  ]);

  if (await otpInput.count()) {
    test.skip(!otp, 'this tenant challenges for an OTP and MOTHERSHIP_E2E_OTP is unset');
    await otpInput.locator('input').fill(otp!);
    await page.getByTestId('otp-verify-button').click();
  }

  await page.waitForURL('**/dashboard', { timeout: 20_000 });
  await expect(page.getByTestId('login-form')).toHaveCount(0);
  await expect(page.getByTestId('navigation-rail')).toBeVisible();

  expect(serverErrors, 'the app server returned 5xx during a real login').toEqual([]);
  expect(pageErrors, 'uncaught page errors during a real login').toEqual([]);
});
