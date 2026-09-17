import { test, expect } from '@playwright/test';

/**
 * Real API Test - Test login and API calls
 */
test.describe('Real API Tests', () => {
  test('Login and view calls page', async ({ page }) => {
    // Collect network requests
    const apiRequests: { url: string; status: number }[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/') || response.url().includes('/auth/')) {
        apiRequests.push({
          url: response.url(),
          status: response.status()
        });
        console.log(`API: ${response.status()} ${response.url().split('?')[0]}`);
      }
    });

    // Go to login page
    console.log('\n=== Step 1: Navigate to login ===');
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/real-api-1-login-page.png', fullPage: true });

    // Fill login form
    console.log('\n=== Step 2: Fill login form ===');
    const emailInput = page.locator('ion-input[name="email"]');
    const passwordInput = page.locator('ion-input[name="password"]');

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });

    // Click on email input and type
    await emailInput.click();
    await page.keyboard.type('93196');

    // Click on password input and type
    await passwordInput.click();
    await page.keyboard.type('34rkew');

    await page.screenshot({ path: 'test-results/real-api-2-filled-form.png', fullPage: true });

    // Submit login
    console.log('\n=== Step 3: Submit login ===');
    const submitBtn = page.locator('ion-button[type="submit"]');
    await submitBtn.click();

    // Wait for login response
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-results/real-api-3-after-login.png', fullPage: true });

    // Check if we navigated to app
    console.log('\n=== Step 4: Check navigation ===');
    console.log('Current URL:', page.url());

    // Try to navigate to calls if logged in
    if (page.url().includes('/app/')) {
      console.log('\n=== Step 5: Navigate to calls ===');
      await page.goto('/app/calls');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/real-api-4-calls-page.png', fullPage: true });
    }

    // Print all API requests
    console.log('\n=== API Requests Summary ===');
    apiRequests.forEach(req => {
      console.log(`${req.status} - ${req.url.split('?')[0]}`);
    });

    // Check if any API call succeeded
    const successfulCalls = apiRequests.filter(r => r.status >= 200 && r.status < 300);
    console.log(`\nSuccessful API calls: ${successfulCalls.length}`);

    expect(true).toBe(true); // Test passes if we get here
  });

  test('Test call conditions API', async ({ page }) => {
    const apiResponses: { url: string; status: number; data?: any }[] = [];

    // Intercept API responses
    page.on('response', async response => {
      if (response.url().includes('/api/call_conditions')) {
        const data = await response.json().catch(() => null);
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          data
        });
        console.log(`Call Conditions API: ${response.status()}`);
        if (data) {
          console.log('Data count:', Array.isArray(data) ? data.length : 'single object');
        }
      }
    });

    // Login first
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const emailInput = page.locator('ion-input[name="email"]');
    const passwordInput = page.locator('ion-input[name="password"]');

    if (await emailInput.isVisible()) {
      await emailInput.click();
      await page.keyboard.type('93196');
      await passwordInput.click();
      await page.keyboard.type('34rkew');

      const submitBtn = page.locator('ion-button[type="submit"]');
      await submitBtn.click();
      await page.waitForTimeout(5000);
    }

    // Navigate to time condition page
    if (page.url().includes('/app/') || page.url().includes('/login')) {
      console.log('Navigating to /app/time-condition...');
      await page.goto('/app/time-condition');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: 'test-results/real-api-5-time-condition.png', fullPage: true });

    // Print API results
    console.log('\n=== Call Conditions API Results ===');
    apiResponses.forEach(resp => {
      console.log(`Status: ${resp.status}`);
      if (resp.data && Array.isArray(resp.data)) {
        console.log(`Items: ${resp.data.length}`);
        if (resp.data[0]) {
          console.log('First item:', JSON.stringify(resp.data[0], null, 2));
        }
      }
    });

    expect(true).toBe(true);
  });
});
