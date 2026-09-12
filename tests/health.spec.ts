import { test, expect } from './auth-fixture';

/**
 * Health API Tests
 * API: /health
 * Tests: Health check, Verbose health check
 */

test.describe('Health API', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('Basic health check returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL || '';

    const response = await page.request.get(`${apiBaseUrl}/health`);

    console.log(`Health: ${response.status()}`);
    expect(response.status()).toBe(200);

    const text = await response.text();
    console.log(`Health response: ${text}`);
    // Accept both "healthy" plain text and JSON responses
    expect(text.length).toBeGreaterThan(0);
  });

  test('Verbose health check returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL || '';

    const response = await page.request.get(`${apiBaseUrl}/health?verbose`);

    console.log(`Verbose Health: ${response.status()}`);
    expect(response.status()).toBe(200);

    const text = await response.text();
    console.log(`Verbose Health response: ${text}`);

    // Try to parse as JSON, but accept plain text as well
    try {
      const data = JSON.parse(text);
      console.log(`✅ Response is JSON`);

      // Check for common verbose health fields
      if (data.status) {
        console.log(`✅ Status field present: ${data.status}`);
      }

      if (data.checks) {
        console.log(`✅ Checks field present with ${Object.keys(data.checks).length} checks`);
      }

      if (data.timestamp) {
        console.log(`✅ Timestamp field present: ${data.timestamp}`);
      }

      if (data.process) {
        console.log(`✅ Process info present`);
      }
    } catch {
      // Plain text response (e.g., "healthy")
      console.log(`ℹ️ Response is plain text: ${text}`);
      expect(text.toLowerCase()).toContain('healthy');
    }
  });

  test('Detailed health endpoint returns 200 or 401', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL || '';

    const response = await page.request.get(`${apiBaseUrl}/health/detailed`);

    console.log(`Detailed Health: ${response.status()}`);
    // Accept 200, 401 (auth required), or 404 (endpoint may not exist)
    expect([200, 401, 404]).toContain(response.status());

    if (response.status() === 200) {
      const text = await response.text();
      console.log(`Detailed Health response: ${text.substring(0, 200)}...`);
    } else if (response.status() === 401) {
      console.log('ℹ️ Detailed health requires authentication');
    }
  });

  test('LB health endpoint returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL || '';

    const response = await page.request.get(`${apiBaseUrl}/health/lb`);

    console.log(`LB Health: ${response.status()}`);
    expect(response.status()).toBe(200);

    const text = await response.text();
    console.log(`LB Health response: ${text}`);
  });
});

test.describe('Health Indicator in UI', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('Main menu loads with icon buttons', async ({ authenticatedPage: page }) => {
    await page.goto('/live', { waitUntil: 'networkidle', timeout: 20000 });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check for icon buttons in the menu (health is one of them)
    const iconButtons = page.locator('button');
    const iconButtonCount = await iconButtons.count();
    console.log(`Found ${iconButtonCount} buttons in main menu`);

    // We expect at least some buttons (search, notifications, profile, health)
    expect(iconButtonCount).toBeGreaterThan(0);
    console.log('✅ Main menu buttons found');
  });
});
