import { test, expect } from '@playwright/test';

test.describe('CSV Import Feature Test', () => {
  test('should display CSV preview and allow inline editing', async ({ page }) => {
    // Login
    console.log('🔐 Logging in...');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'rubi@nimbusip.com');
    await page.fill('input[type="password"]', 'Rubi5060');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Navigate to Appz screen
    console.log('📍 Navigating to Appz screen...');
    await page.goto('http://localhost:3000/appz');
    await page.waitForTimeout(2000);

    // Select Environment schema type
    console.log('📋 Selecting Environment schema type...');
    const environmentButton = page.locator('text=Environment').first();
    await environmentButton.click();
    await page.waitForTimeout(1000);

    // Click Import CSV button
    console.log('📤 Opening import dialog...');
    await page.locator('button:has-text("Import CSV")').click();
    await page.waitForTimeout(1000);

    // Verify dialog opened
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    console.log('✅ Import dialog opened');

    // Upload CSV file
    console.log('📁 Uploading CSV file...');
    await page.locator('input[type="file"]').setInputFiles('/tmp/test-schema.csv');
    await page.waitForTimeout(2000);

    // Verify CSV preview is visible
    console.log('👀 Verifying CSV preview...');
    await expect(page.locator('text=CSV Preview')).toBeVisible();
    console.log('✅ CSV Preview visible');

    // Verify row/column counts
    await expect(page.locator('text=/3 rows?/')).toBeVisible();
    await expect(page.locator('text=/3 columns?/')).toBeVisible();
    console.log('✅ Row and column counts displayed');

    // Test cell editing
    console.log('✏️ Testing cell editing...');
    const firstCell = page.locator('tbody tr').first().locator('td').nth(1);
    await firstCell.click();
    await page.waitForTimeout(500);

    // Verify input field appears
    const inputField = page.locator('tbody input[type="text"]').first();
    await expect(inputField).toBeVisible();
    console.log('✅ Edit input field visible');

    // Edit cell value
    await inputField.fill('Edited Environment Name');
    await page.locator('body').click();
    await page.waitForTimeout(500);
    console.log('✅ Cell edited successfully');

    // Verify Change File button
    await expect(page.locator('button:has-text("Change File")')).toBeVisible();
    console.log('✅ Change File button visible');

    // Take screenshot
    await page.screenshot({ path: '/tmp/csv-import-test.png', fullPage: true });
    console.log('📸 Screenshot saved');

    console.log('\n🎉 All CSV import tests passed!');
  });
});
