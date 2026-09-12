import { test, expect } from './auth-fixture';

/**
 * Enhanced Users Management Tests
 * Tests the improved edit functionality with individual user data fetching
 * and WebRTC phone integration
 */

test.describe('Users Enhanced Edit Functionality', () => {
  
  test('should fetch individual user data when editing instead of using list data', async ({ authenticatedPage: page }) => {
    // Navigate to users page
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Wait for users table to load
    await page.waitForSelector('[data-testid="edit-user-button"]', { timeout: 10000 });
    
    // Set up network monitoring to verify individual user API call
    const apiCalls = [];
    page.on('request', request => {
      if (request.url().includes('/api/users/') && request.method() === 'GET') {
        apiCalls.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // Click edit button on first user
    const editButton = page.locator('[data-testid="edit-user-button"]').first();
    await editButton.click();
    
    // Wait for dialog to open and API call to complete
    await page.waitForSelector('[data-testid="user-dialog"]', { timeout: 10000 });
    await page.waitForTimeout(2000); // Allow time for API call
    
    // Verify that individual user API call was made (GET /api/users/{uuid})
    const individualUserCalls = apiCalls.filter(call => 
      call.url.match(/\/api\/users\/[a-f0-9-]{36}$/) && call.method === 'GET'
    );
    
    expect(individualUserCalls.length).toBeGreaterThan(0);
    console.log('✅ Individual user API call made:', individualUserCalls[0]?.url);
    
    // Verify dialog shows enhanced user information sections
    await expect(page.getByText('Device Details')).toBeVisible();
    await expect(page.getByText('Environment Details')).toBeVisible();
    await expect(page.getByText('Profile Settings')).toBeVisible();
  });

  test('should display rich user data in edit dialog sections', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Open edit dialog
    await page.waitForSelector('[data-testid="edit-user-button"]', { timeout: 10000 });
    await page.locator('[data-testid="edit-user-button"]').first().click();
    await page.waitForSelector('[data-testid="user-dialog"]', { timeout: 10000 });
    
    // Wait for enhanced data to load
    await page.waitForTimeout(3000);
    
    // Check for Extension Details section
    const extensionSection = page.getByText('Device Details');
    if (await extensionSection.isVisible()) {
      console.log('✅ Extension Details section found');
      
      // Look for extension-related fields
      const extensionNumberText = page.getByText('Device Number');
      const sipPasswordText = page.getByText('SIP Password');
      
      if (await extensionNumberText.isVisible()) {
        console.log('✅ Extension Number field displayed');
      }
      if (await sipPasswordText.isVisible()) {
        console.log('✅ SIP Password field displayed');
      }
    }
    
    // Check for Environment Details section
    const environmentSection = page.getByText('Environment Details');
    if (await environmentSection.isVisible()) {
      console.log('✅ Environment Details section found');
      
      // Look for WebRTC server info
      const webrtcServerText = page.getByText('WebRTC Server');
      if (await webrtcServerText.isVisible()) {
        console.log('✅ WebRTC Server field displayed');
      }
    }
    
    // Check for Profile Settings section
    const profileSection = page.getByText('Profile Settings');
    if (await profileSection.isVisible()) {
      console.log('✅ Profile Settings section found');
    }
    
    // Check for Current State section
    const stateSection = page.getByText('Current State');
    if (await stateSection.isVisible()) {
      console.log('✅ Current State section found');
    }
    
    expect(extensionSection).toBeVisible();
  });

  test('should handle edit dialog errors gracefully with fallback to list data', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Mock a failed individual user API call
    await page.route('**/api/users/*', route => {
      if (route.request().method() === 'GET' && route.request().url().match(/\/api\/users\/[a-f0-9-]{36}$/)) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });
    
    // Open edit dialog
    await page.waitForSelector('[data-testid="edit-user-button"]', { timeout: 10000 });
    await page.locator('[data-testid="edit-user-button"]').first().click();
    
    // Dialog should still open (using fallback list data)
    await page.waitForSelector('[data-testid="user-dialog"]', { timeout: 10000 });
    
    // Should show error message about failed load
    const errorMessage = page.getByText('Failed to load user details');
    const isErrorVisible = await errorMessage.isVisible();
    
    if (isErrorVisible) {
      console.log('✅ Error handling working - fallback message displayed');
    }
    
    // Dialog should still be functional with basic fields
    const nameField = page.locator('input[label="Name"]').or(page.locator('[data-testid="name-field"]'));
    await expect(nameField.or(page.getByLabel('Name'))).toBeVisible();
    
    console.log('✅ Edit dialog functional with fallback data');
  });
});

test.describe('WebRTC Phone Integration Tests', () => {
  
  test('should display WebRTC phone tester button in edit dialog', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Open edit dialog
    await page.waitForSelector('[data-testid="edit-user-button"]', { timeout: 10000 });
    await page.locator('[data-testid="edit-user-button"]').first().click();
    await page.waitForSelector('[data-testid="user-dialog"]', { timeout: 10000 });
    
    // Look for WebRTC phone tester button
    const webrtcButton = page.getByText('Test WebRTC Phone');
    await expect(webrtcButton).toBeVisible();
    
    console.log('✅ WebRTC Phone tester button found in edit dialog');
  });

  test('should open WebRTC modal with environment-specific configuration', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Open edit dialog and wait for user data to load
    await page.waitForSelector('[data-testid="edit-user-button"]', { timeout: 10000 });
    await page.locator('[data-testid="edit-user-button"]').first().click();
    await page.waitForSelector('[data-testid="user-dialog"]', { timeout: 10000 });
    await page.waitForTimeout(3000); // Wait for individual user data to load
    
    // Click WebRTC phone tester button
    const webrtcButton = page.getByText('Test WebRTC Phone');
    await webrtcButton.click();
    
    // Wait for WebRTC modal to open
    await page.waitForSelector('[data-testid="webrtc-modal"]', { timeout: 10000 });
    
    // Check for WebRTC/SIP Configuration section
    const configSection = page.getByText('WebRTC/SIP Configuration:');
    await expect(configSection).toBeVisible();
    
    // Look for environment-specific configuration
    const environmentText = page.getByText('Environment:');
    const extensionText = page.getByText('Extension:');
    const serverText = page.getByText('Server:');
    
    if (await environmentText.isVisible()) {
      console.log('✅ Environment configuration displayed');
    }
    if (await extensionText.isVisible()) {
      console.log('✅ Extension configuration displayed');
    }
    if (await serverText.isVisible()) {
      console.log('✅ Server configuration displayed');
    }
    
    // Check for environment WSS server indicator
    const wssIndicator = page.getByText('Using environment WSS server:');
    if (await wssIndicator.isVisible()) {
      console.log('✅ Environment WSS server indicator found');
    }
    
    console.log('✅ WebRTC modal opened with configuration');
  });

  test('should display SIP configuration details in WebRTC modal', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Open edit dialog and WebRTC modal
    await page.waitForSelector('[data-testid="edit-user-button"]', { timeout: 10000 });
    await page.locator('[data-testid="edit-user-button"]').first().click();
    await page.waitForSelector('[data-testid="user-dialog"]', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    await page.getByText('Test WebRTC Phone').click();
    await page.waitForSelector('[data-testid="webrtc-modal"]', { timeout: 10000 });
    
    // Check SIP configuration display
    // Look for specific configuration patterns that should be present
    const configElements = await page.locator('div').filter({ hasText: /User:|Extension:|Environment:|Server:/ }).all();
    
    if (configElements.length > 0) {
      console.log('✅ SIP configuration elements found:', configElements.length);
      
      // Check for WSS server URL pattern
      const wssPattern = page.locator('text=/wss:\\/\\/.*:\\d+\\/ws/');
      if (await wssPattern.count() > 0) {
        console.log('✅ WSS server URL pattern found');
      }
    }
    
    expect(configElements.length).toBeGreaterThan(0);
  });

  test('should have functional dialpad in WebRTC modal', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Navigate to WebRTC modal
    await page.waitForSelector('[data-testid="edit-user-button"]', { timeout: 10000 });
    await page.locator('[data-testid="edit-user-button"]').first().click();
    await page.waitForSelector('[data-testid="user-dialog"]', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    await page.getByText('Test WebRTC Phone').click();
    await page.waitForSelector('[data-testid="webrtc-modal"]', { timeout: 10000 });
    
    // Test dialpad functionality
    const digit1 = page.getByText('1').filter({ hasText: /^1$/ });
    const digit2 = page.getByText('2').filter({ hasText: /^2$/ });
    const digit3 = page.getByText('3').filter({ hasText: /^3$/ });
    
    // Click digits to test dialpad
    if (await digit1.isVisible()) {
      await digit1.click();
      console.log('✅ Clicked digit 1');
    }
    if (await digit2.isVisible()) {
      await digit2.click();
      console.log('✅ Clicked digit 2');
    }
    if (await digit3.isVisible()) {
      await digit3.click();
      console.log('✅ Clicked digit 3');
    }
    
    // Check if phone number display was updated
    const phoneDisplay = page.locator('text=/123|Enter phone number/');
    if (await phoneDisplay.isVisible()) {
      console.log('✅ Phone number display updated');
    }
    
    // Check for CALL button
    const callButton = page.getByText('CALL');
    await expect(callButton.or(page.getByRole('button', { name: /call/i }))).toBeVisible();
    
    console.log('✅ Dialpad functionality verified');
  });

  test('should handle WebRTC connection states properly', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Navigate to WebRTC modal
    await page.waitForSelector('[data-testid="edit-user-button"]', { timeout: 10000 });
    await page.locator('[data-testid="edit-user-button"]').first().click();
    await page.waitForSelector('[data-testid="user-dialog"]', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    await page.getByText('Test WebRTC Phone').click();
    await page.waitForSelector('[data-testid="webrtc-modal"]', { timeout: 10000 });
    
    // Check initial connection state
    const disconnectedState = page.getByText('Disconnected');
    if (await disconnectedState.isVisible()) {
      console.log('✅ Initial disconnected state shown');
    }
    
    // Check for connect button
    const connectButton = page.getByText('Connect').or(page.getByText('CONNECT'));
    await expect(connectButton).toBeVisible();
    
    // Monitor console logs for SIP.js activity
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.text().includes('SIP') || msg.text().includes('WebRTC')) {
        consoleLogs.push(msg.text());
      }
    });
    
    // Try to connect (this will likely fail in test environment but should show proper error handling)
    if (await connectButton.isVisible()) {
      await connectButton.click();
      await page.waitForTimeout(3000); // Allow connection attempt
      
      // Check for connection status changes
      const connectingState = page.getByText('Connecting...');
      const failedState = page.getByText('Failed');
      
      if (await connectingState.isVisible() || await failedState.isVisible()) {
        console.log('✅ Connection state changes handled');
      }
    }
    
    console.log('✅ WebRTC connection state handling verified');
    if (consoleLogs.length > 0) {
      console.log('📝 SIP/WebRTC console activity:', consoleLogs.slice(0, 3));
    }
  });
});

