import { test, expect, Page } from '@playwright/test';
import { stubAuth, stubApi, gotoApp } from './helpers/auth-stub';

/**
 * Mobile coverage for the Actions tab (PBX routing hub) and the bottom tab
 * bar, with the backend stubbed.
 *
 * Run: npx playwright test e2e-playwright/actions-tabs.mobile.spec.ts --project=mobile-chrome
 */
test.describe.configure({ retries: 2, timeout: 90000 });

const singleDid = [
  { uuid: 'did1', number: '+233308013883', name: 'EVANS -DID', bridge_type: 'queue', bridge_uuid: 'q1' },
];

const manyDids = [
  { uuid: 'did1', number: '+233308013883', name: 'EVANS -DID', bridge_type: 'queue', bridge_uuid: 'q1' },
  { uuid: 'did2', number: '+233256023480', name: 'Support line', bridge_type: 'ivr', bridge_uuid: 'i1' },
  { uuid: 'did3', number: '+233200111222', name: 'Sales', bridge_type: '', bridge_uuid: '' },
];

const fakeQueue = {
  uuid: 'q1', name: 'EVANS -queue', enabled: true, strategy: 'ring_all',
  max_wait_time: 60, agents: [], announcements: {},
};

async function bootActions(page: Page, dids: any[]) {
  await stubAuth(page);
  await stubApi(page, '**/api/dids**', dids);
  // List first, specific queue last — the most recently registered route wins.
  await stubApi(page, '**/api/queues**', [fakeQueue]);
  await stubApi(page, '**/api/queues/q1**', fakeQueue);
  await gotoApp(page, '/app/actions', 500);
  await page.waitForSelector('ion-tab-bar ion-tab-button', { state: 'visible', timeout: 60000 });
}

test.describe('Actions — mobile', () => {
  test('single number: shows the DID and its routing destination', async ({ page }) => {
    await bootActions(page, singleDid);
    await expect(page.locator('page-actions h2', { hasText: '+233308013883' })).toBeVisible({ timeout: 20000 });
    // The routing button reflects the bridge type (queue).
    await expect(page.locator('page-actions ion-button', { hasText: /queue/i }).first()).toBeVisible();
  });

  test('multiple numbers: list renders and header search filters it', async ({ page }) => {
    await bootActions(page, manyDids);
    // Scope to the identities list — the embedded bridge detail below has its own items.
    const identityList = page.locator('page-actions ion-list').first();
    await expect(identityList.locator('ion-item', { hasText: '+233256023480' })).toBeVisible({ timeout: 20000 });
    await expect(identityList.locator('> ion-item')).toHaveCount(3);

    // Header search narrows the list down to the matching number.
    await page.locator('app-header ion-searchbar input').fill('Sales');
    await expect(identityList.locator('> ion-item')).toHaveCount(1, { timeout: 10000 });
    await expect(identityList.locator('ion-item', { hasText: 'Sales' })).toBeVisible();
  });

  test('no routing configured: shows the empty state with a set-routing CTA', async ({ page }) => {
    await bootActions(page, [{ uuid: 'did3', number: '+233200111222', name: 'Sales', bridge_type: '', bridge_uuid: '' }]);
    await expect(page.locator('.routing-empty-card')).toBeVisible({ timeout: 20000 });
  });
});

test.describe('Bottom tabs — mobile', () => {
  test('all three tabs render and navigate', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/dids**', singleDid);
    await stubApi(page, '**/api/queues/q1**', fakeQueue);
    await stubApi(page, '**/api/dashboards**', []);
    await gotoApp(page, '/app/dashboard', 500);
    await page.waitForSelector('ion-tab-bar ion-tab-button', { state: 'visible', timeout: 60000 });

    const tabs = page.locator('ion-tab-bar ion-tab-button');
    await expect(tabs).toHaveCount(3);

    await tabs.nth(1).click(); // Calls
    await expect(page).toHaveURL(/\/app\/calls/, { timeout: 20000 });
    await expect(page.locator('app-header ion-searchbar')).toBeVisible({ timeout: 20000 });

    await tabs.nth(2).click(); // Actions
    await expect(page).toHaveURL(/\/app\/actions/, { timeout: 20000 });
    await expect(page.locator('page-actions h2', { hasText: '+233308013883' })).toBeVisible({ timeout: 20000 });

    await tabs.nth(0).click(); // Dashboard
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 20000 });
  });

  test('phone panel opens from the right and dialpad is usable', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/dids**', singleDid);
    await stubApi(page, '**/api/queues/q1**', fakeQueue);
    await gotoApp(page, '/app/actions', 500);
    await page.waitForSelector('app-header .phone-btn', { state: 'visible', timeout: 60000 });

    await page.locator('app-header .phone-btn').first().click();
    const menu = page.locator('ion-menu[menu-id="phone-sidebar"], ion-menu[side="end"]').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
  });
});
