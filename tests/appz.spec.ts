import { test, expect } from './auth-fixture';
import { getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * Appz/Schema Module - API Tests
 * API: /api/schemas, /api/tariffs
 * Tests: Schema Types, Tariffs, Page Load
 */

test.describe('Appz API', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('Schema types returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/schemas?action=types`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log(`Schema types: ${response.status()}`);
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  });

  test('Tariffs LIST returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/tariffs`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log(`Tariffs LIST: ${response.status()}`);
    expect(response.status()).toBe(200);
  });

  test('Page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/appz', { waitUntil: 'domcontentloaded', timeout: 15000 });
    expect(page.url()).toContain('/appz');
  });
});
