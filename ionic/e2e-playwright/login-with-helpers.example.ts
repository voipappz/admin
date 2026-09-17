import { test, expect } from '@playwright/test';
import {
  performLogin,
  fillAndSubmitLoginForm,
  mockSuccessfulLogin,
  mockFailedLogin,
  getAuthToken,
  clearStorage,
  navigateAndWait,
  VALID_TEST_CREDENTIALS
} from './helpers/test-utils';

/**
 * Example tests demonstrating the use of test helper utilities
 * These tests show how to reuse common functions for cleaner test code
 */

test.describe('Login with Helper Functions - Examples', () => {

  test.beforeEach(async ({ page }) => {
    // Clear storage before each test for clean state
    await navigateAndWait(page, '/login');
    await clearStorage(page);
  });

  test('example: login using performLogin helper', async ({ page }) => {
    // This helper performs the complete login flow
    await performLogin(page);

    // Verify we're on the calls page
    expect(page.url()).toContain('/app/calls');

    // Verify auth token was set
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
  });

  test('example: login with custom credentials using helpers', async ({ page }) => {
    // Mock successful login
    await mockSuccessfulLogin(page, { email: 'custom@test.com', password: 'test123' });

    // Fill and submit form
    await fillAndSubmitLoginForm(page, 'custom@test.com', 'test123');

    // Wait for navigation
    await page.waitForURL('**/app/calls**', { timeout: 5000 });

    expect(page.url()).toContain('/app/calls');
  });

  test('example: test failed login using helper', async ({ page }) => {
    // Mock failed login response
    await mockFailedLogin(page, 401, 'Invalid credentials');

    // Attempt login
    await fillAndSubmitLoginForm(page, 'wrong@email.com', 'wrongpass');

    // Wait a bit for error handling
    await page.waitForTimeout(1000);

    // Should still be on login page
    expect(page.url()).toContain('/login');

    // No auth token should be set
    const token = await getAuthToken(page);
    expect(token).toBeFalsy();
  });

  test('example: test with storage cleared', async ({ page }) => {
    // First login
    await performLogin(page);
    let token = await getAuthToken(page);
    expect(token).toBeTruthy();

    // Clear storage
    await clearStorage(page);

    // Token should be gone
    token = await getAuthToken(page);
    expect(token).toBeFalsy();
  });

  test('example: navigate and verify login state', async ({ page }) => {
    // Perform login
    await performLogin(page);

    // Navigate to different pages
    await navigateAndWait(page, '/app/calls');
    expect(page.url()).toContain('/app/calls');

    // Auth token should persist
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();
  });

  test('example: mock API with custom response', async ({ page }) => {
    await navigateAndWait(page, '/login');

    // Custom mock with specific user data
    await page.route('**/auth/user_login**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'custom-token-xyz',
          user: {
            id: 999,
            email: VALID_TEST_CREDENTIALS.email,
            username: 'customuser',
            uuid: 'custom-uuid-456',
            role: 'admin'
          }
        })
      });
    });

    await fillAndSubmitLoginForm(
      page,
      VALID_TEST_CREDENTIALS.email,
      VALID_TEST_CREDENTIALS.password
    );

    await page.waitForURL('**/app/calls**', { timeout: 5000 });

    // Verify custom token was set
    const token = await getAuthToken(page);
    expect(token).toBe('custom-token-xyz');
  });

  test('example: test multiple login attempts', async ({ page }) => {
    await navigateAndWait(page, '/login');

    // First attempt - fail
    await mockFailedLogin(page, 401);
    await fillAndSubmitLoginForm(page, 'wrong@email.com', 'wrong');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login');

    // Second attempt - success
    await mockSuccessfulLogin(page);
    await fillAndSubmitLoginForm(
      page,
      VALID_TEST_CREDENTIALS.email,
      VALID_TEST_CREDENTIALS.password
    );

    await page.waitForURL('**/app/calls**', { timeout: 5000 });
    expect(page.url()).toContain('/app/calls');
  });

});

/**
 * Note: This is an example file demonstrating helper usage.
 * You can copy patterns from here to write your own tests.
 *
 * To run this file specifically:
 * npx playwright test login-with-helpers.example.ts
 */
