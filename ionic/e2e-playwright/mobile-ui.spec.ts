import { test, expect } from '@playwright/test';

/**
 * Mobile UI smoke tests for the redesigned login flow.
 * Run on a phone viewport, e.g.:
 *   npx playwright test e2e-playwright/mobile-ui.spec.ts --project=mobile-chrome
 *
 * These check the UI renders/behaves on a phone WITHOUT needing a real login
 * (no backend credentials required) — Playwright pierces Ionic's shadow DOM.
 */
test.describe('Login flow — mobile UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    // Let Ionic hydrate + i18n load (generous for a cold dev server).
    await page.waitForSelector('ion-card', { timeout: 45000 });
  });

  test('renders as a centered card with email, password and Sign In', async ({ page }) => {
    await expect(page.locator('ion-card').first()).toBeVisible();
    await expect(page.locator('ion-input[name="email"]')).toBeVisible();
    await expect(page.locator('ion-input[name="password"]')).toBeVisible();
    await expect(page.locator('ion-button[type="submit"]').first()).toBeVisible();
  });

  test('Sign In enables only after both fields are filled', async ({ page }) => {
    const submit = page.locator('ion-button[type="submit"]').first();
    // Disabled while empty.
    await expect(submit).toHaveAttribute('disabled', /.*/);

    await page.locator('ion-input[name="email"] input').fill('user@example.com');
    await page.locator('ion-input[name="password"] input').fill('secret123');
    await page.waitForTimeout(200);

    await expect(submit).not.toHaveAttribute('disabled', /.*/);
  });

  test('Forgot password opens the reset step in-page', async ({ page }) => {
    // The only clear button in the login card is "Forgot password".
    await page.locator('form ion-button[fill="clear"]').first().click();
    await page.waitForTimeout(400);
    // The reset step shows an email input and a Submit/Back action card.
    await expect(page.locator('ion-input[name="forgotEmail"]')).toBeVisible();
  });

  test('no horizontal overflow at phone width', async ({ page }) => {
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
