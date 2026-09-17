import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Ionic Conference App E2E tests
 * See https://playwright.dev/docs/test-configuration
 *
 * WebRTC Testing Notes:
 * - Use 'chromium-webrtc' project for phone tests
 * - Fake media devices are used for automated testing
 * - For real WebRTC testing, use headed mode with real microphone
 */
export default defineConfig({
  testDir: './e2e-playwright',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Run 4 parallel workers on CI for concurrent execution (like nimbis-admin) */
  workers: process.env.CI ? 4 : undefined,

  /* Reporter to use - JUnit for CI integration + HTML for artifacts */
  reporter: process.env.CI ? [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ] : 'html',

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:8100',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers and mobile devices */
  projects: [
    /* Desktop Chrome */
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--no-sandbox',
          ]
        }
      },
    },

    /* WebRTC-enabled Chromium for phone testing */
    {
      name: 'chromium-webrtc',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-file-access-from-files',
            '--disable-web-security',
          ]
        }
      },
    },

    /* Mobile Chrome - Android (Pixel 7) */
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        /* Touch events enabled by default */
      },
    },

    /* Mobile Safari - iPhone */
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 14'],
      },
    },

    /* Tablet - Galaxy Tab (Chromium-based for CI compatibility) */
    {
      name: 'tablet',
      use: {
        ...devices['Galaxy Tab S4'],
      },
    },

    /* Firefox - for cross-browser coverage */
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    /* WebKit/Safari Desktop */
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm start',
    url: 'http://localhost:8100',
    reuseExistingServer: true,
    timeout: 180 * 1000, // 3 minutes for Angular build
  },
});
