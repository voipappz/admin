import { test, expect } from './auth-fixture';

/**
 * Sorting Tests - Verify server-side sorting sends API requests
 * Tests that clicking sort column headers sends order_by/order_type to the server
 */

// Helper: navigate to a screen and wait for the table to render
async function navigateAndWaitForTable(page: any, route: string, apiEndpoint: string) {
  // Set up a response listener for the initial data load
  const responsePromise = page.waitForResponse(
    (resp: any) => resp.url().includes(apiEndpoint) && resp.status() === 200,
    { timeout: 30000 }
  ).catch(() => null);

  // Navigate to the route with networkidle to ensure full render
  await page.goto(route, { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for initial API response
  await responsePromise;

  // Wait for MUI table to be present
  await page.waitForSelector('table', { state: 'visible', timeout: 30000 });

  // Extra settle time for MUI rendering and any pending requests
  await page.waitForTimeout(2000);
}

// Helper: click a sort header and capture the API request
async function clickSortAndCaptureRequest(
  page: any,
  columnText: string,
  apiEndpoint: string,
  expectedField: string,
  timeout = 20000
): Promise<string | null> {
  // Set up request listener BEFORE clicking - match the specific sort field
  const requestPromise = page.waitForRequest(
    (req: any) => {
      const url = req.url();
      return url.includes(apiEndpoint) && url.includes(`order_by=${expectedField}`);
    },
    { timeout }
  ).catch(() => null);

  // MUI TableSortLabel renders as <span class="MuiTableSortLabel-root"> inside <th>
  // Click the span directly for reliable event handling
  const sortSpan = page.locator(`th .MuiTableSortLabel-root:has-text("${columnText}")`).first();
  let count = await sortSpan.count();

  if (count === 0) {
    // Fallback: try clicking the th directly
    const sortTh = page.locator(`th:has-text("${columnText}")`).first();
    count = await sortTh.count();
    if (count === 0) {
      console.log(`Sort column "${columnText}" not found in table headers`);
      return null;
    }
    await sortTh.click();
  } else {
    await sortSpan.click();
  }

  const request = await requestPromise;
  return request ? request.url() : null;
}

test.describe('DIDs Sorting', () => {
  test.setTimeout(90000);

  test('clicking Created At sends order_by=created_at to API', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/dids', '/api/dids');

    const requestUrl = await clickSortAndCaptureRequest(page, 'Created At', '/api/dids', 'created_at');

    expect(requestUrl).toBeTruthy();
    console.log(`DIDs sort API request: ${requestUrl}`);
    expect(requestUrl).toContain('order_by=created_at');
    expect(requestUrl).toMatch(/order_type=(asc|desc)/);
  });

  test('clicking Updated At sends order_by=updated_at to API', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/dids', '/api/dids');

    const requestUrl = await clickSortAndCaptureRequest(page, 'Updated At', '/api/dids', 'updated_at');

    expect(requestUrl).toBeTruthy();
    console.log(`DIDs sort API request: ${requestUrl}`);
    expect(requestUrl).toContain('order_by=updated_at');
    expect(requestUrl).toMatch(/order_type=(asc|desc)/);
  });

  test('clicking same column twice toggles sort direction', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/dids', '/api/dids');

    // Default sort is created_at desc. Clicking Created At toggles to asc.
    const firstUrl = await clickSortAndCaptureRequest(page, 'Created At', '/api/dids', 'created_at');
    expect(firstUrl).toBeTruthy();
    expect(firstUrl).toContain('order_by=created_at');
    expect(firstUrl).toContain('order_type=asc');
    console.log(`First click: ${firstUrl}`);

    // Wait for response before second click
    await page.waitForTimeout(2000);

    // Second click toggles back to desc
    const secondUrl = await clickSortAndCaptureRequest(page, 'Created At', '/api/dids', 'created_at');
    expect(secondUrl).toBeTruthy();
    expect(secondUrl).toContain('order_by=created_at');
    expect(secondUrl).toContain('order_type=desc');
    console.log(`Second click (toggled): ${secondUrl}`);
  });

  test('clicking Name sends order_by=name', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/dids', '/api/dids');

    const requestUrl = await clickSortAndCaptureRequest(page, 'Name', '/api/dids', 'name');
    expect(requestUrl).toBeTruthy();
    expect(requestUrl).toContain('order_by=name');
    expect(requestUrl).toContain('page=1');
    console.log('DIDs: sorting by name sends correct API request with page=1');
  });

  test('clicking Enabled sends order_by=enabled', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/dids', '/api/dids');

    const requestUrl = await clickSortAndCaptureRequest(page, 'Enabled', '/api/dids', 'enabled');
    expect(requestUrl).toBeTruthy();
    expect(requestUrl).toContain('order_by=enabled');
  });
});

