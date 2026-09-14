import { test, expect, getAuthToken } from './auth-fixture';

/**
 * Extensions CRUD Tests
 * Tests for the Extensions management screen
 */

test.describe('Extensions Management', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Navigate to extensions page
    await page.goto('/extensions', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  });

  test('should load extensions page and display table', async ({ authenticatedPage: page }) => {
    // Verify page loaded
    await expect(page.locator('h2:has-text("Devices")')).toBeVisible({ timeout: 10000 });

    // Verify table exists
    await expect(page.locator('table')).toBeVisible();

    // Verify table headers
    await expect(page.locator('th:has-text("Created At")')).toBeVisible();
    await expect(page.locator('th:has-text("Device")')).toBeVisible();
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Environment")')).toBeVisible();
    await expect(page.locator('th:has-text("Actions")')).toBeVisible();
  });

  test('should fetch extensions API and return 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL;
    const authToken = await getAuthToken(page);

    // Test API returns 200
    const response = await page.request.get(`${apiBaseUrl}/api/devices?page=1&per_page=10`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  });

  test('should open add extension dialog', async ({ authenticatedPage: page }) => {
    // Click Add Extension button
    await page.click('button:has-text("Add Device")');

    // Verify dialog opened
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h6:has-text("Create Device")')).toBeVisible();

    // Verify form fields exist
    await expect(page.locator('label:has-text("Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Device Number")')).toBeVisible();
    await expect(page.locator('label:has-text("SIP Password")')).toBeVisible();

    // Close dialog
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('should toggle sidebar filters', async ({ authenticatedPage: page }) => {
    // Verify sidebar is visible initially
    const sidebar = page.locator('.extensions-sidebar');
    await expect(sidebar).toBeVisible();

    // Click toggle button to hide sidebar
    await page.click('button[title="Hide filters"]');

    // Verify sidebar is hidden
    await expect(sidebar).not.toBeVisible({ timeout: 3000 });

    // Click toggle button to show sidebar
    await page.click('button[title="Show filters"]');

    // Verify sidebar is visible again
    await expect(sidebar).toBeVisible({ timeout: 3000 });
  });

  test('should have filter inputs in sidebar', async ({ authenticatedPage: page }) => {
    // Verify search input exists
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Verify Enabled filter exists
    await expect(page.locator('.extensions-sidebar label:has-text("Enabled")')).toBeVisible();

    // Verify Environment filter exists in sidebar (use exact match to avoid header conflict)
    await expect(page.locator('.extensions-sidebar label:has-text("Environment"):not(:has-text("Environments"))')).toBeVisible();
  });

  test('should show table with pagination', async ({ authenticatedPage: page }) => {
    // Verify table exists
    await expect(page.locator('table')).toBeVisible();

    // Verify pagination component exists
    await expect(page.locator('.MuiTablePagination-root')).toBeVisible({ timeout: 5000 });
  });

  test('should have sortable columns', async ({ authenticatedPage: page }) => {
    // Verify sort labels exist on sortable columns
    const createdAtHeader = page.locator('th:has-text("Created At") .MuiTableSortLabel-root');
    await expect(createdAtHeader).toBeVisible({ timeout: 5000 });

    const nameHeader = page.locator('th:has-text("Name") .MuiTableSortLabel-root');
    await expect(nameHeader).toBeVisible();
  });

  test('should show import CSV button', async ({ authenticatedPage: page }) => {
    // Verify Import CSV button exists
    await expect(page.locator('button:has-text("Import CSV")')).toBeVisible();
  });

  test('should have refresh button', async ({ authenticatedPage: page }) => {
    // Verify Refresh button exists (icon button with title)
    const refreshButton = page.locator('[aria-label="Refresh"], button:has([data-testid="RefreshIcon"])').first();
    await expect(refreshButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Extensions API Tests', () => {
  test('API: GET /api/devices returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL;
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/devices`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status()).toBe(200);
  });

  test('API: GET /api/devices with pagination returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL;
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/devices?page=1&per_page=10`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status()).toBe(200);
  });

  test('API: GET /api/devices with search filter returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL;
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/devices?search[name]=test`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status()).toBe(200);
  });
});
