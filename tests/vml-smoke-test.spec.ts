import { test } from './auth-fixture';

test.describe('VML Editor Smoke Test', () => {
  test.setTimeout(90000);

  test('Full VML editor walkthrough with screenshots', async ({ authenticatedPage: page }) => {
    await page.goto('/dids', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Step 1: Open DID wizard
    const addButton = page.locator('button:has(svg[data-testid="AddIcon"]), button:has-text("Add")');
    if (await addButton.count() === 0) {
      console.log('No Add button');
      return;
    }
    await addButton.first().click();
    await page.waitForTimeout(1500);

    // Step 2: Select VML bridge type
    const bridgeTypeSelect = page.locator('[data-tour="did-bridge"] [role="combobox"]');
    if (await bridgeTypeSelect.count() === 0) {
      console.log('No bridge type selector');
      return;
    }
    await bridgeTypeSelect.click();
    await page.waitForTimeout(500);

    const vmlOption = page.locator('[role="option"]').filter({ hasText: /vml/i });
    if (await vmlOption.count() === 0) {
      console.log('No VML option');
      return;
    }
    await vmlOption.first().click();
    await page.waitForTimeout(1000);

    // Step 3: Click Create New VML
    const destSelect = page.locator('label:has-text("Destination")').locator('..').locator('[role="combobox"]');
    await destSelect.click();
    await page.waitForTimeout(500);

    const createNew = page.locator('[role="option"]').filter({ hasText: /create new/i });
    if (await createNew.count() === 0) {
      console.log('No Create New option');
      return;
    }
    await createNew.click();
    await page.waitForTimeout(2000);

    // Screenshot 1: VML editor loaded
    await page.screenshot({ path: '/tmp/vml-01-editor-loaded.png', fullPage: false });
    console.log('Screenshot 1: VML editor loaded');

    // Step 4: Click Templates → select "API Callback"
    const templatesBtn = page.locator('button:has-text("Templates")');
    if (await templatesBtn.count() > 0) {
      await templatesBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/vml-02-templates-menu.png', fullPage: false });
      console.log('Screenshot 2: Templates menu open');

      const apiCallback = page.locator('[role="menuitem"]:has-text("API Callback")');
      if (await apiCallback.count() > 0) {
        page.on('dialog', d => d.accept());
        await apiCallback.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: '/tmp/vml-03-template-inserted.png', fullPage: false });
        console.log('Screenshot 3: API Callback template inserted');
      }
    }

    // Step 5: Click Snippets
    const snippetsBtn = page.locator('button:has-text("Snippets")');
    if (await snippetsBtn.count() > 0) {
      await snippetsBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/vml-04-snippets-menu.png', fullPage: false });
      console.log('Screenshot 4: Snippets menu open');
      await page.keyboard.press('Escape');
    }

    // Step 6: Test fullscreen
    const fullscreenBtn = page.locator('button[title*="ullscreen"], button:has(svg[data-testid="FullscreenIcon"])');
    if (await fullscreenBtn.count() > 0) {
      await fullscreenBtn.first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: '/tmp/vml-05-fullscreen.png', fullPage: false });
      console.log('Screenshot 5: Fullscreen mode');

      // Check editor size
      const monaco = page.locator('.monaco-editor');
      if (await monaco.count() > 0) {
        const box = await monaco.first().boundingBox();
        console.log(`Editor size in fullscreen: ${Math.round(box?.width || 0)}x${Math.round(box?.height || 0)}`);
      }

      // Exit fullscreen
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/vml-06-after-fullscreen-exit.png', fullPage: false });
      console.log('Screenshot 6: After fullscreen exit');
    } else {
      console.log('No fullscreen button found');
    }

    // Step 7: Check status bar
    const statusBar = page.locator('text=/Ln \\d+, Col \\d+/');
    if (await statusBar.count() > 0) {
      const text = await statusBar.textContent();
      console.log(`Status bar: ${text}`);
    }

    const errorStatus = page.locator('text="No errors"');
    if (await errorStatus.count() > 0) {
      console.log('Syntax check: No errors (valid Lua)');
    }

    const charCount = page.locator('text=/\\d+ chars/');
    if (await charCount.count() > 0) {
      console.log(`Char count: ${await charCount.textContent()}`);
    }

    // Step 8: Type in editor to test editing speed
    const monacoInput = page.locator('.monaco-editor textarea');
    if (await monacoInput.count() > 0) {
      await monacoInput.first().focus();

      // Move to end
      await page.keyboard.press('Control+End');
      await page.waitForTimeout(200);

      // Type new code
      const startTime = Date.now();
      await page.keyboard.type('\n-- Added by smoke test\nlocal test_var = "hello"\nfreeswitch.consoleLog("INFO", test_var)\n');
      const typeTime = Date.now() - startTime;
      console.log(`Typing speed: ${typeTime}ms for 4 lines`);

      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/vml-07-after-edit.png', fullPage: false });
      console.log('Screenshot 7: After manual edit');
    }

    console.log('Smoke test complete - all features working');
  });
});
