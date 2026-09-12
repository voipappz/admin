import { test, expect } from './auth-fixture';

test.describe('UX Power Features', () => {

  test('Command Palette opens and supports search and keyboard', async ({ authenticatedPage: page }) => {
    await page.goto('/live', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Open via trigger button (Ctrl+K may be intercepted in headless browsers)
    const trigger = page.locator('.ai-assistant-trigger-button');
    await trigger.click();

    // Command palette dialog should appear
    const dialog = page.locator('.command-palette-paper');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Should have search input
    const searchInput = dialog.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Should show Navigation section
    await expect(dialog).toContainText('Navigation');

    // Should show Actions section
    await expect(dialog).toContainText('Actions');

    // Type "user" to filter
    await searchInput.fill('user');
    await expect(dialog).toContainText('Users');

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('Recent Pages popover opens from clock icon', async ({ authenticatedPage: page }) => {
    // Visit a few pages to populate recent pages
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    await page.goto('/dids', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Click clock icon (AccessTimeIcon button in topbar-actions)
    const clockButton = page.locator('.topbar-actions button').first();
    await clockButton.click();

    // Popover should show "Recent Pages" header
    const popover = page.locator('.MuiPopover-paper');
    await expect(popover).toBeVisible({ timeout: 3000 });
    await expect(popover).toContainText('Recent Pages');

    // Should show recently visited pages
    await expect(popover).toContainText('DIDs');
    await expect(popover).toContainText('Users');
  });

  test('Sidebar renders with shared navConfig', async ({ authenticatedPage: page }) => {
    await page.goto('/live', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Sidebar should still have navigation items (use .first() — desktop + mobile drawer both exist)
    const sidebarNav = page.locator('.sidebar-nav-list').first();
    await expect(sidebarNav).toBeVisible({ timeout: 5000 });

    // Should have nav buttons
    const navButtons = page.locator('.sidebar-desktop .sidebar-nav-button');
    const count = await navButtons.count();
    expect(count).toBeGreaterThan(5);
  });

  test('No React render errors on authenticated pages', async ({ authenticatedPage: page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Only fail on uncaught JavaScript exceptions (React crashes, etc.)
    expect(errors).toEqual([]);
  });
});
