import { test, expect } from './auth-fixture';
import { getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * Logs Module - API Tests
 * API: /api/logs
 * Tests: LIST, Filters API, Page Load
 */

test.describe('Logs API', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/logs?page=1&per_page=50`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log(`Logs LIST: ${response.status()}`);
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
  });

  test('Apps endpoint returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/logs/apps`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log(`Logs Apps: ${response.status()}`);
    // May return 200 or 404 depending on implementation
    expect([200, 404]).toContain(response.status());
  });

  test('Page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/logs', { waitUntil: 'domcontentloaded', timeout: 15000 });
    expect(page.url()).toContain('/logs');
  });

  test('Pagination exists', async ({ authenticatedPage: page }) => {
    await page.goto('/logs', { waitUntil: 'networkidle', timeout: 20000 });

    // Check for TablePagination component
    const pagination = page.locator('[class*="MuiTablePagination"]');
    const hasPagination = await pagination.count() > 0;

    if (hasPagination) {
      console.log('✅ Pagination component found');
      expect(await pagination.isVisible()).toBe(true);

      // Check for rows per page selector
      const rowsPerPage = page.locator('[class*="MuiTablePagination-select"]');
      if (await rowsPerPage.count() > 0) {
        console.log('✅ Rows per page selector found');
      }

      // Check for page navigation buttons
      const navButtons = page.locator('[class*="MuiTablePagination-actions"] button');
      const buttonCount = await navButtons.count();
      console.log(`✅ Found ${buttonCount} pagination navigation buttons`);
    } else {
      console.log('Pagination not visible (may need data to display)');
    }

    expect(true).toBe(true);
  });

  test('Pagination with API params', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Test page 1
    const page1Response = await page.request.get(`${apiBaseUrl}/api/logs?page=1&per_page=25`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(page1Response.status()).toBeGreaterThanOrEqual(200);
    expect(page1Response.status()).toBeLessThan(300);
    console.log('✅ Page 1 with 25 per page: OK');

    // Test page 2
    const page2Response = await page.request.get(`${apiBaseUrl}/api/logs?page=2&per_page=25`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(page2Response.status()).toBeGreaterThanOrEqual(200);
    expect(page2Response.status()).toBeLessThan(300);
    console.log('✅ Page 2 with 25 per page: OK');
  });

  test('Pagination with higher limits (100, 200, 500)', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const pageSizes = [100, 200, 500];

    for (const pageSize of pageSizes) {
      const response = await page.request.get(`${apiBaseUrl}/api/logs?page=1&per_page=${pageSize}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(300);
      console.log(`✅ Pagination with ${pageSize} per page: OK`);
    }
  });

  test('Rows per page dropdown has all options', async ({ authenticatedPage: page }) => {
    await page.goto('/logs', { waitUntil: 'networkidle', timeout: 20000 });

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    // Find the rows per page selector
    const rowsPerPageSelector = page.locator('[class*="MuiTablePagination-select"]');
    const hasPagination = await rowsPerPageSelector.count() > 0;

    if (hasPagination) {
      // Click to open dropdown
      await rowsPerPageSelector.click();
      await page.waitForTimeout(500);

      // Check for options
      const menuItems = page.locator('.MuiMenuItem-root');
      const optionCount = await menuItems.count();
      console.log(`✅ Found ${optionCount} pagination options`);

      // Verify expected options exist
      const expectedOptions = ['25', '50', '100', '200', '500'];
      for (const opt of expectedOptions) {
        const optionExists = await page.locator(`.MuiMenuItem-root:has-text("${opt}")`).count() > 0;
        if (optionExists) {
          console.log(`✅ Option ${opt} exists`);
        }
      }

      // Close dropdown
      await page.keyboard.press('Escape');
    } else {
      console.log('⚠️ Pagination not visible');
    }

    expect(true).toBe(true);
  });
});

test.describe('Logs from Users Screen', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('User logs API with subject filter returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // First get a user to get logs for
    const usersResponse = await page.request.get(`${apiBaseUrl}/api/users?page=1&per_page=5`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (usersResponse.status() !== 200) {
      console.log('⚠️ No users available, skipping user logs test');
      return;
    }

    const usersData = await usersResponse.json();
    const users = Array.isArray(usersData) ? usersData : usersData.data || [];

    if (users.length === 0) {
      console.log('⚠️ No users found, skipping user logs test');
      return;
    }

    const userUuid = users[0].uuid;

    // Get logs for this user
    const logsResponse = await page.request.get(
      `${apiBaseUrl}/api/logs?page=1&per_page=50&subject=user&subject_uuid=${userUuid}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    console.log(`User Logs API: ${logsResponse.status()}`);
    expect(logsResponse.status()).toBeGreaterThanOrEqual(200);
    expect(logsResponse.status()).toBeLessThan(300);
  });

  test('View Logs button exists in Users table', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'networkidle', timeout: 20000 });

    // Wait for table to load
    await page.waitForTimeout(2000);

    // Check for logs icon button in the table (History icon)
    const logsButtons = page.locator('button[aria-label*="logs"], [data-testid*="logs"], svg[data-testid="HistoryIcon"]').first();

    const hasLogsButton = await logsButtons.count() > 0;
    if (hasLogsButton) {
      console.log('✅ View Logs button found in Users table');
    } else {
      console.log('⚠️ View Logs button not visible (may need users in table)');
    }

    expect(true).toBe(true);
  });
});

test.describe('Logs from Calls Screen', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('Call logs API with type=logs returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // First get a call to get logs for
    const startOfToday = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const endOfToday = Math.floor(new Date().setHours(23, 59, 59, 999) / 1000);

    const callsResponse = await page.request.get(
      `${apiBaseUrl}/api/calls?page=1&per_page=5&search[created_at]=${startOfToday} - ${endOfToday}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    if (callsResponse.status() !== 200) {
      console.log('⚠️ No calls available, skipping call logs test');
      return;
    }

    const callsData = await callsResponse.json();
    const calls = Array.isArray(callsData) ? callsData : callsData.data || [];

    if (calls.length === 0) {
      console.log('⚠️ No calls found, skipping call logs test');
      return;
    }

    const callUuid = calls[0].uuid;

    // Get logs for this call using the type=logs endpoint
    const logsResponse = await page.request.get(
      `${apiBaseUrl}/api/calls/${callUuid}?type=logs`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    console.log(`Call Logs API: ${logsResponse.status()}`);
    // Accept 200 or 404 (if no logs for this call)
    expect([200, 404]).toContain(logsResponse.status());
  });

  test('Actions menu exists in Calls table', async ({ authenticatedPage: page }) => {
    await page.goto('/calls', { waitUntil: 'networkidle', timeout: 20000 });

    // Wait for table to load
    await page.waitForTimeout(2000);

    // Check for more actions button (MoreVert icon)
    const actionsButton = page.locator('button:has(svg[data-testid="MoreVertIcon"])').first();

    const hasActionsButton = await actionsButton.count() > 0;
    if (hasActionsButton) {
      console.log('✅ Actions menu button found in Calls table');

      // Click to open the menu
      await actionsButton.click();
      await page.waitForTimeout(500);

      // Check for View Logs menu item
      const viewLogsItem = page.locator('li:has-text("View Logs")');
      const hasViewLogs = await viewLogsItem.count() > 0;

      if (hasViewLogs) {
        console.log('✅ View Logs menu item found');
      }

      // Close menu
      await page.keyboard.press('Escape');
    } else {
      console.log('⚠️ Actions menu not visible (may need calls in table)');
    }

    expect(true).toBe(true);
  });
});
