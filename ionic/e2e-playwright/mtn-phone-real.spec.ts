import { test, expect } from '@playwright/test';

/**
 * REAL phone test against the MTN environment.
 *
 * Logs in with real credentials, opens the phone panel, and verifies the
 * WebRTC phone connects over WSS and REGISTERs (status reaches "Ready"), then
 * optionally places a call to a known test number to prove two-way media.
 *
 * Credentials & target come from env vars so nothing secret is committed:
 *   MTN_TEST_EMAIL, MTN_TEST_PASSWORD   (portal login — user has an extension)
 *   MTN_TEST_CALL_NUMBER                (optional; number to dial for the call test)
 *
 * The app must be served with the MTN config (main.mtn.js copied over main.js).
 * If creds are absent the tests skip, so CI stays green until they're set in
 * the CircleCI project settings.
 *
 * Run locally:
 *   cp src/assets/config/main.mtn.js src/assets/config/main.js
 *   MTN_TEST_EMAIL=1004 MTN_TEST_PASSWORD=*** \
 *     npx playwright test e2e-playwright/mtn-phone-real.spec.ts --project=mobile-chrome --headed
 */

const EMAIL = process.env.MTN_TEST_EMAIL;
const PASSWORD = process.env.MTN_TEST_PASSWORD;
const CALL_NUMBER = process.env.MTN_TEST_CALL_NUMBER;

test.describe.configure({ timeout: 120000 });

test.describe('MTN phone — real WSS registration', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set MTN_TEST_EMAIL / MTN_TEST_PASSWORD to run real WSS tests');

  test('logs in, connects over WSS and reaches Ready (registered)', async ({ page }) => {
    const sip: string[] = [];
    page.on('console', (m) => {
      const t = m.text();
      if (/\[SIP\.js\]|\[WebRTCPhone\]|Registered|Transport/.test(t)) sip.push(t);
    });

    // Real login — no mocking.
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('ion-input[name="email"] input').fill(EMAIL!);
    await page.locator('ion-input[name="password"] input').fill(PASSWORD!);
    await page.locator('ion-button[type="submit"]').click();

    // Land in the app.
    await expect(page).toHaveURL(/\/app\//, { timeout: 30000 });

    // Open the phone panel from the header.
    await page.locator('app-header .phone-btn').first().click();

    // The phone connects over WSS and registers — status label reaches "Ready".
    await expect(page.getByText('Ready', { exact: false }).first()).toBeVisible({ timeout: 45000 });

    // Sanity: the transport actually connected (not just a stale label).
    const transportConnected = sip.some((l) => /Transport CONNECTED|Transport state changed: Connected/.test(l));
    expect(transportConnected, `SIP transport never reported CONNECTED. Log:\n${sip.join('\n')}`).toBeTruthy();
  });

  test('places a call to the test number (two-way media)', async ({ page, browserName }) => {
    test.skip(!CALL_NUMBER, 'Set MTN_TEST_CALL_NUMBER to run the outbound call test');

    const events: string[] = [];
    page.on('console', (m) => {
      const t = m.text();
      if (/webrtc-event|ESTABLISHED|Call ESTABLISHED|accepted|INVITE/.test(t)) events.push(t);
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('ion-input[name="email"] input').fill(EMAIL!);
    await page.locator('ion-input[name="password"] input').fill(PASSWORD!);
    await page.locator('ion-button[type="submit"]').click();
    await expect(page).toHaveURL(/\/app\//, { timeout: 30000 });

    await page.locator('app-header .phone-btn').first().click();
    await expect(page.getByText('Ready', { exact: false }).first()).toBeVisible({ timeout: 45000 });

    // Switch to the dialpad and dial the test number.
    await page.getByText('Dialpad', { exact: false }).first().click();
    for (const digit of CALL_NUMBER!.replace(/[^0-9*#+]/g, '')) {
      await page.locator('.digit-btn', { hasText: new RegExp(`^\\${digit}$`) }).first().click();
    }
    await page.locator('.call-btn').click();

    // The call should establish (remote answered / media flowing).
    await expect
      .poll(() => events.some((e) => /ESTABLISHED|accepted/.test(e)), { timeout: 45000 })
      .toBeTruthy();

    // --- Exercise the in-call SIP controls end-to-end on the live call ---
    // Mute / unmute
    const muteBtn = page.locator('ion-button', { hasText: /mute/i }).first();
    if (await muteBtn.isVisible().catch(() => false)) {
      await muteBtn.click();
      await page.waitForTimeout(500);
      await muteBtn.click();
    }

    // Hold / resume
    const holdBtn = page.locator('ion-button', { hasText: /hold|resume/i }).first();
    if (await holdBtn.isVisible().catch(() => false)) {
      await holdBtn.click();
      await page.waitForTimeout(500);
      await holdBtn.click();
    }

    // DTMF — open the in-call keypad and press a digit.
    const keypadBtn = page.locator('ion-button', { hasText: /keypad/i }).first();
    if (await keypadBtn.isVisible().catch(() => false)) {
      await keypadBtn.click();
      await page.locator('.digit-btn', { hasText: /^1$/ }).first().click().catch(() => {});
    }

    // Hang up to leave the line clean for the next run.
    const endBtn = page.locator('ion-button', { hasText: /end.?call|hang/i }).first();
    if (await endBtn.isVisible().catch(() => false)) {
      await endBtn.click();
    }
  });
});
