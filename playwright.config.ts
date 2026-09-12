import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load environment variables from .env file (only if not already loaded)
if (!process.env.VITE_API_BASE_URL && !process.env.CI) {
  dotenv.config();
}

/**
 * Playwright Configuration for VoIP Admin Testing
 * Modern, fast, and reliable browser automation
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true, // Run tests in parallel for faster CI
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1, // Retry flaky tests (UI timing + intermittent cloud 5xx) locally too
  workers: process.env.CI ? 1 : 2, // Single worker in CI to avoid concurrent login issues
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['list']
  ],

  // Global timeout for entire test including hooks
  timeout: process.env.CI ? 90000 : 30000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: process.env.CI ? 30000 : 15000,
    navigationTimeout: process.env.CI ? 60000 : 30000,
  },

  // Increase expect timeout in CI
  expect: {
    timeout: process.env.CI ? 10000 : 5000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Vite server is handled by Makefile / CircleCI */
});