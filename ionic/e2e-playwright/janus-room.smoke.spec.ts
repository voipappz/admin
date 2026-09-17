import { test, expect } from '@playwright/test';
import { stubAuth, stubApi, gotoApp } from './helpers/auth-stub';

/**
 * Smoke test for the Janus video/audio room integration.
 * Verifies the room route loads inside the app shell and mounts the
 * <janus-videoroom> component (i.e. the Janus module is wired into the mobile
 * UX and compiles/loads). It does NOT assert live media — that needs a real
 * Janus room + camera.
 */
test.describe.configure({ retries: 1, timeout: 60000 });

test('video room route mounts the janus-videoroom component', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await stubAuth(page);
  // Room status endpoint the page calls on enter.
  await stubApi(page, '**/api/**', { type: 'video', room: 1234, pin: '' });

  await gotoApp(page, '/app/room/1234/video/testtoken', 3000);

  // The Janus video container should be present in the DOM.
  await expect(page.locator('janus-videoroom')).toBeAttached({ timeout: 15000 });

  // No uncaught page errors while mounting the Janus integration.
  const fatal = errors.filter((e) => /janus|videoroom/i.test(e));
  expect(fatal, `Janus mount errors:\n${fatal.join('\n')}`).toHaveLength(0);
});
