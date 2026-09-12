import { test, expect } from '@playwright/test';

/**
 * Login OTP Flow Tests
 * Tests the two-step login UI: email+password → OTP verification
 * Uses route interception to mock API responses (can't read real OTP emails)
 */
test.describe('Login OTP Flow', () => {
  // Give extra time — Vite dev server can be slow to compile
  test.setTimeout(60000);
  test.use({ navigationTimeout: 60000 });

  test.beforeEach(async ({ page }) => {
    // Mark onboarding tour as completed before page loads (prevents overlay blocking form)
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('completedTours', JSON.stringify({ 'first-login': true }));
    });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    // Wait for React to render the login form
    await page.waitForSelector('[data-testid="login-form"]', { timeout: 15000 });
  });

  test('should render login form with email and password fields', async ({ page }) => {
    // Verify form elements exist
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-password-link"]')).toBeVisible();

    // OTP form should NOT be visible
    await expect(page.locator('[data-testid="otp-form"]')).not.toBeVisible();
  });

  test('should show OTP form after successful credential submission', async ({ page }) => {
    // Mock the login API to return OTP response
    await page.route('**/auth/login**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          otp_sent: true,
          temp_token: 'test-temp-token-abc123'
        })
      });
    });

    // Fill in credentials
    await page.fill('[data-testid="email-input"] input', 'test@example.com');
    await page.fill('[data-testid="password-input"] input', 'TestPassword123');

    // Submit login
    await page.click('[data-testid="login-button"]');

    // OTP form should appear
    await expect(page.locator('[data-testid="otp-form"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="otp-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="otp-submit-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="otp-back-button"]')).toBeVisible();

    // Login form should be hidden
    await expect(page.locator('[data-testid="login-form"]')).not.toBeVisible();

    // Verify button should be disabled (no code entered yet)
    await expect(page.locator('[data-testid="otp-submit-button"]')).toBeDisabled();
  });

  test('should show email in OTP form description', async ({ page }) => {
    await page.route('**/auth/login**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ otp_sent: true, temp_token: 'test-token' })
      });
    });

    await page.fill('[data-testid="email-input"] input', 'user@company.com');
    await page.fill('[data-testid="password-input"] input', 'password123');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="otp-form"]')).toBeVisible({ timeout: 5000 });
    // Verify the email is shown in the OTP description
    await expect(page.locator('text=user@company.com')).toBeVisible();
  });

  test('should only allow 6 digits in OTP input', async ({ page }) => {
    await page.route('**/auth/login**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ otp_sent: true, temp_token: 'test-token' })
      });
    });

    await page.fill('[data-testid="email-input"] input', 'test@example.com');
    await page.fill('[data-testid="password-input"] input', 'password');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="otp-form"]')).toBeVisible({ timeout: 5000 });

    // Type more than 6 digits - should be truncated
    await page.fill('[data-testid="otp-input"] input', '12345678');
    const value = await page.locator('[data-testid="otp-input"] input').inputValue();
    expect(value.length).toBeLessThanOrEqual(6);

    // Verify button should be enabled with 6 digits
    await page.fill('[data-testid="otp-input"] input', '482916');
    await expect(page.locator('[data-testid="otp-submit-button"]')).toBeEnabled();
  });

  test('should navigate back to login form from OTP form', async ({ page }) => {
    await page.route('**/auth/login**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ otp_sent: true, temp_token: 'test-token' })
      });
    });

    await page.fill('[data-testid="email-input"] input', 'test@example.com');
    await page.fill('[data-testid="password-input"] input', 'password');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="otp-form"]')).toBeVisible({ timeout: 5000 });

    // Click back button
    await page.click('[data-testid="otp-back-button"]');

    // Should be back on login form
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="otp-form"]')).not.toBeVisible();
  });

  test('should complete full OTP verification and redirect', async ({ page }) => {
    // Mock login API
    await page.route('**/auth/login**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ otp_sent: true, temp_token: 'test-temp-token' })
      });
    });

    // Mock OTP verify API - return JWT tokens
    const fakeJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJ1dWlkIjoiMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiY3VzdG9tZXIiOnsidXVpZCI6ImN1c3QxIiwibmFtZSI6IlRlc3QifSwibWV0YSI6e30sImV4cCI6OTk5OTk5OTk5OX0.signature';
    await page.route('**/auth/otp/verify**', async (route) => {
      // The app sends temp_token + code as QUERY params (not body), so check both.
      const url = route.request().url();
      const postData = route.request().postData() || '';
      const hasParams =
        (url.includes('temp_token') && url.includes('code')) ||
        (postData.includes('temp_token') && postData.includes('code'));
      if (hasParams) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access: fakeJwt,
            refresh: 'refresh-token',
            csrf: 'csrf-token'
          })
        });
      } else {
        await route.fulfill({
          status: 406,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Missing parameters' })
        });
      }
    });

    // Step 1: Enter credentials
    await page.fill('[data-testid="email-input"] input', 'test@example.com');
    await page.fill('[data-testid="password-input"] input', 'password');
    await page.click('[data-testid="login-button"]');

    // Step 2: Enter OTP
    await expect(page.locator('[data-testid="otp-form"]')).toBeVisible({ timeout: 5000 });
    await page.fill('[data-testid="otp-input"] input', '482916');
    await page.click('[data-testid="otp-submit-button"]');

    // Should redirect away from login (to /live)
    await page.waitForURL('**/live**', { timeout: 10000 });
  });

  test('should show error on invalid credentials (401)', async ({ page }) => {
    await page.route('**/auth/login**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid email or password' })
      });
    });

    await page.fill('[data-testid="email-input"] input', 'wrong@example.com');
    await page.fill('[data-testid="password-input"] input', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    // Error should appear, should stay on login form
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="otp-form"]')).not.toBeVisible();
  });

  test('should show error on account locked (403)', async ({ page }) => {
    await page.route('**/auth/login**', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Account locked due to too many failed attempts. Try again later.' })
      });
    });

    await page.fill('[data-testid="email-input"] input', 'locked@example.com');
    await page.fill('[data-testid="password-input"] input', 'password');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=locked')).toBeVisible();
  });

  test('should show error on invalid OTP code', async ({ page }) => {
    await page.route('**/auth/login**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ otp_sent: true, temp_token: 'test-token' })
      });
    });

    await page.route('**/auth/otp/verify**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid OTP code' })
      });
    });

    await page.fill('[data-testid="email-input"] input', 'test@example.com');
    await page.fill('[data-testid="password-input"] input', 'password');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="otp-form"]')).toBeVisible({ timeout: 5000 });
    await page.fill('[data-testid="otp-input"] input', '000000');
    await page.click('[data-testid="otp-submit-button"]');

    // Error should show, should stay on OTP form
    await expect(page.locator('[data-testid="otp-error-message"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="otp-form"]')).toBeVisible();
  });

  test('should show error on expired OTP', async ({ page }) => {
    await page.route('**/auth/login**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ otp_sent: true, temp_token: 'expired-token' })
      });
    });

    await page.route('**/auth/otp/verify**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid or expired OTP' })
      });
    });

    await page.fill('[data-testid="email-input"] input', 'test@example.com');
    await page.fill('[data-testid="password-input"] input', 'password');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="otp-form"]')).toBeVisible({ timeout: 5000 });
    await page.fill('[data-testid="otp-input"] input', '123456');
    await page.click('[data-testid="otp-submit-button"]');

    await expect(page.locator('[data-testid="otp-error-message"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=expired')).toBeVisible();
  });

  test('should navigate to forgot password form and back', async ({ page }) => {
    // Click forgot password
    await page.click('[data-testid="forgot-password-link"]');

    // Forgot form should appear
    await expect(page.locator('[data-testid="forgot-form"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="forgot-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="back-button"]')).toBeVisible();

    // Login form should be hidden
    await expect(page.locator('[data-testid="login-form"]')).not.toBeVisible();

    // Click back
    await page.click('[data-testid="back-button"]');

    // Login form should reappear
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-form"]')).not.toBeVisible();
  });

  test('should disable login button when fields are empty', async ({ page }) => {
    // Button should be disabled with empty fields
    await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();

    // Fill only email
    await page.fill('[data-testid="email-input"] input', 'test@example.com');
    await expect(page.locator('[data-testid="login-button"]')).toBeDisabled();

    // Fill password too
    await page.fill('[data-testid="password-input"] input', 'password');
    await expect(page.locator('[data-testid="login-button"]')).toBeEnabled();
  });
});

