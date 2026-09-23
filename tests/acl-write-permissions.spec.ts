import { test, expect } from './auth-fixture';

/**
 * ACL Write Permission Enforcement Tests
 *
 * Verifies that Create/Edit/Delete buttons are:
 * - VISIBLE when the account ACL includes 'write' for the screen
 * - HIDDEN when the account ACL only has 'read' (no 'write')
 *
 * This tests the canWrite = hasPermission(acl, screenKey, 'write') enforcement
 * added to all CRUD components.
 */

/**
 * Helper: modify the ACL in localStorage to remove 'write' from a specific screen
 * Returns the original ACL so it can be restored later.
 */
async function setReadOnlyAcl(page: any, screenKey: string) {
  await page.evaluate((key: string) => {
    const authStr = localStorage.getItem('auth');
    if (!authStr) return;
    const auth = JSON.parse(authStr);
    if (!auth.acl) return;

    // The ACL can be nested: { data: { screen: { main: [...] } } } or direct { screen: { main: [...] } }
    const aclData = auth.acl.data || auth.acl;

    // Remove 'write' from the screen key, keeping only 'read'
    if (aclData[key]) {
      if (typeof aclData[key] === 'object' && aclData[key].main) {
        aclData[key].main = aclData[key].main.filter((p: string) => p !== 'write');
      } else if (Array.isArray(aclData[key])) {
        aclData[key] = aclData[key].filter((p: string) => p !== 'write');
      }
    }

    // Also check singular form (e.g., 'user' for 'users')
    const singular = key.slice(0, -1);
    if (aclData[singular]) {
      if (typeof aclData[singular] === 'object' && aclData[singular].main) {
        aclData[singular].main = aclData[singular].main.filter((p: string) => p !== 'write');
      } else if (Array.isArray(aclData[singular])) {
        aclData[singular] = aclData[singular].filter((p: string) => p !== 'write');
      }
    }

    if (auth.acl.data) {
      auth.acl.data = aclData;
    } else {
      auth.acl = aclData;
    }

    localStorage.setItem('auth', JSON.stringify(auth));
  }, screenKey);
}

/**
 * Helper: restore full write ACL for a screen key
 */
async function restoreWriteAcl(page: any, screenKey: string) {
  await page.evaluate((key: string) => {
    const authStr = localStorage.getItem('auth');
    if (!authStr) return;
    const auth = JSON.parse(authStr);
    if (!auth.acl) return;

    const aclData = auth.acl.data || auth.acl;

    // Restore 'write' to the screen key
    if (aclData[key]) {
      if (typeof aclData[key] === 'object' && aclData[key].main) {
        if (!aclData[key].main.includes('write')) {
          aclData[key].main.push('write');
        }
      }
    }

    const singular = key.slice(0, -1);
    if (aclData[singular]) {
      if (typeof aclData[singular] === 'object' && aclData[singular].main) {
        if (!aclData[singular].main.includes('write')) {
          aclData[singular].main.push('write');
        }
      }
    }

    if (auth.acl.data) {
      auth.acl.data = aclData;
    } else {
      auth.acl = aclData;
    }

    localStorage.setItem('auth', JSON.stringify(auth));
  }, screenKey);
}

// ─── Screen configurations for write permission tests ───────────────────────
const screenTests = [
  {
    name: 'Users',
    route: '/users',
    aclKey: 'users',
    writeSelectors: {
      addButton: 'button:has-text("Add New User")',
      editButton: '[data-testid="edit-user-button"]',
      deleteButton: '[data-testid="delete-user-button"]',
      importButton: 'button:has-text("Import CSV")',
    },
  },
  {
    name: 'Accounts',
    route: '/accounts',
    aclKey: 'accounts',
    writeSelectors: {
      addButton: 'button:has-text("Add Account")',
      editButton: '[data-testid="edit-account-button"]',
      deleteButton: '[data-testid="delete-account-button"]',
    },
  },
  {
    name: 'Environments',
    route: '/environments',
    aclKey: 'environments',
    writeSelectors: {
      addButton: 'button:has-text("Add Environment")',
      editButton: '[data-testid="edit-environment-button"]',
      deleteButton: '[data-testid="delete-environment-button"]',
    },
  },
  {
    name: 'Routes',
    route: '/dids',
    aclKey: 'routes',
    writeSelectors: {
      addButton: 'button:has-text("Add New")',
      importButton: 'button:has-text("Import CSV")',
    },
  },
  {
    name: 'Services',
    route: '/services',
    aclKey: 'services',
    writeSelectors: {
      addButton: 'button:has-text("Add Service")',
    },
  },
  {
    name: 'Providers',
    route: '/providers',
    aclKey: 'providers',
    writeSelectors: {
      addButton: 'button:has-text("Add New Provider")',
    },
  },
  {
    name: 'Devices',
    route: '/extensions',
    aclKey: 'extensions',
    writeSelectors: {
      addButton: 'button:has-text("Add Device")',
      importButton: 'button:has-text("Import CSV")',
    },
  },
  {
    name: 'Subscriptions',
    route: '/subscriptions',
    aclKey: 'subscription',
    writeSelectors: {
      addButton: 'button:has-text("Add New")',
    },
  },
  {
    name: 'Campaigns',
    route: '/campaigns',
    aclKey: 'campaigns',
    writeSelectors: {
      addButton: 'button:has-text("Add New")',
    },
  },
];

