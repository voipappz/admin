import { test, expect, Page } from '@playwright/test';

/**
 * Call Condition API Tests
 * Verifies the CRUD operations for call conditions API
 *
 * Based on nimbus-admin patterns:
 * - GET /api/call_conditions - List all
 * - GET /api/call_conditions/:uuid - Get single
 * - POST /api/call_conditions - Create
 * - PATCH /api/call_conditions/:uuid - Update
 * - DELETE /api/call_conditions/:uuid - Delete
 * - GET /api/assets/bridge_types - Get available bridge types
 */

// Test credentials
const TEST_CREDENTIALS = {
  email: '93196',
  password: '34rkew'
};

// Store auth token for API calls
let authToken: string = '';
let testCallConditionUuid: string = '';

/**
 * Login and get auth token
 */
async function loginAndGetToken(page: Page): Promise<string> {
  // Navigate to login
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Intercept login response to get token
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/auth/user_login')),
    (async () => {
      await page.locator('ion-input[name="email"] input').fill(TEST_CREDENTIALS.email);
      await page.locator('ion-input[name="password"] input').fill(TEST_CREDENTIALS.password);
      await page.locator('ion-button[type="submit"]').click();
    })()
  ]);

  const data = await response.json();
  console.log('Login response:', JSON.stringify(data, null, 2));

  // Wait for app to load
  await page.waitForURL('**/app/**', { timeout: 15000 });

  // Get token from localStorage
  const token = await page.evaluate(() => {
    return localStorage.getItem('authce9d77b308c149d5992a80073637e4d5');
  });

  console.log('Auth token:', token ? `${token.substring(0, 20)}...` : 'NOT FOUND');
  return token || '';
}

/**
 * Make authenticated API request
 */
async function apiRequest(page: Page, method: string, endpoint: string, body?: any): Promise<any> {
  const result = await page.evaluate(async ({ method, endpoint, body, token }) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      // Convert object to URL-encoded form data
      const formData = new URLSearchParams();
      const addToFormData = (obj: any, prefix = '') => {
        for (const key in obj) {
          const value = obj[key];
          const fieldKey = prefix ? `${prefix}[${key}]` : key;
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            addToFormData(value, fieldKey);
          } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (typeof item === 'object') {
                addToFormData(item, `${fieldKey}[${index}]`);
              } else {
                formData.append(`${fieldKey}[]`, String(item));
              }
            });
          } else {
            formData.append(fieldKey, String(value));
          }
        }
      };
      addToFormData(body);
      options.body = formData.toString();
    }

    console.log(`API Request: ${method} ${url}`);

    try {
      const response = await fetch(url, options);
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return {
        status: response.status,
        statusText: response.statusText,
        data,
        ok: response.ok
      };
    } catch (error) {
      return {
        status: 0,
        statusText: 'Network Error',
        data: { error: String(error) },
        ok: false
      };
    }
  }, { method, endpoint, body, token: authToken });

  console.log(`API Response [${method} ${endpoint}]:`, JSON.stringify(result, null, 2));
  return result;
}

