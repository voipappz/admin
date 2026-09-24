import { test, expect } from './auth-fixture';

/**
 * Live Charts End-to-End Tests
 *
 * Verifies the live_call (incoming/outgoing) and live_registration time-series
 * charts on the Live screen render correctly with the new API response shape:
 *   [{ name: 'incoming', series: [...] }, { name: 'outgoing', series: [...] }]
 *
 * Mocks /tasks/metrics/live_calls and /tasks/metrics/live_registrations so the
 * tests don't depend on a live FreeSWITCH or InfluxDB.
 */

const mockLiveCallsResponse = [
  {
    name: 'incoming',
    series: [
      { name: '2026-05-22T18:00:00+00:00', value: 3, extra: { code: 'incoming' } },
      { name: '2026-05-22T18:01:00+00:00', value: 5, extra: { code: 'incoming' } },
      { name: '2026-05-22T18:02:00+00:00', value: 2, extra: { code: 'incoming' } },
      { name: '2026-05-22T18:03:00+00:00', value: 7, extra: { code: 'incoming' } },
    ],
  },
  {
    name: 'outgoing',
    series: [
      { name: '2026-05-22T18:00:00+00:00', value: 1, extra: { code: 'outgoing' } },
      { name: '2026-05-22T18:01:00+00:00', value: 0, extra: { code: 'outgoing' } },
      { name: '2026-05-22T18:02:00+00:00', value: 4, extra: { code: 'outgoing' } },
      { name: '2026-05-22T18:03:00+00:00', value: 3, extra: { code: 'outgoing' } },
    ],
  },
];

const mockLiveRegistrationsResponse = [
  {
    name: 'registrations',
    series: [
      { name: '2026-05-22T18:00:00+00:00', value: 12, extra: { code: 'registrations' } },
      { name: '2026-05-22T18:01:00+00:00', value: 14, extra: { code: 'registrations' } },
      { name: '2026-05-22T18:02:00+00:00', value: 13, extra: { code: 'registrations' } },
    ],
  },
];

// Stale: these charts ("Live Calls Over Time", /tasks/metrics/*) belonged to
// the tabbed Live screen, which the ActionCable Live dashboard replaced.
test.describe.skip('Live Charts with mocked API', () => {
  test.setTimeout(60000);

  test('Live Calls chart renders incoming + outgoing series from mocked API', async ({ authenticatedPage: page }) => {
    const capturedCallsUrls: string[] = [];

    await page.route('**/tasks/metrics/live_calls*', async (route) => {
      capturedCallsUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockLiveCallsResponse),
      });
    });

    await page.goto('/live', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Live Calls is the default tab (activeTab=1 in Live.jsx), so the chart
    // renders immediately on page load.
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Chart strip title is set by Live.jsx → <LiveChartStrip title="Live Calls Over Time" ...>
    await expect(page.getByText('Live Calls Over Time')).toBeVisible({ timeout: 15000 });

    // Recharts renders an <svg class="recharts-surface">
    await expect(page.locator('.recharts-surface').first()).toBeVisible({ timeout: 15000 });

    // Chart should have NOT shown the "No data for selected time range" empty
    // state, since our mock returns 4 points
    await expect(page.getByText('No data for selected time range')).not.toBeVisible();

    // Verify the admin actually sent minutes and bucket query params
    expect(capturedCallsUrls.length).toBeGreaterThan(0);
    const firstUrl = capturedCallsUrls[0];
    expect(firstUrl).toContain('minutes=');
    expect(firstUrl).toContain('bucket=');

    console.log(`✅ live_calls captured URL: ${firstUrl}`);
  });

  test('Live Registrations chart renders from mocked API', async ({ authenticatedPage: page }) => {
    const capturedRegsUrls: string[] = [];

    await page.route('**/tasks/metrics/live_registrations*', async (route) => {
      capturedRegsUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockLiveRegistrationsResponse),
      });
    });

    await page.goto('/live', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Switch to SIP Registrations tab (index 2 — see Live.jsx <Tab> definitions)
    const regsTab = page.locator('button[role="tab"]:has-text("SIP Registrations")');
    await regsTab.click({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Chart strip title — set by Live.jsx → <LiveChartStrip title="SIP Registrations Over Time" ...>
    await expect(page.getByText('SIP Registrations Over Time')).toBeVisible({ timeout: 15000 });

    // Verify Recharts rendered
    await expect(page.locator('.recharts-surface').first()).toBeVisible({ timeout: 15000 });

    // Empty-state should not show
    await expect(page.getByText('No data for selected time range')).not.toBeVisible();

    // Verify bucket was sent
    expect(capturedRegsUrls.length).toBeGreaterThan(0);
    const firstUrl = capturedRegsUrls[0];
    expect(firstUrl).toContain('minutes=');
    expect(firstUrl).toContain('bucket=');

    console.log(`✅ live_registrations captured URL: ${firstUrl}`);
  });

  test('Live Calls chart re-requests with new bucket when time window changes', async ({ authenticatedPage: page }) => {
    const capturedCallsUrls: string[] = [];

    await page.route('**/tasks/metrics/live_calls*', async (route) => {
      capturedCallsUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockLiveCallsResponse),
      });
    });

    await page.goto('/live', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await expect(page.getByText('Live Calls Over Time')).toBeVisible({ timeout: 15000 });

    // Initial fetch with default time window (1h, bucket=1m per useLiveCharts.js)
    const initialCount = capturedCallsUrls.length;
    expect(initialCount).toBeGreaterThan(0);

    // Click the 24h time-window chip — useLiveCharts switches to bucket=1h
    const day24Chip = page.locator('text="24h"').first();
    await day24Chip.click({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Should have triggered a new request with bucket=1h
    const newUrl = capturedCallsUrls[capturedCallsUrls.length - 1];
    expect(capturedCallsUrls.length).toBeGreaterThan(initialCount);
    expect(newUrl).toContain('bucket=1h');
    expect(newUrl).toContain('minutes=1440');

    console.log(`✅ 24h window URL: ${newUrl}`);
  });
});
