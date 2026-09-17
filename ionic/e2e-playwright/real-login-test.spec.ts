import { test, expect } from '@playwright/test';

/**
 * Real login test - attempts to login with actual credentials
 * Credentials from: .env.test (TEST_USERNAME=93196, TEST_PASSWORD=34rkew)
 */
test('Real login with actual API', async ({ page }) => {
  // Collect all console messages
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (text.includes('[SIP.js]') || text.includes('[WebRTCPhone]') || text.includes('[Phone]')) {
      console.log('>>', text);
    }
  });

  // Navigate to login page
  console.log('Step 1: Navigate to login page');
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Fill in credentials - no mocking, real API call
  console.log('Step 2: Fill login credentials');
  await page.locator('ion-input[name="email"] input').fill('93196');
  await page.locator('ion-input[name="password"] input').fill('34rkew');

  // Click login
  console.log('Step 3: Submit login');
  await page.locator('ion-button[type="submit"]').click();

  // Wait for app to load
  console.log('Step 4: Wait for app to load');
  await page.waitForTimeout(3000);

  // Wait for SIP.js to initialize and register
  console.log('Step 5: Wait for SIP.js initialization (10 seconds)');
  await page.waitForTimeout(10000);

  // Log current URL
  console.log('Current URL:', page.url());

  // Check for registration success
  const registered = consoleMessages.some(m => m.includes('Registered'));
  const ready = consoleMessages.some(m => m.includes('Ready'));
  console.log('\n========== SIP.js Status ==========');
  console.log('Registered:', registered);
  console.log('Ready status:', ready);
  console.log('====================================\n');
});

/**
 * Test making a real call after login
 */
test('Real call test - login and dial', async ({ page }) => {
  // Collect all console messages
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (text.includes('[SIP.js]') || text.includes('[WebRTCPhone]') || text.includes('INVITE') || text.includes('[Phone]')) {
      console.log('>>', text);
    }
  });

  // Login
  console.log('Step 1: Login');
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('ion-input[name="email"] input').fill('93196');
  await page.locator('ion-input[name="password"] input').fill('34rkew');
  await page.locator('ion-button[type="submit"]').click();

  // Wait for app and SIP.js registration
  console.log('Step 2: Wait for SIP.js registration (15 seconds)');
  await page.waitForTimeout(15000);

  // Check if registered
  const registered = consoleMessages.some(m => m.includes('Registered successfully') || m.includes('Ready'));
  console.log('SIP.js Registered:', registered);

  if (!registered) {
    console.log('\n========== All SIP.js Messages ==========');
    consoleMessages.filter(m => m.includes('[SIP.js]') || m.includes('[WebRTCPhone]')).forEach(m => console.log(m));
    console.log('==========================================\n');
  }

  // Open phone sidebar menu
  console.log('Step 3: Open phone sidebar');
  await page.evaluate(() => {
    const menuController = (window as any).menuController;
    if (menuController) {
      menuController.enable(true, 'phone-sidebar');
      menuController.open('phone-sidebar');
    }
  });
  await page.waitForTimeout(1000);

  // Alternative: click phone icon in header
  const phoneIcon = page.locator('ion-icon[name="call"], ion-icon[name="call-outline"]').first();
  if (await phoneIcon.isVisible()) {
    await phoneIcon.click();
    await page.waitForTimeout(500);
  }

  // Click on dialpad tab
  console.log('Step 4: Switch to dialpad tab');
  const dialpadTab = page.locator('ion-segment-button[value="dialpad"]');
  if (await dialpadTab.isVisible()) {
    await dialpadTab.click();
    await page.waitForTimeout(500);
  }

  // Enter number using digit buttons
  console.log('Step 5: Enter number 100');
  const digit1 = page.locator('ion-button.digit-btn:has-text("1")').first();
  const digit0 = page.locator('ion-button.digit-btn:has-text("0")').first();

  if (await digit1.isVisible()) {
    await digit1.click();
    await page.waitForTimeout(100);
    await digit0.click();
    await page.waitForTimeout(100);
    await digit0.click();
    await page.waitForTimeout(100);
  }

  // Click call button
  console.log('Step 6: Click call button');
  const callBtn = page.locator('ion-button.call-btn');
  if (await callBtn.isVisible()) {
    console.log('Call button found, clicking...');
    await callBtn.click();
    console.log('Call button clicked, waiting 5 seconds...');
    await page.waitForTimeout(5000);
  } else {
    console.log('Call button not visible');
  }

  // Check for INVITE
  const inviteSent = consoleMessages.some(m => m.includes('INVITE sent') || m.includes('Sending INVITE'));
  const callMade = consoleMessages.some(m => m.includes('MAKING CALL'));

  console.log('\n========== Call Results ==========');
  console.log('Call initiated:', callMade);
  console.log('INVITE sent:', inviteSent);
  console.log('===================================\n');

  // Print all SIP.js messages
  console.log('\n========== All SIP.js Messages ==========');
  consoleMessages
    .filter(m => m.includes('[SIP.js]') || m.includes('[WebRTCPhone]') || m.includes('[Phone]') || m.includes('INVITE'))
    .forEach(m => console.log(m));
  console.log('==========================================\n');
});