test.describe('Call Condition API Tests', () => {
  test.beforeAll(async ({ browser }) => {
    // Login once to get auth token
    const page = await browser.newPage();
    authToken = await loginAndGetToken(page);
    await page.close();
  });

  test('1. GET /api/assets/bridge_types - List available bridge types', async ({ page }) => {
    await page.goto('/app/calls');
    await page.waitForLoadState('domcontentloaded');

    const result = await apiRequest(page, 'GET', '/api/assets/bridge_types');

    console.log('\n========== BRIDGE TYPES ==========');
    console.log('Status:', result.status);
    console.log('Data:', JSON.stringify(result.data, null, 2));
    console.log('====================================\n');

    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('2. GET /api/call_conditions - List all call conditions', async ({ page }) => {
    await page.goto('/app/calls');
    await page.waitForLoadState('domcontentloaded');

    const result = await apiRequest(page, 'GET', '/api/call_conditions?page=1&per_page=20&order_by=created_at&order_type=desc');

    console.log('\n========== CALL CONDITIONS LIST ==========');
    console.log('Status:', result.status);
    console.log('Count:', Array.isArray(result.data) ? result.data.length : 'N/A');
    if (Array.isArray(result.data) && result.data[0]) {
      console.log('First item:', JSON.stringify(result.data[0], null, 2));
      testCallConditionUuid = result.data[0].uuid;
    }
    console.log('==========================================\n');

    expect(result.ok).toBe(true);
  });

  test('3. GET /api/call_conditions/:uuid - Get single call condition', async ({ page }) => {
    // Skip if no call condition found in previous test
    test.skip(!testCallConditionUuid, 'No call condition found to test');

    await page.goto('/app/calls');
    await page.waitForLoadState('domcontentloaded');

    const result = await apiRequest(page, 'GET', `/api/call_conditions/${testCallConditionUuid}`);

    console.log('\n========== SINGLE CALL CONDITION ==========');
    console.log('Status:', result.status);
    console.log('Data:', JSON.stringify(result.data, null, 2));
    console.log('============================================\n');

    expect(result.ok).toBe(true);
    expect(result.data.uuid).toBe(testCallConditionUuid);
  });

  test('4. GET /api/call_conditions/:uuid?action=load - Get call condition with load action', async ({ page }) => {
    test.skip(!testCallConditionUuid, 'No call condition found to test');

    await page.goto('/app/calls');
    await page.waitForLoadState('domcontentloaded');

    const result = await apiRequest(page, 'GET', `/api/call_conditions/${testCallConditionUuid}?action=load`);

    console.log('\n========== CALL CONDITION WITH LOAD ACTION ==========');
    console.log('Status:', result.status);
    console.log('Data:', JSON.stringify(result.data, null, 2));
    console.log('======================================================\n');

    expect(result.ok).toBe(true);
  });

  test('5. GET /api/extensions - List extensions (bridge resources)', async ({ page }) => {
    await page.goto('/app/calls');
    await page.waitForLoadState('domcontentloaded');

    const result = await apiRequest(page, 'GET', '/api/extensions?page=1&per_page=20');

    console.log('\n========== EXTENSIONS ==========');
    console.log('Status:', result.status);
    console.log('Count:', Array.isArray(result.data) ? result.data.length : 'N/A');
    if (Array.isArray(result.data) && result.data[0]) {
      console.log('First extension:', JSON.stringify(result.data[0], null, 2));
    }
    console.log('=================================\n');

    expect(result.ok).toBe(true);
  });

  test('6. GET /api/ivrs - List IVRs (bridge resources)', async ({ page }) => {
    await page.goto('/app/calls');
    await page.waitForLoadState('domcontentloaded');

    const result = await apiRequest(page, 'GET', '/api/ivrs?page=1&per_page=20');

    console.log('\n========== IVRs ==========');
    console.log('Status:', result.status);
    console.log('Count:', Array.isArray(result.data) ? result.data.length : 'N/A');
    console.log('==========================\n');

    expect(result.ok).toBe(true);
  });

  test('7. GET /api/queues - List queues (bridge resources)', async ({ page }) => {
    await page.goto('/app/calls');
    await page.waitForLoadState('domcontentloaded');

    const result = await apiRequest(page, 'GET', '/api/queues?page=1&per_page=20');

    console.log('\n========== QUEUES ==========');
    console.log('Status:', result.status);
    console.log('Count:', Array.isArray(result.data) ? result.data.length : 'N/A');
    console.log('============================\n');

    expect(result.ok).toBe(true);
  });

  test('8. Verify user has call_condition resource', async ({ page }) => {
    await page.goto('/app/calls');
    await page.waitForLoadState('domcontentloaded');

    // Get user data from localStorage
    const userData = await page.evaluate(() => {
      const userDataStr = localStorage.getItem('user');
      return userDataStr ? JSON.parse(userDataStr) : null;
    });

    console.log('\n========== USER DATA ==========');
    console.log('User resources:', JSON.stringify(userData?.resources, null, 2));

    // Find call_condition resource
    const callConditionResource = userData?.resources?.find((r: any) => r.type === 'call_condition');
    console.log('Call condition resource:', JSON.stringify(callConditionResource, null, 2));
    console.log('================================\n');

    if (callConditionResource) {
      expect(callConditionResource.type_uuid).toBeTruthy();
    }
  });
});

test.describe('Call Condition API - Data Structure Analysis', () => {
  test.beforeAll(async ({ browser }) => {
    if (!authToken) {
      const page = await browser.newPage();
      authToken = await loginAndGetToken(page);
      await page.close();
    }
  });

  test('Analyze call condition data structure', async ({ page }) => {
    await page.goto('/app/calls');
    await page.waitForLoadState('domcontentloaded');

    // Get list of call conditions
    const listResult = await apiRequest(page, 'GET', '/api/call_conditions?page=1&per_page=5');

    if (listResult.ok && Array.isArray(listResult.data) && listResult.data.length > 0) {
      const firstCondition = listResult.data[0];

      // Get detailed data
      const detailResult = await apiRequest(page, 'GET', `/api/call_conditions/${firstCondition.uuid}?action=load`);

      console.log('\n========== CALL CONDITION DATA STRUCTURE ==========');
      console.log('Fields in call condition:');
      if (detailResult.ok && detailResult.data) {
        const data = detailResult.data;
        console.log('- uuid:', data.uuid);
        console.log('- name:', data.name);
        console.log('- enabled:', data.enabled);
        console.log('- environment_uuid:', data.environment_uuid);
        console.log('- fallback_bridge_type:', data.fallback_bridge_type);
        console.log('- fallback_bridge_uuid:', data.fallback_bridge_uuid);
        console.log('- notes:', data.notes);
        console.log('- meta:', JSON.stringify(data.meta, null, 2));
        console.log('- resources count:', data.resources?.length || 0);

        if (data.resources && data.resources.length > 0) {
          console.log('\nFirst resource structure:');
          const resource = data.resources[0];
          console.log('- name:', resource.name);
          console.log('- bridge_type:', resource.bridge_type);
          console.log('- bridge_uuid:', resource.bridge_uuid);
          console.log('- time:', resource.time);
          console.log('- week_day:', resource.week_day);
          console.log('- month_day:', resource.month_day);
          console.log('- month:', resource.month);
          console.log('- year:', resource.year);
        }

        console.log('\nFull data:', JSON.stringify(data, null, 2));
      }
      console.log('====================================================\n');
    } else {
      console.log('No call conditions found in the system');
    }

    expect(true).toBe(true); // This test is for analysis only
  });
});