/**
 * Reset Password OTP Security Tests
 *
 * Validates that password reset is protected by a 3-step OTP flow:
 *   Step 1: POST /auth/forget_password (email) → temp_token
 *   Step 2: POST /auth/forget_password/verify (temp_token + OTP) → reset_token
 *   Step 3: POST /auth/forget_password/reset (reset_token + new_password) → success
 *
 * A bot cannot change a password without access to the OTP sent to the user's email.
 */
test.describe('Reset Password OTP Security', () => {
  test.setTimeout(60000);
  test.use({ navigationTimeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('completedTours', JSON.stringify({ 'first-login': true }));
    });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="login-form"]', { timeout: 15000 });
    // Navigate to forgot password form
    await page.click('[data-testid="forgot-password-link"]');
    await expect(page.locator('[data-testid="forgot-form"]')).toBeVisible({ timeout: 5000 });
  });

  // --- Step 1: Email submission ---

  test('Step 1: should send email and transition to OTP form', async ({ page }) => {
    await page.route('**/auth/forget_password', async (route) => {
      if (route.request().method() === 'POST') {
        const url = route.request().url();
        expect(url).toContain('email=');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token-xyz' })
        });
      } else {
        await route.continue();
      }
    });

    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');

    // Should transition to OTP entry (step 2)
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="forgot-otp-input"]')).toBeVisible();
    // Should show the email in the description
    await expect(page.locator('text=user@example.com')).toBeVisible();
  });

  test('Step 1: should disable submit button when email is empty', async ({ page }) => {
    await expect(page.locator('[data-testid="forgot-submit-button"]')).toBeDisabled();
  });

  test('Step 1: should show error when API rejects email', async ({ page }) => {
    await page.route('**/auth/forget_password', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email not found' })
      });
    });

    await page.fill('[data-testid="forgot-email-input"] input', 'unknown@example.com');
    await page.click('[data-testid="forgot-submit-button"]');

    await expect(page.locator('[data-testid="forgot-error-message"]')).toBeVisible({ timeout: 5000 });
    // Should stay on step 1, NOT advance to OTP
    await expect(page.locator('[data-testid="forgot-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-otp-form"]')).not.toBeVisible();
  });

  // --- Step 2: OTP verification ---

  test('Step 2: should verify OTP and transition to password form', async ({ page }) => {
    // Mock step 1
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });

    // Mock step 2
    await page.route('**/auth/forget_password/verify**', async (route) => {
      const url = route.request().url();
      expect(url).toContain('temp_token=');
      expect(url).toContain('code=');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'reset-token-abc' })
      });
    });

    // Step 1: submit email
    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });

    // Step 2: enter OTP
    await page.fill('[data-testid="forgot-otp-input"] input', '123456');
    await page.click('[data-testid="forgot-otp-submit-button"]');

    // Should transition to new password form (step 3)
    await expect(page.locator('[data-testid="forgot-reset-form"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="new-password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="confirm-password-input"]')).toBeVisible();
  });

  test('Step 2: should disable verify button when OTP is incomplete', async ({ page }) => {
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });

    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });

    // Button disabled with no code
    await expect(page.locator('[data-testid="forgot-otp-submit-button"]')).toBeDisabled();

    // Button disabled with partial code
    await page.fill('[data-testid="forgot-otp-input"] input', '123');
    await expect(page.locator('[data-testid="forgot-otp-submit-button"]')).toBeDisabled();

    // Button enabled with full 6 digits
    await page.fill('[data-testid="forgot-otp-input"] input', '123456');
    await expect(page.locator('[data-testid="forgot-otp-submit-button"]')).toBeEnabled();
  });

  test('Step 2: should only allow 6 digits in OTP field', async ({ page }) => {
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });

    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });

    // Try entering letters and excess digits
    await page.fill('[data-testid="forgot-otp-input"] input', 'abc12345678');
    const value = await page.locator('[data-testid="forgot-otp-input"] input').inputValue();
    expect(value).toMatch(/^\d{0,6}$/);
    expect(value.length).toBeLessThanOrEqual(6);
  });

  test('Step 2: should show error on invalid OTP', async ({ page }) => {
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/auth/forget_password/verify**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid or expired code' })
      });
    });

    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });

    await page.fill('[data-testid="forgot-otp-input"] input', '000000');
    await page.click('[data-testid="forgot-otp-submit-button"]');

    // Should show error and stay on OTP form — NOT advance to password reset
    await expect(page.locator('[data-testid="forgot-otp-error"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-reset-form"]')).not.toBeVisible();
  });

  test('Step 2: should navigate back to login from OTP step', async ({ page }) => {
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });

    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });

    await page.click('[data-testid="forgot-otp-back-button"]');

    // Should return to login form, not forgot form
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-otp-form"]')).not.toBeVisible();
  });

  // --- Step 3: Password reset ---

  test('Step 3: should complete full reset flow', async ({ page }) => {
    // Mock all 3 steps
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/auth/forget_password/verify**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'reset-token-abc' })
      });
    });

    await page.route('**/auth/forget_password/reset**', async (route) => {
      const url = route.request().url();
      expect(url).toContain('reset_token=');
      expect(url).toContain('new_password=');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Step 1
    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });

    // Step 2
    await page.fill('[data-testid="forgot-otp-input"] input', '123456');
    await page.click('[data-testid="forgot-otp-submit-button"]');
    await expect(page.locator('[data-testid="forgot-reset-form"]')).toBeVisible({ timeout: 5000 });

    // Step 3
    await page.fill('[data-testid="new-password-input"] input', 'NewSecureP@ss1');
    await page.fill('[data-testid="confirm-password-input"] input', 'NewSecureP@ss1');
    await page.click('[data-testid="forgot-reset-submit-button"]');

    // Should show success message
    await expect(page.locator('text=Password reset successfully')).toBeVisible({ timeout: 5000 });
  });

  test('Step 3: should disable reset button when password too short', async ({ page }) => {
    // Get to step 3
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });
    await page.route('**/auth/forget_password/verify**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'reset-token-abc' })
      });
    });

    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });
    await page.fill('[data-testid="forgot-otp-input"] input', '123456');
    await page.click('[data-testid="forgot-otp-submit-button"]');
    await expect(page.locator('[data-testid="forgot-reset-form"]')).toBeVisible({ timeout: 5000 });

    // Password too short (< 8 chars)
    await page.fill('[data-testid="new-password-input"] input', 'short');
    await page.fill('[data-testid="confirm-password-input"] input', 'short');
    await expect(page.locator('[data-testid="forgot-reset-submit-button"]')).toBeDisabled();

    // Password long enough
    await page.fill('[data-testid="new-password-input"] input', 'longenough123');
    await page.fill('[data-testid="confirm-password-input"] input', 'longenough123');
    await expect(page.locator('[data-testid="forgot-reset-submit-button"]')).toBeEnabled();
  });

  test('Step 3: should disable reset button when passwords do not match', async ({ page }) => {
    // Get to step 3
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });
    await page.route('**/auth/forget_password/verify**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'reset-token-abc' })
      });
    });

    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });
    await page.fill('[data-testid="forgot-otp-input"] input', '123456');
    await page.click('[data-testid="forgot-otp-submit-button"]');
    await expect(page.locator('[data-testid="forgot-reset-form"]')).toBeVisible({ timeout: 5000 });

    await page.fill('[data-testid="new-password-input"] input', 'password123');
    await page.fill('[data-testid="confirm-password-input"] input', 'differentpass');

    await expect(page.locator('[data-testid="forgot-reset-submit-button"]')).toBeDisabled();
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
  });

  test('Step 3: should show error when reset API fails', async ({ page }) => {
    // Get to step 3
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });
    await page.route('**/auth/forget_password/verify**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'reset-token-abc' })
      });
    });
    await page.route('**/auth/forget_password/reset**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Reset token expired' })
      });
    });

    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });
    await page.fill('[data-testid="forgot-otp-input"] input', '123456');
    await page.click('[data-testid="forgot-otp-submit-button"]');
    await expect(page.locator('[data-testid="forgot-reset-form"]')).toBeVisible({ timeout: 5000 });

    await page.fill('[data-testid="new-password-input"] input', 'NewPassword1');
    await page.fill('[data-testid="confirm-password-input"] input', 'NewPassword1');
    await page.click('[data-testid="forgot-reset-submit-button"]');

    // Should show error and stay on reset form
    await expect(page.locator('[data-testid="forgot-reset-error"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="forgot-reset-form"]')).toBeVisible();
  });

  // --- Security: Cannot skip OTP step ---

  test('Security: cannot reach password form without valid OTP', async ({ page }) => {
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/auth/forget_password/verify**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid code' })
      });
    });

    // Step 1: submit email
    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });

    // Step 2: wrong OTP
    await page.fill('[data-testid="forgot-otp-input"] input', '999999');
    await page.click('[data-testid="forgot-otp-submit-button"]');

    // Must NOT advance to password reset form
    await expect(page.locator('[data-testid="forgot-otp-error"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="forgot-reset-form"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="new-password-input"]')).not.toBeVisible();
  });

  test('Security: reset API requires reset_token from OTP step', async ({ page }) => {
    let capturedResetUrl = '';

    // Get to step 3 with mocks
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });
    await page.route('**/auth/forget_password/verify**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'otp-verified-reset-token' })
      });
    });
    await page.route('**/auth/forget_password/reset**', async (route) => {
      capturedResetUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Walk through all 3 steps
    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });

    await page.fill('[data-testid="forgot-otp-input"] input', '123456');
    await page.click('[data-testid="forgot-otp-submit-button"]');
    await expect(page.locator('[data-testid="forgot-reset-form"]')).toBeVisible({ timeout: 5000 });

    await page.fill('[data-testid="new-password-input"] input', 'SecurePass99');
    await page.fill('[data-testid="confirm-password-input"] input', 'SecurePass99');
    await page.click('[data-testid="forgot-reset-submit-button"]');

    await expect(page.locator('text=Password reset successfully')).toBeVisible({ timeout: 5000 });

    // Verify the reset_token from OTP verification was sent to the reset endpoint
    expect(capturedResetUrl).toContain('reset_token=otp-verified-reset-token');
  });

  test('Security: auto-redirect to login after successful reset', async ({ page }) => {
    // Get through all 3 steps
    await page.route('**/auth/forget_password', async (route) => {
      if (!route.request().url().includes('/verify') && !route.request().url().includes('/reset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ temp_token: 'forgot-temp-token' })
        });
      } else {
        await route.continue();
      }
    });
    await page.route('**/auth/forget_password/verify**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reset_token: 'reset-token' })
      });
    });
    await page.route('**/auth/forget_password/reset**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.fill('[data-testid="forgot-email-input"] input', 'user@example.com');
    await page.click('[data-testid="forgot-submit-button"]');
    await expect(page.locator('[data-testid="forgot-otp-form"]')).toBeVisible({ timeout: 5000 });
    await page.fill('[data-testid="forgot-otp-input"] input', '123456');
    await page.click('[data-testid="forgot-otp-submit-button"]');
    await expect(page.locator('[data-testid="forgot-reset-form"]')).toBeVisible({ timeout: 5000 });

    await page.fill('[data-testid="new-password-input"] input', 'NewPassword1');
    await page.fill('[data-testid="confirm-password-input"] input', 'NewPassword1');
    await page.click('[data-testid="forgot-reset-submit-button"]');

    // After success, should auto-redirect back to login form (3s timeout in code)
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible({ timeout: 5000 });
    // Forgot/reset forms should be gone
    await expect(page.locator('[data-testid="forgot-reset-form"]')).not.toBeVisible();
  });
});
