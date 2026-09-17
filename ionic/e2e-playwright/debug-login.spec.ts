import { test, expect } from '@playwright/test';

/**
 * Debug test to inspect the login page
 */
test('Debug: Inspect login page', async ({ page }) => {
  // Collect console messages
  const consoleMessages: string[] = [];
  const errors: string[] = [];

  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  // Go to login page
  console.log('Navigating to /login...');
  await page.goto('/login');

  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-login.png', fullPage: true });

  // Get page content
  const content = await page.content();
  console.log('\n========== PAGE HTML (first 2000 chars) ==========');
  console.log(content.substring(0, 2000));
  console.log('==================================================\n');

  // Check for errors
  console.log('\n========== CONSOLE ERRORS ==========');
  errors.forEach(e => console.log('ERROR:', e));
  consoleMessages.filter(m => m.includes('error') || m.includes('Error')).forEach(m => console.log(m));
  console.log('=====================================\n');

  // List all ion-input elements
  const ionInputs = await page.locator('ion-input').all();
  console.log(`\nFound ${ionInputs.length} ion-input elements`);

  for (let i = 0; i < ionInputs.length; i++) {
    const attrs = await ionInputs[i].evaluate(el => {
      return {
        name: el.getAttribute('name'),
        type: el.getAttribute('type'),
        id: el.getAttribute('id'),
        class: el.getAttribute('class'),
        innerHTML: el.innerHTML.substring(0, 200)
      };
    });
    console.log(`ion-input[${i}]:`, JSON.stringify(attrs, null, 2));
  }

  // Try to find the actual input fields
  const nativeInputs = await page.locator('input').all();
  console.log(`\nFound ${nativeInputs.length} native input elements`);

  for (let i = 0; i < nativeInputs.length; i++) {
    const attrs = await nativeInputs[i].evaluate(el => {
      return {
        name: el.getAttribute('name'),
        type: el.getAttribute('type'),
        id: el.getAttribute('id'),
        class: el.getAttribute('class'),
        placeholder: el.getAttribute('placeholder')
      };
    });
    console.log(`input[${i}]:`, JSON.stringify(attrs, null, 2));
  }

  // Check if app-root has content
  const appRoot = page.locator('app-root');
  const appRootContent = await appRoot.innerHTML();
  console.log('\napp-root content length:', appRootContent.length);

  expect(content).toContain('ion-input');
});

test.skip('Debug: Try login with different selectors', async ({ page }) => {
  console.log('Navigating to /login...');
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Take screenshot before login attempt
  await page.screenshot({ path: 'test-results/debug-before-login.png', fullPage: true });

  // Try different selector strategies
  console.log('\nTrying to find email input...');

  // Strategy 1: Direct ion-input
  const emailInput1 = page.locator('ion-input[name="email"]');
  console.log('ion-input[name="email"] visible:', await emailInput1.isVisible().catch(() => false));

  // Strategy 2: Native input inside ion-input
  const emailInput2 = page.locator('ion-input[name="email"] input');
  console.log('ion-input[name="email"] input visible:', await emailInput2.isVisible().catch(() => false));

  // Strategy 3: Get inner input via evaluate
  const emailInput3 = page.locator('ion-input[name="email"]');
  if (await emailInput3.isVisible().catch(() => false)) {
    // Try to fill using Ionic's method
    await emailInput3.click();
    await page.keyboard.type('93196');
    console.log('Typed email using keyboard');
  }

  // Strategy 4: Use getByRole
  const emailByRole = page.getByRole('textbox').first();
  console.log('textbox role visible:', await emailByRole.isVisible().catch(() => false));

  await page.screenshot({ path: 'test-results/debug-after-type.png', fullPage: true });

  expect(true).toBe(true);
});
