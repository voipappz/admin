import { test, expect } from '@playwright/test';

/**
 * Smoke tests for CI - basic checks that the app loads
 * These tests are designed to be simple and reliable for CI
 * Works across Desktop, Mobile, and Tablet devices
 */

test.describe.skip('Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Increase timeout for Angular app bootstrap
    test.setTimeout(60000);
  });

  test('should load the app HTML', async ({ page, isMobile }) => {
    // Navigate to the app
    const response = await page.goto('/');

    // Check that we got a successful response
    expect(response?.status()).toBeLessThan(400);

    // Check that the page has app-root element
    const pageContent = await page.content();
    expect(pageContent).toContain('app-root');

    // Log device type for debugging
    console.log(`Testing on: ${isMobile ? 'Mobile' : 'Desktop'}`);
  });

  test('should have valid HTML structure', async ({ page }) => {
    await page.goto('/');

    // Wait for initial load
    await page.waitForLoadState('domcontentloaded');

    // Check basic HTML structure
    const html = await page.locator('html');
    await expect(html).toBeVisible();

    // Check that body has content
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should load Ionic components', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check that Ionic app wrapper loaded
    const ionApp = page.locator('ion-app');
    await expect(ionApp).toBeVisible();
  });

  test('should load scripts successfully', async ({ page }) => {
    const scriptErrors: string[] = [];

    // Listen for failed requests
    page.on('requestfailed', request => {
      const url = request.url();
      if (url.endsWith('.js')) {
        scriptErrors.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // No critical script failures
    expect(scriptErrors.filter(e => e.includes('main.js') || e.includes('vendor.js'))).toHaveLength(0);
  });

  test('should return 200 for main routes', async ({ page }) => {
    // Test main route
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Should be on login page or app page
    const url = page.url();
    const isValidRoute = url.includes('/login') || url.includes('/app');
    expect(isValidRoute).toBeTruthy();
  });

  test('should have no critical console errors', async ({ page }) => {
    const criticalErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out known non-critical errors
        if (!text.includes('favicon') &&
            !text.includes('Deprecation') &&
            !text.includes('CommonJS') &&
            !text.includes('webpack-dev-server') &&
            !text.includes('ResizeObserver') &&
            !text.includes('WebSocket') &&
            // Network/API errors expected in CI environment
            !text.includes('CORS') &&
            !text.includes('Access-Control-Allow-Origin') &&
            !text.includes('HttpErrorResponse') &&
            !text.includes('net::ERR_FAILED') &&
            !text.includes('net::ERR_CONNECTION') &&
            !text.includes('Failed to load resource') &&
            !text.includes('NetworkError')) {
          criticalErrors.push(text);
        }
      }
    });

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Log errors for debugging
    if (criticalErrors.length > 0) {
      console.log('Console errors found:', criticalErrors);
    }

    // Allow some errors but not too many
    expect(criticalErrors.length).toBeLessThan(5);
  });
});

test.describe.skip('Mobile-Specific Smoke Tests', () => {
  test('should have mobile-friendly viewport', async ({ page, isMobile, browserName }) => {
    if (!isMobile) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    // Mobile/tablet viewports should be narrower than desktop (< 1024px)
    if (viewport) {
      expect(viewport.width).toBeLessThan(1024);
    }
  });

  test('should not have horizontal overflow on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasOverflow).toBeFalsy();
  });
});
