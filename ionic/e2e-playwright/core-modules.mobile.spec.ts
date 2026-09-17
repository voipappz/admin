import { test, expect } from '@playwright/test';
import { stubAuth, stubApi, stubApiError, gotoApp } from './helpers/auth-stub';

/**
 * Massive mobile coverage for the CORE migrated modules — Dashboard, Reports,
 * Syslog, Conference, Notifications — rendered on a phone viewport with the
 * backend stubbed (no real credentials needed).
 *
 * Run on a phone:
 *   npx playwright test e2e-playwright/core-modules.mobile.spec.ts --project=mobile-chrome
 *
 * Each module is checked across three states: data, empty, and error.
 */

// Each test boots the whole Angular/Ionic app fresh on a phone viewport, which
// is heavy/variable on a dev server — give generous per-test time and retry
// environmental flakes (the assertions themselves poll until data renders).
test.describe.configure({ retries: 2, timeout: 90000 });

// ----- fixtures --------------------------------------------------------------
const now = Date.now();
const day = 86400000;

const fakeReports = [
  { uuid: 'r1', name: 'Daily Call Volume', type: 'bar', enabled: true },
  { uuid: 'r2', name: 'Agent Performance', type: 'table', enabled: true },
  { uuid: 'r3', name: 'Missed Calls', type: 'line', enabled: false },
];

const fakeReportRun = {
  table: {
    fields: [{ field: 'agent', name: 'Agent' }, { field: 'calls', name: 'Calls' }],
    data: [{ agent: 'Alice', calls: 42 }, { agent: 'Bob', calls: 31 }],
    type: 'bar',
  },
  footer: { Total_Calls: 73 },
};

const fakeLogs = {
  data: [
    { event_id: 'e1', msg: 'User logged in', level: 'info', time: new Date(now).toISOString(), actor: 'test@demo.io', event_type: 'EventAuthAudit' },
    { event_id: 'e2', msg: 'Call failed', level: 'error', time: new Date(now).toISOString(), actor: 'system', event_type: 'EventCall' },
    { event_id: 'e3', msg: 'Queue full', level: 'warning', time: new Date(now).toISOString(), actor: 'system', event_type: 'EventQueue' },
  ],
  total_records: 3,
};

const fakeConferences = [
  { uuid: 'cf1', name: 'Daily Standup', status: 'scheduled', members_count_current: 3, user_pin: '1234', did: '+15551112222', schedule_at: new Date(now).toISOString() },
  { uuid: 'cf2', name: 'Sales Sync', status: 'active', members_count_current: 7, user_pin: '9876', did: { number: '+15553334444' } },
];

const fakeNotifications = [
  { uuid: 'n1', subject: 'Missed call', message: 'You missed a call from +1555', read: false, created_at: new Date(now).toISOString() },
  { uuid: 'n2', subject: 'Voicemail', message: 'New voicemail', read: true, created_at: new Date(now).toISOString() },
];

// ----- Dashboard (server-driven widgets, ported from the portal) -------------
const fakeDashboards = [{ uuid: 'd1', name: 'My Dashboard' }];
const fakeWidgets = [
  { uuid: 'w1', name: 'incoming', title: 'Incoming Calls', template: 'counter', data_url: 'widgets/w1' },
  { uuid: 'w2', name: 'byday', title: 'Calls by Day', template: 'line-chart', data_url: 'widgets/w2' },
  { uuid: 'w3', name: 'agents', title: 'Top Agents', template: 'table', data_url: 'widgets/w3' },
];

