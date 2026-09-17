# Playwright E2E Tests

This directory contains end-to-end tests for the Ionic Conference App using [Playwright](https://playwright.dev/).

## Prerequisites

- Node.js and npm installed
- Application dependencies installed (`npm install`)
- Playwright browsers installed (automatically done during `npm install`)

## Running Tests

### Run all tests (headless mode)
```bash
npm run test:e2e
```

### Run tests with UI mode (recommended for development)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Debug tests
```bash
npm run test:e2e:debug
```

### Run tests on specific browser
```bash
npm run test:e2e:chromium
```

### View test report
```bash
npm run test:e2e:report
```

## Test Structure

```
e2e-playwright/
├── login.spec.ts          # Login functionality tests
├── helpers/
│   └── test-utils.ts      # Reusable test utilities and helpers
├── screenshots/           # Screenshots from failed tests
└── README.md             # This file
```

## Test Credentials

For testing purposes, use the following credentials:

- **Email**: `3753`
- **Password**: `Zn_wPkQ`

These credentials are stored in `e2e-playwright/helpers/test-utils.ts` as `VALID_TEST_CREDENTIALS`.

## Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/your-page');
    await page.waitForLoadState('networkidle');
  });

  test('should do something', async ({ page }) => {
    // Your test code here
  });
});
```

### Using Test Utilities

```typescript
import { test, expect } from '@playwright/test';
import {
  performLogin,
  fillAndSubmitLoginForm,
  mockSuccessfulLogin,
  VALID_TEST_CREDENTIALS
} from './helpers/test-utils';

test('should login successfully', async ({ page }) => {
  await performLogin(page);
  expect(page.url()).toContain('/app/calls');
});
```

## Test Coverage

Current test coverage includes:

### Login Tests (`login.spec.ts`)
- ✅ Display login page elements
- ✅ Form validation (empty fields)
- ✅ Enable/disable login button based on form validity
- ✅ Successful login with valid credentials
- ✅ Failed login with invalid credentials
- ✅ Correct API call format
- ✅ Form reset on navigation
- ✅ Menu disabled on login page
- ✅ Customer logo display
- ✅ Input security types
- ✅ Network error handling
- ✅ Login state persistence
- ✅ Accessibility (labels, keyboard navigation)

## Configuration

The Playwright configuration is defined in `playwright.config.ts` at the project root.

Key settings:
- **Base URL**: `http://localhost:8100`
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Auto-start dev server**: Yes (runs `npm start` before tests)
- **Screenshots**: On failure only
- **Videos**: Retained on failure
- **Traces**: On first retry

## Best Practices

1. **Use test utilities**: Reuse common functions from `helpers/test-utils.ts`
2. **Mock API calls**: Use `page.route()` to mock backend responses
3. **Wait for stability**: Always wait for `networkidle` after navigation
4. **Use semantic selectors**: Prefer data-testid, role, or text selectors over CSS
5. **Keep tests independent**: Each test should be able to run in isolation
6. **Clean up state**: Clear storage between tests when needed

## Debugging Tips

### View traces
```bash
npx playwright show-trace trace.zip
```

### Run specific test file
```bash
npx playwright test login.spec.ts
```

### Run specific test by name
```bash
npx playwright test -g "should successfully login"
```

### Run with verbose output
```bash
npx playwright test --reporter=list
```

### Generate code
```bash
npx playwright codegen http://localhost:8100
```

## CI/CD Integration

Tests are configured to run in CI environments with:
- Retry on failure (2 retries)
- Serial execution (1 worker)
- Fail build on `test.only`

## Troubleshooting

### Dev server not starting
- Ensure port 8100 is available
- Check if another instance of the app is running
- Manually start the dev server: `npm start`

### Browser not installed
```bash
npx playwright install chromium
```

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if API endpoints are accessible
- Verify network connectivity

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Ionic Testing Guide](https://ionicframework.com/docs/angular/testing)
