import { test, expect } from './auth-fixture';

/**
 * Test: Live Screen Conditional API Fetching
 *
 * Verifies that:
 * 1. Only active tab makes API calls
 * 2. No WebSocket connections are made
 * 3. Tab switching triggers correct API endpoints
 */
test.describe('Live Screen - Conditional API Fetching', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Navigate to Live screen
    await page.goto('/live', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  });

  test('should only call agents API on initial load (Live Agents tab)', async ({ authenticatedPage: page }) => {
    // Clear network requests and start monitoring
    const apiRequests: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiRequests.push(url);
        console.log('📡 API Request:', url);
      }
    });

    // Wait a bit for any requests to complete
    await page.waitForTimeout(2000);

    // Verify ONLY agents endpoints are called (not calls or extensions)
    const agentRequests = apiRequests.filter(url => url.includes('/api/users?action=live'));
    const callRequests = apiRequests.filter(url => url.includes('/api/calls?action=live'));
    const extensionRequests = apiRequests.filter(url => url.includes('/api/devices?action=live'));

    console.log('\n📊 API Request Summary:');
    console.log(`   Live Agents: ${agentRequests.length} requests`);
    console.log(`   Live Calls: ${callRequests.length} requests`);
    console.log(`   SIP Registrations: ${extensionRequests.length} requests`);

    // On initial load (Live Agents tab active), should only call agents API
    expect(agentRequests.length).toBeGreaterThan(0); // Should have agents requests
    expect(callRequests.length).toBe(0); // Should NOT have calls requests
    expect(extensionRequests.length).toBe(0); // Should NOT have extensions requests

    console.log('✅ Initial load: Only agents API called');
  });

  test('should call calls API when switching to Live Calls tab', async ({ authenticatedPage: page }) => {
    const apiRequests: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiRequests.push(url);
        console.log('📡 API Request:', url);
      }
    });

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Clear tracked requests
    apiRequests.length = 0;

    // Click on Live Calls tab
    console.log('\n🔄 Switching to Live Calls tab...');
    await page.click('button:has-text("Live Calls")');

    // Wait for API requests
    await page.waitForTimeout(3000);

    // Verify ONLY calls endpoints are called
    const callRequests = apiRequests.filter(url => url.includes('/api/calls?action=live'));
    const agentRequests = apiRequests.filter(url => url.includes('/api/users?action=live'));
    const extensionRequests = apiRequests.filter(url => url.includes('/api/devices?action=live'));

    console.log('\n📊 API Request Summary After Tab Switch:');
    console.log(`   Live Calls: ${callRequests.length} requests`);
    console.log(`   Live Agents: ${agentRequests.length} requests`);
    console.log(`   SIP Registrations: ${extensionRequests.length} requests`);

    // After switching to Live Calls tab, should only call calls API
    expect(callRequests.length).toBeGreaterThan(0); // Should have calls requests
    expect(agentRequests.length).toBe(0); // Should NOT have new agents requests
    expect(extensionRequests.length).toBe(0); // Should NOT have extensions requests

    console.log('✅ Tab switch: Only calls API called');
  });

  test('should call extensions API when switching to SIP Registrations tab', async ({ authenticatedPage: page }) => {
    const apiRequests: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiRequests.push(url);
        console.log('📡 API Request:', url);
      }
    });

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Clear tracked requests
    apiRequests.length = 0;

    // Click on SIP Registrations tab
    console.log('\n🔄 Switching to SIP Registrations tab...');
    await page.click('button:has-text("SIP Registrations")');

    // Wait for API requests
    await page.waitForTimeout(3000);

    // Verify ONLY extensions endpoints are called
    const extensionRequests = apiRequests.filter(url => url.includes('/api/devices?action=live'));
    const agentRequests = apiRequests.filter(url => url.includes('/api/users?action=live'));
    const callRequests = apiRequests.filter(url => url.includes('/api/calls?action=live'));

    console.log('\n📊 API Request Summary After Tab Switch:');
    console.log(`   SIP Registrations: ${extensionRequests.length} requests`);
    console.log(`   Live Agents: ${agentRequests.length} requests`);
    console.log(`   Live Calls: ${callRequests.length} requests`);

    // After switching to SIP Registrations tab, should only call extensions API
    expect(extensionRequests.length).toBeGreaterThan(0); // Should have extensions requests
    expect(agentRequests.length).toBe(0); // Should NOT have new agents requests
    expect(callRequests.length).toBe(0); // Should NOT have calls requests

    console.log('✅ Tab switch: Only extensions API called');
  });

  test('should NOT create WebSocket connections', async ({ authenticatedPage: page }) => {
    const wsConnections: string[] = [];

    // Monitor WebSocket connections
    page.on('websocket', ws => {
      const url = ws.url();
      wsConnections.push(url);
      console.log('🔌 WebSocket Connection:', url);
    });

    // Wait for page to fully load and any potential WS connections
    await page.waitForTimeout(3000);

    console.log(`\n📊 WebSocket Connections: ${wsConnections.length}`);

    // Should have NO WebSocket connections
    expect(wsConnections.length).toBe(0);

    console.log('✅ No WebSocket connections created');
  });

  test('should fetch correct endpoints for each tab', async ({ authenticatedPage: page }) => {
    const apiRequests: { tab: string; url: string }[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiRequests.push({ tab: 'initial', url });
      }
    });

    // Wait for initial load (Live Agents tab)
    await page.waitForTimeout(2000);

    // Switch to Live Calls tab
    console.log('\n🔄 Testing all tabs...');
    apiRequests.length = 0;
    await page.click('button:has-text("Live Calls")');
    await page.waitForTimeout(2000);

    const callsTabRequests = apiRequests.filter(r => r.url.includes('/api/calls?action=live'));

    // Switch to SIP Registrations tab
    apiRequests.length = 0;
    await page.click('button:has-text("SIP Registrations")');
    await page.waitForTimeout(2000);

    const extensionsTabRequests = apiRequests.filter(r => r.url.includes('/api/devices?action=live'));

    // Switch back to Live Agents tab
    apiRequests.length = 0;
    await page.click('button:has-text("Live Agents")');
    await page.waitForTimeout(2000);

    const agentsTabRequests = apiRequests.filter(r => r.url.includes('/api/users?action=live'));

    console.log('\n📊 Full Tab Navigation Summary:');
    console.log(`   Live Calls tab → ${callsTabRequests.length} calls requests`);
    console.log(`   SIP Registrations tab → ${extensionsTabRequests.length} extensions requests`);
    console.log(`   Live Agents tab → ${agentsTabRequests.length} agents requests`);

    // Each tab should make at least one request to its corresponding endpoint
    expect(callsTabRequests.length).toBeGreaterThan(0);
    expect(extensionsTabRequests.length).toBeGreaterThan(0);
    expect(agentsTabRequests.length).toBeGreaterThan(0);

    console.log('✅ All tabs fetch correct endpoints');
  });

  test('should display data tables on each tab', async ({ authenticatedPage: page }) => {
    // Live Agents tab - check for DataGrid
    const agentsTable = await page.locator('.MuiDataGrid-root').first();
    await expect(agentsTable).toBeVisible({ timeout: 5000 });
    console.log('✅ Live Agents: DataGrid visible');

    // Live Calls tab
    await page.click('button:has-text("Live Calls")');
    await page.waitForTimeout(2000);
    const callsTable = await page.locator('.MuiDataGrid-root').first();
    await expect(callsTable).toBeVisible({ timeout: 5000 });
    console.log('✅ Live Calls: DataGrid visible');

    // SIP Registrations tab
    await page.click('button:has-text("SIP Registrations")');
    await page.waitForTimeout(2000);
    const regsTable = await page.locator('.MuiDataGrid-root').first();
    await expect(regsTable).toBeVisible({ timeout: 5000 });
    console.log('✅ SIP Registrations: DataGrid visible');
  });
});