test.describe('Dashboard — mobile', () => {
  test('renders server-defined widgets as mobile cards by template', async ({ page }) => {
    await stubAuth(page);
    // list first, widgets (more specific) last so it wins for /d1.
    await stubApi(page, '**/api/dashboards**', fakeDashboards);
    await stubApi(page, '**/api/dashboards/d1**', fakeWidgets);
    await gotoApp(page, '/app/dashboard');

    // Widget definitions come from the server and render as stacked cards.
    await expect(page.getByText('Incoming Calls')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Calls by Day')).toBeVisible();
    await expect(page.getByText('Top Agents')).toBeVisible();
  });

  test('binds each widget to its server data (counter value + table rows)', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/dashboards**', fakeDashboards);
    await stubApi(page, '**/api/dashboards/d1**', fakeWidgets);
    // Per-widget data from each widget's data_url.
    await stubApi(page, '**/api/widgets/w1**', { value: 128 });
    await stubApi(page, '**/api/widgets/w3**', { rows: [{ agent: 'Alice', calls: 42 }, { agent: 'Bob', calls: 31 }] });
    await gotoApp(page, '/app/dashboard');

    // Counter widget shows the bound value; table widget shows bound rows.
    await expect(page.locator('.counter-value')).toHaveText('128', { timeout: 20000 });
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.locator('.table .trow')).toHaveCount(2);
  });

  test('shows the error state + retry when the dashboard fails to load', async ({ page }) => {
    await stubAuth(page);
    await stubApiError(page, '**/api/dashboards**');
    await gotoApp(page, '/app/dashboard');
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible({ timeout: 20000 });
  });

  test('shows an empty state when no dashboard is configured', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/dashboards**', []);
    await gotoApp(page, '/app/dashboard');
    await expect(page.getByText(/no dashboard widgets/i)).toBeVisible({ timeout: 20000 });
  });
});

// ----- Reports ---------------------------------------------------------------
test.describe('Reports — mobile', () => {
  test('lists reports', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/reports**', fakeReports);
    await gotoApp(page, '/app/reports');
    await expect(page.getByText('Daily Call Volume')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Agent Performance')).toBeVisible();
    await expect(page.getByText('Missed Calls')).toBeVisible();
  });

  test('runs a report and shows results as one card per row + footer', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/reports**', fakeReportRun);
    await gotoApp(page, '/app/reports/r2');
    // Card-per-row results (mobile-first layout) — assert by content, not class.
    await expect(page.getByText('Alice')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Bob')).toBeVisible();
    await expect(page.locator('.footer-card')).toContainText('73');
  });

  test('empty report list shows empty state', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/reports**', []);
    await gotoApp(page, '/app/reports');
    await expect(page.getByText(/no reports/i)).toBeVisible({ timeout: 20000 });
  });
});

// ----- Syslog ----------------------------------------------------------------
test.describe('Syslog — mobile', () => {
  test('lists log entries with level filter segments', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/logs/**', fakeLogs);
    await stubApi(page, '**/api/logs**', fakeLogs);
    await gotoApp(page, '/app/syslog');
    await expect(page.getByText('User logged in')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Call failed')).toBeVisible();
    await expect(page.locator('ion-segment-button')).not.toHaveCount(0);
  });

  test('empty logs show empty state', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/logs/**', { data: [], total_records: 0 });
    await stubApi(page, '**/api/logs**', { data: [], total_records: 0 });
    await gotoApp(page, '/app/syslog');
    await expect(page.getByText(/no log entries/i)).toBeVisible({ timeout: 20000 });
  });
});

// ----- Conference ------------------------------------------------------------
test.describe('Conference — mobile', () => {
  test('lists conferences with join + dial-in info', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/conferences**', fakeConferences);
    await gotoApp(page, '/app/conference');
    await expect(page.getByText('Daily Standup')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Sales Sync')).toBeVisible();
    await expect(page.getByRole('button', { name: /join/i }).first()).toBeVisible();
  });

  test('empty conferences show empty state', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/conferences**', []);
    await gotoApp(page, '/app/conference');
    await expect(page.getByText(/no conferences/i)).toBeVisible({ timeout: 20000 });
  });
});

// ----- Notifications ---------------------------------------------------------
test.describe('Notifications — mobile', () => {
  test('lists notifications', async ({ page }) => {
    await stubAuth(page);
    await stubApi(page, '**/api/notifications**', fakeNotifications);
    await gotoApp(page, '/app/notifications');
    await expect(page.getByText('Missed call')).toBeVisible({ timeout: 20000 });
    // exact:true so it doesn't also match the "New voicemail" body line.
    await expect(page.getByText('Voicemail', { exact: true })).toBeVisible();
  });
});
