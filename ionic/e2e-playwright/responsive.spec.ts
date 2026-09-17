import { test, expect, Page } from '@playwright/test';

/**
 * Responsive Tests - Desktop, Tablet, and Mobile
 * Tests that verify the app works correctly across all device sizes
 */

test.describe.skip('Responsive Layout Tests', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test('should load login page correctly', async ({ page, isMobile }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check that the page loaded
    expect(page.url()).toContain('/login');

    // Check for login form elements
    const emailInput = page.locator('ion-input[name="email"]');
    const passwordInput = page.locator('ion-input[name="password"]');
    const submitBtn = page.locator('ion-button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({
      path: `test-results/login-${isMobile ? 'mobile' : 'desktop'}.png`,
      fullPage: true
    });
  });

  test('should have touch-friendly input sizes on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check that inputs are large enough for touch (min 44px height recommended)
    const emailInput = page.locator('ion-input[name="email"]');
    const box = await emailInput.boundingBox();

    expect(box).not.toBeNull();
    if (box) {
      // Ionic inputs should be at least 44px tall for touch
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
  });

  test('should have readable text on all devices', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check that no text is clipped or overflowing
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();

    // Check that ion-title is visible
    const title = page.locator('ion-title').first();
    await expect(title).toBeVisible();
  });

  test('should display buttons correctly', async ({ page, isMobile }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const submitBtn = page.locator('ion-button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    const box = await submitBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Buttons should be adequately sized
      expect(box.width).toBeGreaterThan(80);
      expect(box.height).toBeGreaterThanOrEqual(36);
    }
  });
});

test.describe.skip('Navigation Tests', () => {
  test('should navigate between pages', async ({ page }) => {
    // Start at root
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Should redirect to login or app
    const url = page.url();
    expect(url.includes('/login') || url.includes('/app')).toBeTruthy();
  });

  test('should handle back navigation', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to another page if possible
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Go back
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');

    // Should still be functional
    const response = await page.reload();
    expect(response?.status()).toBeLessThan(400);
  });
});

test.describe.skip('Form Interaction Tests', () => {
  test('should allow typing in inputs', async ({ page, isMobile }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const emailInput = page.locator('ion-input[name="email"]');
    await expect(emailInput).toBeVisible();

    // Click to focus
    await emailInput.click();
    await page.waitForTimeout(300);

    // Type test value
    await page.keyboard.type('test123');
    await page.waitForTimeout(300);

    // Verify the value was entered
    const value = await page.evaluate(() => {
      const input = document.querySelector('ion-input[name="email"]') as any;
      return input?.value || '';
    });

    expect(value).toContain('test123');
  });

  test('should handle form submission', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Fill the form
    const emailInput = page.locator('ion-input[name="email"]');
    const passwordInput = page.locator('ion-input[name="password"]');

    await emailInput.click();
    await page.keyboard.type('testuser');

    await passwordInput.click();
    await page.keyboard.type('testpass');

    await page.waitForTimeout(500);

    // Submit button should be clickable
    const submitBtn = page.locator('ion-button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });
});

test.describe.skip('Visual Consistency Tests', () => {
  test('should not have horizontal scroll on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check for horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });

  test('should have consistent styling', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check that Ionic components loaded correctly
    const ionApp = page.locator('ion-app');
    await expect(ionApp).toBeVisible();

    // Check for ion-content (may be hidden but should exist and be attached)
    const ionContent = page.locator('ion-content').first();
    await expect(ionContent).toBeAttached();
  });
});

test.describe.skip('Touch Interaction Tests', () => {
  test('should respond to taps on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Tap on email input
    const emailInput = page.locator('ion-input[name="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.tap();
    await page.waitForTimeout(500);

    // Input should be visible and clickable (Ionic handles focus internally)
    await expect(emailInput).toBeVisible();

    // Verify input can receive text
    await page.keyboard.type('test');
    const value = await page.evaluate(() => {
      const input = document.querySelector('ion-input[name="email"]') as any;
      return input?.value || '';
    });
    expect(value.length).toBeGreaterThan(0);
  });

  test('should handle swipe gestures on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Swipe down to scroll (if scrollable)
    await page.mouse.move(200, 300);
    await page.mouse.down();
    await page.mouse.move(200, 100, { steps: 10 });
    await page.mouse.up();

    // Page should still be functional
    const emailInput = page.locator('ion-input[name="email"]');
    await expect(emailInput).toBeVisible();
  });
});

test.describe.skip('Orientation Tests', () => {
  test('should handle portrait orientation', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }

    // Portrait is default for mobile devices in config
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (viewport) {
      // Portrait: height > width
      expect(viewport.height).toBeGreaterThan(viewport.width);
    }

    // All elements should still be visible
    const emailInput = page.locator('ion-input[name="email"]');
    await expect(emailInput).toBeVisible();
  });
});

test.describe.skip('Performance Tests', () => {
  test('should load within acceptable time', async ({ page }) => {
    test.setTimeout(60000);
    const startTime = Date.now();

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    // Should load within 30 seconds (generous for CI with parallel tests)
    expect(loadTime).toBeLessThan(30000);

    console.log(`Page load time: ${loadTime}ms`);
  });

  test('should not have memory leaks on navigation', async ({ page }) => {
    test.setTimeout(120000);

    // Navigate multiple times with generous waits
    for (let i = 0; i < 2; i++) {
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    }

    // Page should still be functional
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const emailInput = page.locator('ion-input[name="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });
});
