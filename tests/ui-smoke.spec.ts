import { test, expect } from './auth-fixture';

/**
 * UI smoke tests — every recently shipped UI feature gets at least one
 * EXECUTED browser test. New/undeployed backend endpoints are route-mocked,
 * so these run green regardless of what's deployed; everything else loads
 * from the real API via the auth fixture.
 *
 * Covers: Settings → Redis Viewer, sidebar live nav badges, Calls Live
 * drawer + Stats modal (group-by + histogram), Reports visual dashboards.
 */

const REDIS_INFO = { version: '7.4.7', used_memory: '14.7M', connected_clients: '12', total_keys: 4321, uptime_seconds: '1000' };
const REDIS_KEYS = { keys: ['identity:queue:abc', 'user:123:profile', 'sidekiq:stat'], total: 3 };
const REDIS_VALUE = { key: 'identity:queue:abc', type: 'hash', ttl: -1, value: { call_count: '42', answer_count: '30' } };

test.describe('UI smoke', () => {
  test.setTimeout(process.env.CI ? 120000 : 60000);

  test('Settings → Redis Viewer lists keys and shows a value', async ({ authenticatedPage: page }) => {
    await page.route(/\/api\/dashboard\/redis\/info/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REDIS_INFO) }));
    await page.route(/\/api\/dashboard\/redis\/keys/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REDIS_KEYS) }));
    await page.route(/\/api\/dashboard\/redis\/get\//, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REDIS_VALUE) }));

    await page.goto('/settings', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Settings defaults to the Feature Flags tab — activate the Redis Viewer
    // section first (its label is a nav item), THEN its info/keys render.
    await page.getByText('Redis Viewer').first().click();
    await expect(page.getByText(/7\.4\.7/).first()).toBeVisible({ timeout: 25000 });
    await expect(page.getByText('identity:queue:abc').first()).toBeVisible({ timeout: 15000 });

    await page.getByText('identity:queue:abc').click();
    await expect(page.getByText('call_count', { exact: false })).toBeVisible({ timeout: 15000 });
    console.log('✅ Redis Viewer: info + scan + key detail');
  });

  test('sidebar shows live nav badges (calls + critical events)', async ({ authenticatedPage: page }) => {
    await page.route(/\/api\/calls\?.*action=live/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'X-Total': '3' }, body: JSON.stringify([{ uuid: 'a' }, { uuid: 'b' }, { uuid: 'c' }]) }));
    await page.route(/\/api\/events\/stats/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_events: 10, failed_logins: 0, critical_events: 2, unique_actors: 1, top_event_types: [] }) }));

    await page.goto('/reports', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // The Calls badge must show the mocked live count. (The Events nav item is
    // ACL-gated and hidden for the ci account, so its badge can't be asserted.)
    const sidebar = page.locator('.sidebar-container');
    await expect(sidebar.getByText('3', { exact: true }).first()).toBeVisible({ timeout: 25000 });
    console.log('✅ Nav badges: live calls count visible');
  });

  test('Calls: own timeline chart with group-by; Live chip opens the side panel', async ({ authenticatedPage: page }) => {
    await page.route(/\/api\/calls\?.*action=live/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'X-Total': '1' }, body: JSON.stringify([{ uuid: 'c1', direction: 'incoming', callstate: 'ACTIVE' }]) }));
    await page.route(/\/calls\/aggregate/, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ time: '2026-07-16T10:00:00', answer: 4, no_answer: 1 }]) }));
    // The counter row (Stats/Live chips) only renders when the LIST has rows —
    // mock the plain list query (page=..., no action=) so it always does.
    await page.route(/\/api\/calls\?(?!.*action=).*page=/, (r) =>
      r.fulfill({
        status: 200, contentType: 'application/json', headers: { 'X-Total': '2' },
        body: JSON.stringify([
          { uuid: 'r1', created_at: '2026-07-16T09:00:00Z', profile: { caller: '100', callee: '200', cause: 'answer', direction: 'incoming' }, meta: { _direction: 'incoming' } },
          { uuid: 'r2', created_at: '2026-07-16T09:05:00Z', profile: { caller: '101', callee: '201', cause: 'no_answer', direction: 'outgoing' }, meta: { _direction: 'outgoing' } },
        ]),
      }));

    await page.goto('/calls', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // The chart is the screen's own "calls over time" (a static label now, not
    // a view dropdown — decoupled from reports). Its group-by is a select.
    await expect(page.getByText('Calls over time').first()).toBeVisible({ timeout: 25000 });
    const groupBySelect = page.locator('.MuiSelect-select', { hasText: 'Cause' }).first();
    await expect(groupBySelect).toBeVisible();
    await groupBySelect.click();
    await page.getByRole('option', { name: 'Direction' }).click();

    // Live replaces the chart in place; the "Open list" chip then opens the drawer.
    await page.locator('.MuiChip-root', { hasText: /Live/ }).first().click();
    await page.locator('.MuiChip-root', { hasText: 'Open list' }).first().click();
    const drawer = page.locator('.MuiDrawer-root');
    await expect(drawer.getByText('Live Calls').first()).toBeVisible({ timeout: 20000 });
    console.log('✅ Calls: own timeline chart + group-by + Live replaces chart + drawer');
  });

  test('Reports lands on visual dashboards with category chips', async ({ authenticatedPage: page }) => {
    await page.route('**/api/reports/dashboards', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dashboards: [
        { category: 'calls', count: 2, reports: [{ name: 'A', type: 'table' }, { name: 'B', type: 'table' }] },
        { category: 'billing', count: 1, reports: [{ name: 'Subscription', type: 'table' }] },
      ] }) }));
    await page.route('**/api/reports/dashboards/calls**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ category: 'calls', reports: [
        { name: 'CallPerEnvironment', type: 'table', chart: 'table', columns: ['name', 'calls'], rows: [{ name: 'env-1', calls: 12 }] },
      ] }) }));

    await page.goto('/reports', { waitUntil: 'domcontentloaded', timeout: 30000 });

    await expect(page.getByText('calls (2)')).toBeVisible({ timeout: 25000 });
    await expect(page.getByText('billing (1)')).toBeVisible();
    await expect(page.getByText('CallPerEnvironment').first()).toBeVisible({ timeout: 20000 }); // appears in the counter strip AND as the card title
    await expect(page.getByText('env-1')).toBeVisible();
    console.log('✅ Reports visual: category chips + report card render');
  });
});