test.describe('Other Screens Sorting', () => {
  test.setTimeout(90000);

  test('Users: clicking Created At sends order_by to API', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/users', '/api/users');

    const requestUrl = await clickSortAndCaptureRequest(page, 'Created At', '/api/users', 'created_at');
    expect(requestUrl).toBeTruthy();
    expect(requestUrl).toContain('order_by=created_at');
    expect(requestUrl).toMatch(/order_type=(asc|desc)/);
    console.log('Users: sorting sends correct API request');
  });

  test('Subscriptions: clicking Created At sends order_by to API', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/subscriptions', '/api/subscriptions');

    const requestUrl = await clickSortAndCaptureRequest(page, 'Created At', '/api/subscriptions', 'created_at');
    expect(requestUrl).toBeTruthy();
    expect(requestUrl).toContain('order_by=created_at');
    expect(requestUrl).toMatch(/order_type=(asc|desc)/);
    console.log('Subscriptions: sorting sends correct API request');
  });

  test('Extensions: clicking Created At sends order_by to API', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/extensions', '/api/devices');

    const requestUrl = await clickSortAndCaptureRequest(page, 'Created At', '/api/devices', 'created_at');
    expect(requestUrl).toBeTruthy();
    expect(requestUrl).toContain('order_by=created_at');
    expect(requestUrl).toMatch(/order_type=(asc|desc)/);
    console.log('Extensions: sorting sends correct API request');
  });

  test('Services: clicking Name toggles sort direction', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/services', '/api/services');

    // Services default sort is name + asc. Clicking toggles to desc.
    // Use a response-based check to avoid race conditions with default sort
    const responsePromise = page.waitForResponse(
      (resp: any) => {
        const url = resp.url();
        return url.includes('/api/services') && url.includes('order_by=name') && url.includes('order_type=desc');
      },
      { timeout: 20000 }
    ).catch(() => null);

    const sortSpan = page.locator('th .MuiTableSortLabel-root:has-text("Name")').first();
    await sortSpan.click();

    const response = await responsePromise;
    expect(response).toBeTruthy();
    console.log('Services: clicking Name toggled sort to desc');
  });

  test('Providers: clicking Created sends order_by to API', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/providers', '/api/providers');

    const requestUrl = await clickSortAndCaptureRequest(page, 'Created', '/api/providers', 'created_at');
    expect(requestUrl).toBeTruthy();
    expect(requestUrl).toContain('order_by=created_at');
    expect(requestUrl).toMatch(/order_type=(asc|desc)/);
    console.log('Providers: sorting sends correct API request');
  });

  test('Campaigns: clicking Created sends order_by to API', async ({ authenticatedPage: page }) => {
    await navigateAndWaitForTable(page, '/campaigns', '/api/campaigns');

    const requestUrl = await clickSortAndCaptureRequest(page, 'Created', '/api/campaigns', 'created_at');
    expect(requestUrl).toBeTruthy();
    expect(requestUrl).toContain('order_by=created_at');
    expect(requestUrl).toMatch(/order_type=(asc|desc)/);
    console.log('Campaigns: sorting sends correct API request');
  });
});
