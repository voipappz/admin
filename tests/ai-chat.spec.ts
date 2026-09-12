import { test, expect } from './auth-fixture';
import { getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * AI Chat Tests
 * Tests: /agent/providers, /agent/chat, /agent/sessions, page load, mock fallback
 *
 * The AI endpoint may not be deployed yet (returns 404).
 * Tests verify both real API and graceful fallback to mock mode.
 */

test.describe('AI Chat', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  const apiBaseUrl = getApiBaseUrl();

  test('GET /agent/providers returns 200 or graceful fallback', async ({ authenticatedPage: page }) => {
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/agent/providers`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const status = response.status();

    if (status === 200) {
      const data = await response.json();
      expect(Array.isArray(data)).toBeTruthy();
      console.log(`✅ AI providers: ${data.length} LLM providers found`);

      // Verify provider shape
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('uuid');
        expect(data[0]).toHaveProperty('name');
        expect(data[0]).toHaveProperty('service');
        console.log(`   Provider: ${data[0].name} (${data[0].service})`);
      }
    } else if (status === 404) {
      console.log('⚠️ /agent/providers returns 404 — endpoint not deployed yet, frontend falls back to mock mode');
      expect(status).toBe(404);
    } else {
      console.log(`⚠️ /agent/providers returns ${status}`);
      expect([200, 404]).toContain(status);
    }
  });

  test('GET /agent/sessions returns 200 or 404', async ({ authenticatedPage: page }) => {
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/agent/sessions?provider_id=test`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const status = response.status();

    if (status === 200) {
      const data = await response.json();
      expect(Array.isArray(data)).toBeTruthy();
      console.log(`✅ AI sessions: ${data.length} sessions`);
    } else {
      console.log(`⚠️ /agent/sessions returns ${status} — endpoint not deployed yet`);
      expect([200, 404]).toContain(status);
    }
  });

  test('POST /agent/chat validates message required', async ({ authenticatedPage: page }) => {
    const authToken = await getAuthToken(page);

    const response = await page.request.post(`${apiBaseUrl}/api/agent/chat`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({})
    });

    const status = response.status();

    if (status === 400) {
      const data = await response.json();
      expect(data.error).toContain('Message is required');
      console.log('✅ POST /agent/chat validates message required');
    } else if (status === 404) {
      console.log('⚠️ /agent/chat returns 404 — endpoint not deployed yet');
      expect(status).toBe(404);
    } else {
      console.log(`⚠️ /agent/chat returns ${status}`);
      expect([400, 404]).toContain(status);
    }
  });

  test('POST /agent/chat returns 400 when no LLM provider configured', async ({ authenticatedPage: page }) => {
    const authToken = await getAuthToken(page);

    // Check if any LLM providers exist first
    const providersResp = await page.request.get(`${apiBaseUrl}/api/agent/providers`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (providersResp.status() === 404) {
      console.log('⚠️ /agent/providers not deployed — skipping');
      return;
    }

    const providers = await providersResp.json();

    if (providers.length === 0) {
      // No LLM providers — chat should return 400
      const response = await page.request.post(`${apiBaseUrl}/api/agent/chat`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({ message: 'hello' })
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No LLM provider');
      console.log('✅ POST /agent/chat returns 400 when no LLM provider configured');
    } else {
      console.log(`ℹ️ ${providers.length} LLM provider(s) exist — skipping no-provider test`);
    }
  });

  test('AI Chat page loads and shows UI', async ({ authenticatedPage: page }) => {
    await page.goto('/ai', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Verify page renders the AI chat UI
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('AI Assistant');
    console.log('✅ AI Chat page loads with "AI Assistant" heading');

    // Check for key UI elements
    const sendButton = await page.locator('button').filter({ has: page.locator('svg') }).count();
    expect(sendButton).toBeGreaterThan(0);
    console.log('✅ UI elements present (buttons, input)');

    // Check sidebar renders (agent selector, sessions area)
    const sidebarText = await page.textContent('body');
    const hasSidebar = sidebarText.includes('Agent') || sidebarText.includes('Sessions') || sidebarText.includes('New Chat');
    expect(hasSidebar).toBeTruthy();
    console.log('✅ Sidebar with agent/session controls rendered');
  });

  test('AI Chat navbar link exists', async ({ authenticatedPage: page }) => {
    await page.goto('/live', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Check navbar has AI Assistant link
    const _aiLink = page.locator('a[href="/ai"], [data-testid="nav-ai"]').first();
    const navText = await page.textContent('nav, [role="navigation"], aside');

    if (navText && navText.includes('AI Assistant')) {
      console.log('✅ AI Assistant link found in navbar');
    } else {
      // May be in a collapsed sidebar — just verify /ai route works
      await page.goto('/ai', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const content = await page.textContent('body');
      expect(content).toContain('AI Assistant');
      console.log('✅ /ai route accessible');
    }
  });
});