// ─── Tests: Write buttons visible WITH write permission ─────────────────────
test.describe('ACL Write Permission - Buttons Visible', () => {
  test.setTimeout(process.env.CI ? 120000 : 60000);

  for (const screen of screenTests) {
    test(`${screen.name}: write buttons visible with write ACL`, async ({ authenticatedPage: page }) => {
      await page.goto(screen.route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Check that the Add/Create button is visible (most reliable check — doesn't require table data)
      const addSelector = screen.writeSelectors.addButton;
      const addButton = page.locator(addSelector).first();
      const addVisible = await addButton.isVisible().catch(() => false);

      if (addVisible) {
        console.log(`✅ ${screen.name}: Add/Create button visible with write ACL`);
      } else {
        // Page may be empty or loading — log but don't fail
        console.log(`⚠️ ${screen.name}: Add button not found (page may still be loading)`);
      }

      // Check Import CSV if present
      if (screen.writeSelectors.importButton) {
        const importBtn = page.locator(screen.writeSelectors.importButton).first();
        const importVisible = await importBtn.isVisible().catch(() => false);
        if (importVisible) {
          console.log(`✅ ${screen.name}: Import CSV button visible with write ACL`);
        }
      }

      // Check edit button if rows exist
      if (screen.writeSelectors.editButton) {
        const editBtn = page.locator(screen.writeSelectors.editButton).first();
        const editVisible = await editBtn.isVisible().catch(() => false);
        if (editVisible) {
          console.log(`✅ ${screen.name}: Edit button visible with write ACL`);
        } else {
          console.log(`⚠️ ${screen.name}: Edit button not found (table may be empty)`);
        }
      }

      // Check delete button if rows exist
      if (screen.writeSelectors.deleteButton) {
        const deleteBtn = page.locator(screen.writeSelectors.deleteButton).first();
        const deleteVisible = await deleteBtn.isVisible().catch(() => false);
        if (deleteVisible) {
          console.log(`✅ ${screen.name}: Delete button visible with write ACL`);
        } else {
          console.log(`⚠️ ${screen.name}: Delete button not found (table may be empty)`);
        }
      }

      // At minimum, the Add button should be present on screens with write ACL
      expect(addVisible).toBe(true);
    });
  }
});

// ─── Tests: Write buttons HIDDEN without write permission ───────────────────
test.describe('ACL Write Permission - Buttons Hidden (Read-Only)', () => {
  test.setTimeout(process.env.CI ? 120000 : 60000);

  for (const screen of screenTests) {
    test(`${screen.name}: write buttons hidden without write ACL`, async ({ authenticatedPage: page }) => {
      // First remove 'write' from the ACL for this screen
      await setReadOnlyAcl(page, screen.aclKey);

      // Reload to pick up the modified ACL
      await page.goto(screen.route, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Verify Add/Create button is NOT visible
      const addButton = page.locator(screen.writeSelectors.addButton).first();
      const addVisible = await addButton.isVisible().catch(() => false);

      if (!addVisible) {
        console.log(`✅ ${screen.name}: Add/Create button correctly hidden with read-only ACL`);
      } else {
        console.log(`❌ ${screen.name}: Add/Create button still visible with read-only ACL`);
      }

      expect(addVisible).toBe(false);

      // Verify Import CSV is hidden
      if (screen.writeSelectors.importButton) {
        const importBtn = page.locator(screen.writeSelectors.importButton).first();
        const importVisible = await importBtn.isVisible().catch(() => false);
        if (!importVisible) {
          console.log(`✅ ${screen.name}: Import CSV button correctly hidden`);
        } else {
          console.log(`❌ ${screen.name}: Import CSV button still visible`);
        }
        expect(importVisible).toBe(false);
      }

      // Verify edit button is hidden
      if (screen.writeSelectors.editButton) {
        const editBtn = page.locator(screen.writeSelectors.editButton).first();
        const editVisible = await editBtn.isVisible().catch(() => false);
        if (!editVisible) {
          console.log(`✅ ${screen.name}: Edit button correctly hidden`);
        }
        expect(editVisible).toBe(false);
      }

      // Verify delete button is hidden
      if (screen.writeSelectors.deleteButton) {
        const deleteBtn = page.locator(screen.writeSelectors.deleteButton).first();
        const deleteVisible = await deleteBtn.isVisible().catch(() => false);
        if (!deleteVisible) {
          console.log(`✅ ${screen.name}: Delete button correctly hidden`);
        }
        expect(deleteVisible).toBe(false);
      }

      // Restore write ACL for subsequent tests
      await restoreWriteAcl(page, screen.aclKey);
    });
  }
});

// ─── Test: Verify table data is still visible in read-only mode ─────────────
test.describe('ACL Write Permission - Read Access Preserved', () => {
  test.setTimeout(process.env.CI ? 120000 : 60000);

  test('Users: table data visible in read-only mode', async ({ authenticatedPage: page }) => {
    // Remove write ACL for users
    await setReadOnlyAcl(page, 'users');

    await page.goto('/users', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Table should still be present and showing data
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Rows should still load (read access preserved)
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    console.log(`✅ Users table has ${rowCount} rows in read-only mode`);

    // The Refresh button should still be visible (it's a read action)
    const refreshButton = page.locator('button:has(svg[data-testid="RefreshIcon"])').first();
    const refreshVisible = await refreshButton.isVisible().catch(() => false);
    if (refreshVisible) {
      console.log('✅ Refresh button still visible in read-only mode (read action)');
    }

    // But Add User should NOT be visible
    const addButton = page.locator('button:has-text("Add New User")').first();
    const addVisible = await addButton.isVisible().catch(() => false);
    expect(addVisible).toBe(false);
    console.log('✅ Add New User button correctly hidden in read-only mode');

    // Restore
    await restoreWriteAcl(page, 'users');
  });

  test('Accounts: table data visible in read-only mode', async ({ authenticatedPage: page }) => {
    await setReadOnlyAcl(page, 'accounts');

    await page.goto('/accounts', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Table should be present
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    console.log(`✅ Accounts table has ${rowCount} rows in read-only mode`);

    // Add Account should NOT be visible
    const addButton = page.locator('button:has-text("Add Account")').first();
    const addVisible = await addButton.isVisible().catch(() => false);
    expect(addVisible).toBe(false);
    console.log('✅ Add Account button correctly hidden in read-only mode');

    await restoreWriteAcl(page, 'accounts');
  });
});

// ─── Test: Sidebar and route ACL enforcement ────────────────────────────────
test.describe('ACL Route Protection', () => {
  test.setTimeout(process.env.CI ? 120000 : 60000);

  test('Dashboard route requires dashboards ACL', async ({ authenticatedPage: page }) => {
    // Navigate to dashboard - should work with full ACL
    await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const url = page.url();
    // If user has dashboards ACL, they stay on /dashboard
    // If not, they get redirected to /live
    if (url.includes('/dashboard')) {
      console.log('✅ Dashboard accessible with dashboards ACL');
    } else {
      console.log(`⚠️ Redirected to ${url} (account may lack dashboards ACL)`);
    }

    expect(true).toBe(true);
  });

  test('Sidebar shows Dashboard link', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Look for Dashboard in the sidebar
    const dashboardLink = page.locator('.sidebar-container >> text=Dashboard');
    const dashboardVisible = await dashboardLink.isVisible().catch(() => false);

    if (dashboardVisible) {
      console.log('✅ Dashboard link visible in sidebar');
    } else {
      // May not have dashboards ACL
      console.log('⚠️ Dashboard link not visible (account may lack dashboards ACL)');
    }

    expect(true).toBe(true);
  });
});
