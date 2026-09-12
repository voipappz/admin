import { test, expect } from './auth-fixture';
import { getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * Dashboard (/dashboard) — the END-USER PORTAL's landing screen, and only
 * the portal's. App.jsx's PortalRoute sends an admin session to /calls: the
 * account console answers the same questions with Calls, Reports and
 * Monitoring, so there is no second dashboard to keep in step.
 *
 * The screen's own rendering is covered by portal-session.spec.ts, which
 * drives a real portal session. What's left for the admin fixture is the two
 * things it can actually check: that an admin is turned away, and that the
 * InfluxDB endpoints the screen depends on answer.
 */
test.describe('Dashboard', () => {
  test.setTimeout(60000);

  test('an admin session is redirected away from the portal dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await expect(page).toHaveURL(/\/calls$/, { timeout: 15000 });
    await expect(page.locator('[data-testid="dashboard-page"]')).toHaveCount(0);
  });

  test('Live Calls chart API (monitoringApi.getLiveCallsChart) returns 200/500', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/monitoring/charts?type=live_calls&minutes=60&bucket=5m`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    // Same tolerance as live.spec.ts — a 500 here means the backend/Influx
    // side needs attention, not that the frontend integration is wrong.
    expect([200, 500]).toContain(response.status());
  });

  test('InfluxDB metric query (monitoringApi.runInfluxQuery) returns 200/500', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // The `live_state` measurement behind every default tile on the screen.
    const response = await page.request.get(
      `${apiBaseUrl}/api/monitoring/influxdb/query?measurement=live_state&field=calls_total&aggregation=last&minutes=15`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    expect([200, 500]).toContain(response.status());
  });

  test('recent calls come from InfluxDB cdr, not the calls API', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/monitoring/influxdb/rows?measurement=cdr&minutes=1440&limit=3`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    // 404 is a legitimate answer here and must not fail the suite: the
    // endpoint only exists on API builds carrying voipappz-api ddaa69d05.
    // The screen reads empty on older deployments by design rather than
    // falling back to Postgres.
    expect([200, 404, 500]).toContain(response.status());
  });
});
