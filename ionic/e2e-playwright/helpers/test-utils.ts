import { Page, expect } from '@playwright/test';

/**
 * Test utilities and helper functions for Playwright tests
 */

export const VALID_TEST_CREDENTIALS = {
  email: '93196',
  password: '34rkew'
};

/**
 * Mock a successful login API response
 */
export async function mockSuccessfulLogin(page: Page, credentials = VALID_TEST_CREDENTIALS) {
  await page.route('**/auth/user_login**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'mock-jwt-token-12345',
        user: {
          id: 1,
          email: credentials.email,
          username: 'testuser',
          uuid: 'test-uuid-123'
        }
      })
    });
  });
}

/**
 * Mock a failed login API response
 */
export async function mockFailedLogin(page: Page, statusCode = 401, errorMessage = 'Invalid credentials') {
  await page.route('**/auth/user_login**', async (route) => {
    await route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({
        error: errorMessage,
        message: 'Email or password is incorrect'
      })
    });
  });
}

/**
 * Fill and submit the login form
 */
export async function fillAndSubmitLoginForm(
  page: Page,
  email: string,
  password: string
) {
  const emailInput = page.locator('ion-input[name="email"] input');
  const passwordInput = page.locator('ion-input[name="password"] input');
  const loginButton = page.locator('ion-button[type="submit"]');

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await loginButton.click();
}

/**
 * Perform a complete login flow
 */
export async function performLogin(
  page: Page,
  credentials = VALID_TEST_CREDENTIALS,
  mockApi = true
) {
  // Navigate to login if not already there
  if (!page.url().includes('/login')) {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
  }

  // Mock API if requested
  if (mockApi) {
    await mockSuccessfulLogin(page, credentials);
  }

  // Fill and submit form
  await fillAndSubmitLoginForm(page, credentials.email, credentials.password);

  // Wait for navigation
  await page.waitForURL('**/app/calls**', { timeout: 5000 });
}

/**
 * Clear browser storage (localStorage, sessionStorage, cookies)
 * Note: localStorage/sessionStorage can only be accessed on actual pages,
 * not on about:blank. We navigate to the base URL first if needed.
 */
export async function clearStorage(page: Page) {
  try {
    // Navigate to a real page first if on about:blank to avoid SecurityError
    const currentUrl = page.url();
    if (currentUrl === 'about:blank' || !currentUrl.startsWith('http')) {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
    }

    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore storage access errors (can happen in some browser contexts)
        console.warn('Could not clear storage:', e);
      }
    });
  } catch (e) {
    // Ignore navigation/storage errors during cleanup
  }

  await page.context().clearCookies();
}

/**
 * Get the authentication token from localStorage
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    return localStorage.getItem('authce9d77b308c149d5992a80073637e4d5');
  });
}

/**
 * Set authentication token in localStorage
 */
export async function setAuthToken(page: Page, token: string) {
  await page.evaluate((tokenValue) => {
    localStorage.setItem('authce9d77b308c149d5992a80073637e4d5', tokenValue);
  }, token);
}

/**
 * Wait for Ionic components to be ready
 */
export async function waitForIonicReady(page: Page) {
  await page.waitForFunction(() => {
    return typeof window !== 'undefined' &&
           (window as any).Ionic &&
           (window as any).Ionic.config;
  });
}

/**
 * Check if user is logged in by verifying auth token exists
 */
export async function isUserLoggedIn(page: Page): Promise<boolean> {
  const token = await getAuthToken(page);
  return token !== null && token.length > 0;
}

/**
 * Navigate to a page and wait for it to load
 */
export async function navigateAndWait(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Get Ionic input value (handles shadow DOM)
 */
export async function getIonInputValue(page: Page, selector: string): Promise<string> {
  return await page.locator(`${selector} input`).inputValue();
}

/**
 * Fill Ionic input (handles shadow DOM)
 */
export async function fillIonInput(page: Page, selector: string, value: string) {
  await page.locator(`${selector} input`).fill(value);
}

/**
 * Click Ionic button
 */
export async function clickIonButton(page: Page, selector: string) {
  await page.locator(selector).click();
}

/**
 * Wait for navigation with timeout
 */
export async function waitForNavigation(page: Page, urlPattern: string, timeout = 5000) {
  await page.waitForURL(urlPattern, { timeout });
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `e2e-playwright/screenshots/${name}-${Date.now()}.png`,
    fullPage: true
  });
}
