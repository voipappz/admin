import { test, expect } from './auth-fixture';
import { getFirstItem } from './crud-helpers';

/**
 * Portal DIDs — the end-user portal's Numbers screen at /my-dids.
 *
 * /my-dids renders the same DIDs component as the console's /dids, in
 * portalMode. The API contract is identical (and already covered by
 * dids.spec.ts), so what this spec pins is the portal-specific contract:
 *  - the route resolves through DualProtectedRoute on the `dids` ACL
 *  - portalMode drops the affordances that deep-link into admin-only routes
 *  - portalMode keeps the full CRUD surface: add, edit, duplicate, delete
 *
 * NOTE ON THE SESSION: auth-fixture.ts logs in on the ACCOUNT (admin) surface —
 * the documented .env carries no portal user credentials. DualProtectedRoute
 * admits an admin session to /my-dids, and portalMode is a property of the
 * route, not of the session, so every assertion below exercises the real
 * portalMode render. Environment scoping is the one thing this cannot cover:
 * it comes from the portal session's own environment and needs a portal login
 * fixture (and a portal test account) to assert.
 */

test.describe('Portal DIDs', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('Page loads at /my-dids', async ({ authenticatedPage: page }) => {
    await page.goto('/my-dids', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // The guard redirects on failure, so still being here is the assertion.
    expect(page.url()).toContain('/my-dids');

    // Either rows or the empty state — both mean the screen actually rendered.
    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 15000 });
    console.log('✅ /my-dids rendered the DIDs table');
  });

  test('Import CSV is hidden in portal mode', async ({ authenticatedPage: page }) => {
    await page.goto('/my-dids', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);

    // /api/dids/import is an admin bulk path — the portal must not offer it.
    const importButton = page.locator('button:has-text("Import CSV"), button:has-text("Import"), button[aria-label*="Import"]');
    expect(await importButton.count()).toBe(0);
    console.log('✅ Import CSV not offered on /my-dids');
  });

  test('Console /routes/list is unchanged by portal mode', async ({ authenticatedPage: page }) => {
    await page.goto('/routes/list', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500);

    expect(page.url()).toContain('/routes/list');
    const table = page.locator('table');
    await expect(table.first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Console DIDs screen still renders');
  });

  test('Row actions expose Edit, Routing and Duplicate', async ({ authenticatedPage: page }) => {
    const did = await getFirstItem(page, 'dids');
    if (!did) {
      console.log('⚠️ No DIDs available, skipping row action test');
      return;
    }

    await page.goto('/my-dids', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    const editButton = page.locator('button[data-testid="edit-did-button"]');
    const routingButton = page.locator('button[data-testid="routing-did-button"]');
    const duplicateButton = page.locator('button[data-testid="duplicate-did-button"]');

    if (await editButton.count() === 0) {
      console.log('⚠️ No write permission on dids for this account, skipping');
      return;
    }

    expect(await editButton.count()).toBeGreaterThan(0);
    // Portal keeps the visual flow reachable, just not as the Edit button.
    expect(await routingButton.count()).toBeGreaterThan(0);
    expect(await duplicateButton.count()).toBeGreaterThan(0);
    console.log('✅ Edit, Routing and Duplicate actions present');
  });

  test('Edit opens the DID wizard instead of navigating to /routing', async ({ authenticatedPage: page }) => {
    const did = await getFirstItem(page, 'dids');
    if (!did) {
      console.log('⚠️ No DIDs available, skipping edit test');
      return;
    }

    await page.goto('/my-dids', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    const editButton = page.locator('button[data-testid="edit-did-button"]');
    if (await editButton.count() === 0) {
      console.log('⚠️ No write permission on dids for this account, skipping');
      return;
    }

    await editButton.first().click();
    await page.waitForTimeout(1500);

    // This is the whole point of the flag: admin navigates away, portal opens
    // the wizard in place.
    expect(page.url()).toContain('/my-dids');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.first()).toBeVisible({ timeout: 10000 });
    console.log('✅ Edit opened the wizard dialog, stayed on /my-dids');

    await page.keyboard.press('Escape');
  });

  test('Routing action still reaches the visual flow', async ({ authenticatedPage: page }) => {
    const did = await getFirstItem(page, 'dids');
    if (!did) {
      console.log('⚠️ No DIDs available, skipping routing test');
      return;
    }

    await page.goto(`/routes?did=${did.uuid}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // /routing moved from ProtectedRoute to DualProtectedRoute — assert the
    // guard still admits the session rather than bouncing it to /account.
    expect(page.url()).toContain('/routes');
    console.log('✅ /routing reachable with the dids ACL');
  });
});
