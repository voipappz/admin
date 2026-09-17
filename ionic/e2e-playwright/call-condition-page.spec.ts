import { test, expect } from '@playwright/test';

/**
 * Call Condition Page Test
 * Tests that the Call Condition page loads and fetches data from API
 */
test('Call Condition page loads from Settings', async ({ page }) => {
  // Collect console messages
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (text.includes('call_condition') || text.includes('call condition') || text.includes('timecondition')) {
      console.log('>>', text);
    }
  });

  // Login first
  console.log('Step 1: Login');
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('ion-input[name="email"] input').fill('93196');
  await page.locator('ion-input[name="password"] input').fill('34rkew');
  await page.locator('ion-button[type="submit"]').click();

  // Wait for app to load
  await page.waitForURL('**/app/**', { timeout: 15000 });
  console.log('Step 2: Logged in, URL:', page.url());

  // Navigate to Settings
  console.log('Step 3: Navigate to Settings');
  await page.goto('/app/settings');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Click on Time Condition menu item
  console.log('Step 4: Click on Time Condition');
  const timeConditionItem = page.locator('ion-item:has-text("Time condition"), ion-item:has-text("Actions")');
  await expect(timeConditionItem).toBeVisible({ timeout: 5000 });
  await timeConditionItem.click();

  // Wait for modal to open and data to load
  console.log('Step 5: Wait for Call Condition page to load');
  await page.waitForTimeout(3000);

  // Check for loading indicator or data
  const pageContent = await page.content();

  // Look for the page title or schedule section
  const hasSchedule = pageContent.includes('Schedule') || pageContent.includes('TIME_CONDITION');
  const hasLoading = pageContent.includes('fa-circle-o-notch') || pageContent.includes('ion-spinner');
  const hasError = consoleMessages.some(m => m.includes('Error'));
  const hasFetchedList = consoleMessages.some(m => m.includes('call_conditions list'));
  const hasLoadedCondition = consoleMessages.some(m => m.includes('call condition loaded'));

  console.log('\n========== Call Condition Page Results ==========');
  console.log('Has Schedule section:', hasSchedule);
  console.log('Is Loading:', hasLoading);
  console.log('Has Errors:', hasError);
  console.log('Fetched call_conditions list from API:', hasFetchedList);
  console.log('Loaded call condition:', hasLoadedCondition);
  console.log('=================================================\n');

  // Print relevant console messages
  console.log('\n========== Relevant Console Messages ==========');
  consoleMessages
    .filter(m => m.includes('call_condition') || m.includes('call condition') || m.includes('timecondition') || m.includes('Error'))
    .forEach(m => console.log(m));
  console.log('================================================\n');

  // Take screenshot for debugging
  await page.screenshot({ path: 'test-results/call-condition-page.png', fullPage: true });

  // Verify page loaded successfully (either has schedule or fetched from API)
  expect(hasFetchedList || hasLoadedCondition || hasSchedule).toBe(true);
});

test('Call Condition page via direct URL', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (text.includes('call_condition') || text.includes('call condition')) {
      console.log('>>', text);
    }
  });

  // Login first
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('ion-input[name="email"] input').fill('93196');
  await page.locator('ion-input[name="password"] input').fill('34rkew');
  await page.locator('ion-button[type="submit"]').click();
  await page.waitForURL('**/app/**', { timeout: 15000 });

  // Navigate directly to time-condition page
  console.log('Navigating directly to /app/time-condition');
  await page.goto('/app/time-condition');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  const hasFetchedList = consoleMessages.some(m => m.includes('call_conditions list'));
  const hasLoadedCondition = consoleMessages.some(m => m.includes('call condition loaded'));
  const hasError = consoleMessages.some(m => m.toLowerCase().includes('error'));

  console.log('\n========== Direct URL Results ==========');
  console.log('Fetched call_conditions list:', hasFetchedList);
  console.log('Loaded call condition:', hasLoadedCondition);
  console.log('Has errors:', hasError);
  console.log('=========================================\n');

  // Print all call condition related messages
  consoleMessages
    .filter(m => m.includes('call_condition') || m.includes('call condition') || m.includes('timecondition'))
    .forEach(m => console.log('>>', m));

  await page.screenshot({ path: 'test-results/call-condition-direct.png', fullPage: true });

  expect(hasFetchedList || hasLoadedCondition).toBe(true);
});