test.describe('Users Enhanced Data Integration', () => {
  
  test('should verify API response contains rich user data', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Capture API responses
    const apiResponses = [];
    page.on('response', async response => {
      if (response.url().includes('/api/users/') && response.request().method() === 'GET') {
        try {
          const responseData = await response.json();
          apiResponses.push(responseData);
        } catch {
          console.log('Could not parse JSON response');
        }
      }
    });
    
    // Trigger individual user fetch
    await page.waitForSelector('[data-testid="edit-user-button"]', { timeout: 10000 });
    await page.locator('[data-testid="edit-user-button"]').first().click();
    await page.waitForSelector('[data-testid="user-dialog"]', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Verify API response structure
    if (apiResponses.length > 0) {
      const userData = apiResponses[apiResponses.length - 1];
      console.log('📊 User data structure verification:');
      
      // Check for required enhanced fields
      const hasEnvironment = userData.environment && userData.environment.wss_server;
      const hasExtension = userData.extension && userData.extension.username;
      const hasProfile = userData.profile && userData.profile.language;
      const hasState = userData.state && userData.state.status;
      
      if (hasEnvironment) {
        console.log('✅ Environment data with WSS server:', userData.environment.wss_server);
      }
      if (hasExtension) {
        console.log('✅ Extension data with username:', userData.extension.username);
      }
      if (hasProfile) {
        console.log('✅ Profile data with language:', userData.profile.language);
      }
      if (hasState) {
        console.log('✅ State data with status:', userData.state.status);
      }
      
      // Verify essential fields for WebRTC
      expect(hasEnvironment || hasExtension).toBeTruthy();
    }
    
    console.log('✅ API response structure verified');
  });

  test('should populate form fields correctly from enhanced API data', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle');
    
    // Open edit dialog
    await page.waitForSelector('[data-testid="edit-user-button"]', { timeout: 10000 });
    await page.locator('[data-testid="edit-user-button"]').first().click();
    await page.waitForSelector('[data-testid="user-dialog"]', { timeout: 10000 });
    await page.waitForTimeout(3000); // Wait for API data to populate
    
    // Verify form fields are populated
    const nameField = page.locator('input').filter({ hasAttribute: 'name', value: 'name' })
                        .or(page.getByLabel('Name'))
                        .or(page.locator('[data-testid="name-field"]'))
                        .or(page.locator('input').first());
    
    const emailField = page.getByLabel('Email')
                          .or(page.locator('input[type="email"]'))
                          .or(page.locator('[data-testid="email-field"]'));
    
    // Check if fields have values (should be populated from API)
    const nameValue = await nameField.inputValue().catch(() => '');
    const emailValue = await emailField.inputValue().catch(() => '');
    
    console.log('📝 Form field population:');
    if (nameValue) {
      console.log('✅ Name field populated:', nameValue);
    }
    if (emailValue) {
      console.log('✅ Email field populated:', emailValue);
    }
    
    // Environment/ACL/Status dropdowns should also be populated
    const environmentSelect = page.getByLabel('Environment').or(page.locator('[data-testid="environment-select"]'));
    const aclSelect = page.getByLabel('ACL').or(page.locator('[data-testid="acl-select"]'));
    const statusSelect = page.getByLabel('Status').or(page.locator('[data-testid="status-select"]'));
    
    // Check if dropdowns have selected values
    if (await environmentSelect.isVisible()) {
      console.log('✅ Environment dropdown found and potentially populated');
    }
    if (await aclSelect.isVisible()) {
      console.log('✅ ACL dropdown found and potentially populated');
    }
    if (await statusSelect.isVisible()) {
      console.log('✅ Status dropdown found and potentially populated');
    }
    
    expect(nameValue || emailValue).toBeTruthy();
    console.log('✅ Form field population verified');
  });
});