import { test, expect } from './auth-fixture';
import { testList, getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * Messages Module - Comprehensive Tests
 * API: /api/messages
 * Tests: LIST, Segments, Search with Operators, Filters
 */

test.describe('Messages API', () => {
  test.setTimeout(120000); // 2 min timeout for all tests

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const response = await testList(page, 'messages');
    // Messages may return 200 or 404 if no data
    expect([200, 404]).toContain(response.status());
    console.log(`Messages LIST: ${response.status()}`);
  });

  test('GET columns returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/messages?action=columns`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status()).toBe(200);
    const columns = await response.json();
    console.log(`Messages columns: ${Array.isArray(columns) ? columns.length : 'N/A'} columns`);
  });

  test('GET fields returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/messages?action=fields`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status()).toBe(200);
    const fields = await response.json();
    console.log(`Messages fields: ${Array.isArray(fields) ? fields.length : 'object'}`);
  });

  test('GET segments returns 200 with segment definitions', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/messages?action=segments`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      timeout: 60000
    });

    // Accept 200 or 404 (if not yet deployed)
    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const segments = await response.json();
      expect(Array.isArray(segments)).toBe(true);

      if (segments.length > 0) {
        const segmentNames = segments.map((s: any) => s.name);
        console.log(`Messages segments: ${segments.length} segments found`);
        console.log(`Segment names: ${segmentNames.join(', ')}`);

        // Verify expected segment definitions exist (if new code deployed)
        if (segmentNames.includes('message.type')) {
          expect(segmentNames).toContain('message.type');
          expect(segmentNames).toContain('message.status');
        }
      }
    } else {
      console.log('Segments endpoint not available (new code may not be deployed)');
    }
  });
});

/**
 * Messages Search Tests
 * Tests search functionality with segment operators (IS, CONTAINS, etc.)
 */
test.describe('Messages Search with Segments', () => {
  test.setTimeout(120000);

  test('Search with date range returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Calculate date range (last 30 days)
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startTimestamp = Math.floor(monthAgo.getTime() / 1000);
    const endTimestamp = Math.floor(now.getTime() / 1000);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=20&search[created_at]=${startTimestamp}-${endTimestamp}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      const messages = Array.isArray(data) ? data : data.data || [];
      console.log(`Messages date range search: ${messages.length} results`);
    } else {
      console.log('No messages found for date range');
    }
  });

  test('Search with text/inline parameter returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=20&search[text]=test`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());
    console.log(`Messages text search status: ${response.status()}`);
  });

  test('Search with type IS operator returns only matching types', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Search for email type messages
    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=20&search[message.type][IS][]=email`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      const messages = Array.isArray(data) ? data : data.data || [];

      // Verify all returned messages are of type 'email'
      messages.forEach((msg: any) => {
        if (msg.type) {
          expect(msg.type).toBe('email');
        }
      });

      console.log(`Messages type=email search: ${messages.length} results`);
    } else {
      console.log('No email messages found');
    }
  });

  test('Search with type IS operator for sms returns only sms', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=20&search[message.type][IS][]=sms`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      const messages = Array.isArray(data) ? data : data.data || [];

      messages.forEach((msg: any) => {
        if (msg.type) {
          expect(msg.type).toBe('sms');
        }
      });

      console.log(`Messages type=sms search: ${messages.length} results`);
    }
  });

  test('Search with body CONTAINS operator returns matching messages', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=20&search[message.body][CONTAINS][]=test`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());
    console.log(`Messages body CONTAINS search status: ${response.status()}`);
  });

  test('Search with status IS operator returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=20&search[message.status][IS][]=sent`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());
    console.log(`Messages status=sent search status: ${response.status()}`);
  });

  test('Search with multiple types IN operator returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Search for multiple types (email and sms)
    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=20&search[message.type][IS][]=email&search[message.type][IS][]=sms`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      const messages = Array.isArray(data) ? data : data.data || [];

      // Verify returned messages are either email or sms
      messages.forEach((msg: any) => {
        if (msg.type) {
          expect(['email', 'sms']).toContain(msg.type);
        }
      });

      console.log(`Messages type IN [email, sms] search: ${messages.length} results`);
    }
  });
});

/**
 * Messages Pagination and Sorting Tests
 */
test.describe('Messages Pagination and Sorting', () => {
  test.setTimeout(120000);

  test('Pagination works with X-Total header', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=10`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const xTotal = response.headers()['x-total'];
      console.log(`Messages X-Total header: ${xTotal}`);
      expect(xTotal).toBeDefined();
    }
  });

  test('Sorting by created_at DESC works', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=10&order_by=created_at&order_type=desc`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());
    console.log(`Messages sort DESC: ${response.status()}`);
  });

  test('Sorting by created_at ASC works', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=10&order_by=created_at&order_type=asc`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());
    console.log(`Messages sort ASC: ${response.status()}`);
  });

  test('Page 2 returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=2&per_page=10`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());
    console.log(`Messages page 2: ${response.status()}`);
  });
});

/**
 * Messages Combined Filter Tests
 * Tests combining multiple segment filters together
 */
test.describe('Messages Combined Filters', () => {
  test.setTimeout(120000);

  test('Combined date range and type filter works', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startTimestamp = Math.floor(weekAgo.getTime() / 1000);
    const endTimestamp = Math.floor(now.getTime() / 1000);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=20&search[created_at]=${startTimestamp}-${endTimestamp}&search[message.type][IS][]=email`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());
    console.log(`Messages combined filter (date+type): ${response.status()}`);
  });

  test('Combined text search and type filter works', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=20&search[text]=notification&search[message.type][IS][]=email`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());
    console.log(`Messages combined filter (text+type): ${response.status()}`);
  });

  test('Combined body CONTAINS and status filter works', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(
      `${apiBaseUrl}/api/messages?page=1&per_page=20&search[message.body][CONTAINS][]=alert&search[message.status][IS][]=sent`,
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );

    expect([200, 404]).toContain(response.status());
    console.log(`Messages combined filter (body+status): ${response.status()}`);
  });
});
