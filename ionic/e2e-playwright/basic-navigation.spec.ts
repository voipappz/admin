import { test, expect } from '@playwright/test';

/**
 * Basic navigation test to verify screens load without errors
 */

test.describe('Basic Navigation - Check All Screens Load', () => {
  test('should load app without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Navigate to app
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait a bit for Angular to bootstrap
    await page.waitForTimeout(3000);

    // Check for critical errors (ignore expected warnings)
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('Deprecation Warning') &&
      !err.includes('CommonJS') &&
      !err.includes('[webpack-dev-server]')
    );

    console.log('Console Errors:', criticalErrors);
    console.log('Console Warnings:', consoleWarnings.slice(0, 5)); // First 5 warnings

    // Should have no critical errors
    expect(criticalErrors.length).toBe(0);
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check URL
    expect(page.url()).toContain('/login');

    // Take screenshot
    await page.screenshot({ path: 'test-results/login-page.png', fullPage: true });
  });

  test('should check if app-root is present', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const appRoot = await page.locator('app-root');
    await expect(appRoot).toBeVisible();
  });

  test('should load without Storage errors', async ({ page }) => {
    const storageErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('Storage')) {
        storageErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Should have no Storage errors
    expect(storageErrors).toHaveLength(0);
  });
});
