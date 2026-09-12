import { test, expect } from './auth-fixture';

/**
 * Responsive smoke tests — guard the layout across viewports.
 *
 * For each viewport x screen: load the page, assert no horizontal overflow,
 * and assert the navigation affordances for that breakpoint are present:
 *  - desktop (>=900px): sidebar rail, topbar global search input, customer
 *    breadcrumb, sidebar account avatar
 *  - mobile  (<900px):  hamburger (opens the nav drawer with the account
 *    avatar), topbar search icon (breadcrumb hidden)
 */

const VIEWPORTS = [
  { name: 'phone', width: 375, height: 667, mobile: true },
  { name: 'tablet', width: 768, height: 1024, mobile: true },
  { name: 'laptop', width: 1280, height: 720, mobile: false },
  { name: 'desktop', width: 1920, height: 1080, mobile: false },
];

const SCREENS = ['/live', '/calls', '/users'];

async function expectNoHorizontalOverflow(page: any, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  console.log(`${label}: scrollWidth=${scrollWidth} clientWidth=${clientWidth}`);
  // +1 tolerates sub-pixel rounding
  expect(scrollWidth, `${label} has horizontal overflow`).toBeLessThanOrEqual(clientWidth + 1);
}

test.describe('Responsive layout smoke', () => {
  test.setTimeout(process.env.CI ? 180000 : 120000);

  for (const vp of VIEWPORTS) {
    test(`${vp.name} (${vp.width}x${vp.height}) — screens render without overflow`, async ({ authenticatedPage: page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const screen of SCREENS) {
        await page.goto(screen, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1500); // let async content settle
        await expectNoHorizontalOverflow(page, `${vp.name} ${screen}`);
        await expect(page.locator('.topbar-container'), `${vp.name} ${screen}: topbar missing`).toBeVisible();
      }
    });
  }

  test('desktop (1280) — search input, breadcrumb, sidebar + account present', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/live', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1000);

    // Inline global search input (Algolia-style) is visible and focusable
    const search = page.locator('.topbar-global-search input');
    await expect(search).toBeVisible();
    await search.focus();

    // Customer/env breadcrumb visible on desktop
    await expect(page.locator('.topbar-breadcrumb')).toBeVisible();

    // Sidebar rail with the account avatar at the bottom (scroll if short)
    await expect(page.locator('.sidebar-container')).toBeVisible();
    const avatar = page.locator('.sidebar-profile-avatar');
    await expect(avatar).toHaveCount(1);
    await avatar.scrollIntoViewIfNeeded();
    await expect(avatar).toBeVisible();
  });

  test('phone (375) — hamburger opens drawer with account; search icon works', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/live', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1000);

    // Breadcrumb and inline search input are hidden on phones
    await expect(page.locator('.topbar-breadcrumb')).toBeHidden();
    await expect(page.locator('.topbar-global-search')).toHaveCount(0);

    // Hamburger opens the nav drawer; the drawer carries the sidebar with the
    // bottom tools + account avatar
    await page.locator('.topbar-hamburger').first().click();
    const drawerAvatar = page.locator('.MuiDrawer-root .sidebar-profile-avatar');
    await expect(drawerAvatar).toBeVisible({ timeout: 5000 });
    await drawerAvatar.scrollIntoViewIfNeeded();
    await page.keyboard.press('Escape'); // close drawer

    // Search icon opens the full-screen palette dialog
    await page.locator('.topbar-container button:has(svg[data-testid="SearchIcon"])').first().click();
    await expect(page.locator('.command-palette-paper input')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });
});
