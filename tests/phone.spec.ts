import { test, expect } from './auth-fixture';

/**
 * Phone (/phone) — the ADMIN session's view of the shared screen.
 *
 * /phone is ACL-gated for an admin (App.jsx's DualProtectedRoute → canAccess
 * ('phone')); only a portal-user session gets the unconditional pass. An
 * account's ACL is a stored document, so whether the CI account can reach the
 * screen depends on the deployment: Acl::ACL_DATA_ACCOUNT grants "phone", but
 * documents created before that was added do not, and the template is never
 * re-applied to existing rows.
 *
 * So assert against what the signed-in account is actually allowed to do —
 * screen renders when granted, redirect to /account when not — rather than
 * assuming one of the two and failing on a legitimate ACL denial. The portal
 * side of the same screen is covered end to end in portal-session.spec.ts.
 *
 * No SIP server is registered against here, so this only checks the screen
 * renders in its disconnected state — never an actual call.
 */

/** Does the signed-in account's stored ACL grant read on `phone`? */
async function grantsPhone(page): Promise<boolean> {
  return page.evaluate(() => {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    const data = auth?.acl?.data || auth?.acl || {};
    const entry = data.phone;
    if (!entry) return false;
    const perms = Array.isArray(entry) ? entry : Object.values(entry).flatMap((v) =>
      Array.isArray(v) ? v : String(v).split(','));
    return perms.some((p) => ['read', 'index', 'list'].includes(String(p).trim()));
  });
}

test.describe('Phone', () => {
  test.setTimeout(60000);

  test('the ACL decides: screen renders when granted, /account when not', async ({ authenticatedPage: page }) => {
    const allowed = await grantsPhone(page);
    await page.goto('/phone', { waitUntil: 'domcontentloaded', timeout: 15000 });

    if (allowed) {
      await expect(page.locator('[data-testid="phone-screen"]')).toBeVisible({ timeout: 15000 });
    } else {
      // The guard must bounce to /account — a screen carrying no requiredAcl,
      // so a denial can't loop.
      await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
      await expect(page.locator('[data-testid="phone-screen"]')).toHaveCount(0);
    }
  });

  test('should show Calls/Dialpad/Settings tabs and no active call by default', async ({ authenticatedPage: page }) => {
    test.skip(!(await grantsPhone(page)), 'this account\'s ACL does not grant phone');
    await page.goto('/phone', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await expect(page.locator('[data-testid="phone-screen"]')).toBeVisible({ timeout: 15000 });

    for (const label of ['Calls', 'Dialpad', 'Settings']) {
      await expect(page.getByRole('tab', { name: label })).toBeVisible();
    }

    // No SIP server configured/registered in CI — the in-call view (hold/
    // transfer/hangup controls) must not be showing.
    await expect(page.locator('[data-testid="phone-hold"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="phone-transfer-open"]')).not.toBeVisible();
  });

  test('Calls tab lists recent calls (or an empty state), never errors', async ({ authenticatedPage: page }) => {
    test.skip(!(await grantsPhone(page)), 'this account\'s ACL does not grant phone');
    await page.goto('/phone', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await expect(page.locator('[data-testid="phone-screen"]')).toBeVisible({ timeout: 15000 });

    await page.getByRole('tab', { name: 'Calls' }).click();
    // Either the list renders or the empty/error copy does — both are fine;
    // what matters is the tab resolves rather than hanging on the spinner.
    await expect(
      page.locator('[data-testid="phone-calls-list"], text=No recent calls.')
        .first()
    ).toBeVisible({ timeout: 20000 });
  });
});
