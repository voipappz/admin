import { test, Page } from '@playwright/test';
import { stubAuth, stubApi, gotoApp } from './helpers/auth-stub';

// Visual capture of the mobile-only redesign (light header + phone frame).
// Run: npx playwright test e2e-playwright/header-redesign.visual.spec.ts --project=mobile-chrome --workers=1
test.describe.configure({ retries: 2, timeout: 120000 });

const now = Date.now();
const day = 86400000;

const fakeCalls = [
  { uuid: 'c1', created_at: new Date(now - 1 * day).toISOString(), profile: { direction: 'incoming', disposition: 'answer', callee: '+233541532477', duration: '110' } },
  { uuid: 'c2', created_at: new Date(now - 1 * day).toISOString(), profile: { direction: 'outgoing', disposition: 'answer', callee: '+233247119180', duration: '95' } },
  { uuid: 'c3', created_at: new Date(now - 2 * day).toISOString(), profile: { direction: 'incoming', disposition: 'no_answer', callee: '+233547147781', duration: '0' } },
  { uuid: 'c4', created_at: new Date(now - 3 * day).toISOString(), profile: { direction: 'outgoing', disposition: 'answer', callee: '0248881224', duration: '320' } },
];

const SHOTS = '/tmp/voipappz-shots';

// Navigate and wait for the app shell (tab bar + header) to actually render —
// fixed sleeps photograph the boot screen on a busy dev server.
async function gotoAndSettle(page: Page, path: string) {
  await gotoApp(page, path, 500);
  await page.waitForSelector('ion-tab-bar ion-tab-button', { state: 'visible', timeout: 90000 });
  await page.waitForSelector('app-header ion-toolbar', { state: 'visible', timeout: 90000 });
  await page.waitForTimeout(1500);
}

test('calls page — light header with inline search', async ({ page }) => {
  await stubAuth(page);
  await stubApi(page, '**/api/calls**', fakeCalls);
  await gotoAndSettle(page, '/app/calls');
  await page.screenshot({ path: `${SHOTS}/01-calls-mobile.png` });
});

test('phone panel slides in from the right', async ({ page }) => {
  await stubAuth(page);
  await stubApi(page, '**/api/calls**', fakeCalls);
  await gotoAndSettle(page, '/app/calls');
  await page.locator('.phone-btn').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/02-phone-panel-right.png` });
});

test('account menu (settings, PBX management)', async ({ page }) => {
  await stubAuth(page);
  await stubApi(page, '**/api/calls**', fakeCalls);
  await gotoAndSettle(page, '/app/calls');
  await page.locator('.user-avatar-btn').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/03-account-menu.png` });
});

test('hebrew RTL', async ({ page }) => {
  await stubAuth(page, { profile: { language: 'he' } });
  await page.addInitScript(() => { try { localStorage.setItem('language', 'he'); } catch {} });
  await stubApi(page, '**/api/calls**', fakeCalls);
  await gotoAndSettle(page, '/app/calls');
  await page.screenshot({ path: `${SHOTS}/05-calls-hebrew-rtl.png` });
});

const singleDid = [
  { uuid: 'did1', number: '+233308013883', name: 'EVANS -DID', bridge_type: 'queue', bridge_uuid: 'q1' },
];
const manyDids = [
  ...singleDid,
  { uuid: 'did2', number: '+233256023480', name: 'Support line', bridge_type: 'ivr', bridge_uuid: 'i1' },
  { uuid: 'did3', number: '+233200111222', name: 'Sales', bridge_type: '', bridge_uuid: '' },
];
const fakeQueue = { uuid: 'q1', name: 'EVANS -queue', enabled: true, strategy: 'ring_all', max_wait_time: 60, agents: [], announcements: {} };

test('actions — single number with queue routing', async ({ page }) => {
  await stubAuth(page);
  await stubApi(page, '**/api/dids**', singleDid);
  await stubApi(page, '**/api/queues**', [fakeQueue]);
  await stubApi(page, '**/api/queues/q1**', fakeQueue);
  await gotoAndSettle(page, '/app/actions');
  await page.screenshot({ path: `${SHOTS}/07-actions-single.png` });
});

test('actions — multiple numbers list', async ({ page }) => {
  await stubAuth(page);
  await stubApi(page, '**/api/dids**', manyDids);
  await stubApi(page, '**/api/queues**', [fakeQueue]);
  await stubApi(page, '**/api/queues/q1**', fakeQueue);
  await gotoAndSettle(page, '/app/actions');
  await page.screenshot({ path: `${SHOTS}/08-actions-list.png` });
});

test('desktop browser gets the centered phone frame', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubAuth(page);
  await stubApi(page, '**/api/calls**', fakeCalls);
  await gotoAndSettle(page, '/app/calls');
  await page.screenshot({ path: `${SHOTS}/06-desktop-phone-frame.png` });
});
