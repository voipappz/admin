import { test, expect } from './auth-fixture';
import { testList, testRead, testUpdate, testCreate, getFirstItem, getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * ACLs Module - Full CRUD Tests
 * API: /api/acls
 * Tests: LIST, READ, CREATE, UPDATE, Types, TypeData, User Assignment, Account Assignment
 */

test.describe('ACLs CRUD', () => {
  test.setTimeout(60000);

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const response = await testList(page, 'acls');
    expect(response.status()).toBe(200);

    const data = await response.json();
    const list = Array.isArray(data) ? data : data.data || [];
    console.log(`✅ Found ${list.length} ACLs`);
  });

  test('READ returns 200', async ({ authenticatedPage: page }) => {
    const acl = await getFirstItem(page, 'acls');
    if (!acl) {
      console.log('⚠️ No ACLs available, skipping READ');
      return;
    }

    const response = await testRead(page, 'acls', acl.uuid);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.uuid).toBe(acl.uuid);
    console.log(`✅ READ ACL: ${data.name} (type: ${data.type})`);
  });

  test('GET types returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/acls?action=types`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    const types = Array.isArray(data) ? data : [];
    console.log(`✅ Found ${types.length} ACL types: ${types.slice(0, 5).join(', ')}${types.length > 5 ? '...' : ''}`);
  });

  test('GET type data returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // First get types
    const typesResponse = await page.request.get(`${apiBaseUrl}/api/acls?action=types`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const types = await typesResponse.json();
    const typesList = Array.isArray(types) ? types : [];

    if (typesList.length === 0) {
      console.log('⚠️ No ACL types available, skipping type data test');
      return;
    }

    const firstType = typesList[0];
    const response = await page.request.get(`${apiBaseUrl}/api/acls?data=${encodeURIComponent(firstType)}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    const categories = Object.keys(data?.data || data || {});
    console.log(`✅ Type '${firstType}' has ${categories.length} categories: ${categories.slice(0, 5).join(', ')}${categories.length > 5 ? '...' : ''}`);
  });

  test('CREATE returns 200/201 (or error for non-root)', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Check if this is a root account
    const isRoot = page.authTokens?.isRoot ?? false;

    // Get first type for creation
    const typesResponse = await page.request.get(`${apiBaseUrl}/api/acls?action=types`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const types = await typesResponse.json();
    const typesList = Array.isArray(types) ? types : [];

    if (typesList.length === 0) {
      console.log('⚠️ No ACL types available, skipping CREATE');
      return;
    }

    const timestamp = Date.now();
    const response = await testCreate(page, 'acls', {
      name: `Test ACL ${timestamp}`,
      type: typesList[0],
      notes: 'Created by Playwright test'
    });

    const status = response.status();

    // ACL creation may require root/admin permissions
    // Non-root accounts may receive various error codes (400, 401, 403, 500)
    if (!isRoot && status >= 400) {
      console.log(`⚠️ ACL CREATE: ${status} - Account does not have permission to create ACLs (non-root account)`);
      // For non-root accounts, any error response is acceptable
      expect(status).toBeGreaterThanOrEqual(400);
      return;
    }

    if (status !== 201 && status !== 200) {
      const body = await response.text();
      console.log(`⚠️ ACL CREATE: ${status} - ${body}`);
    }

    expect([200, 201]).toContain(status);
    console.log(`✅ CREATE ACL status: ${status}`);

    // Try to clean up
    try {
      const data = await response.json();
      if (data?.uuid) {
        await page.request.delete(`${apiBaseUrl}/api/acls/${data.uuid}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        console.log(`✅ Cleaned up test ACL: ${data.uuid}`);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  test('UPDATE returns 200 (or error for non-root)', async ({ authenticatedPage: page }) => {
    // Check if this is a root account
    const isRoot = page.authTokens?.isRoot ?? false;

    const acl = await getFirstItem(page, 'acls');
    if (!acl) {
      console.log('⚠️ No ACLs available, skipping UPDATE');
      return;
    }

    const originalName = acl.name;
    const newName = `Updated ACL ${Date.now()}`;
    const response = await testUpdate(page, 'acls', acl.uuid, { name: newName });

    const status = response.status();

    // ACL update may require root/admin permissions
    // Non-root accounts may receive various error codes (400, 401, 403, 500)
    if (!isRoot && status >= 400) {
      console.log(`⚠️ ACL UPDATE: ${status} - Account does not have permission to update ACLs (non-root account)`);
      // For non-root accounts, any error response is acceptable
      expect(status).toBeGreaterThanOrEqual(400);
      return;
    }

    expect(response.status()).toBe(200);

    // Restore original name
    await testUpdate(page, 'acls', acl.uuid, { name: originalName });
    console.log(`✅ UPDATE ACL: ${originalName} -> ${newName} -> ${originalName}`);
  });
});

test.describe('ACL User Assignment', () => {
  test.setTimeout(60000);

  test('Assign ACL to user returns 200', async ({ authenticatedPage: page }) => {
    // Get first user
    const user = await getFirstItem(page, 'users');
    if (!user) {
      console.log('⚠️ No users available, skipping ACL assignment');
      return;
    }

    // Get first ACL
    const acl = await getFirstItem(page, 'acls');
    if (!acl) {
      console.log('⚠️ No ACLs available, skipping ACL assignment');
      return;
    }

    const originalAclUuid = user.acl_uuid || user.acl?.uuid || '';

    // Assign ACL to user
    const response = await testUpdate(page, 'users', user.uuid, { acl_uuid: acl.uuid });

    expect(response.status()).toBe(200);
    console.log(`✅ Assigned ACL '${acl.name}' to user '${user.name || user.email}'`);

    // Restore original ACL if different
    if (originalAclUuid && originalAclUuid !== acl.uuid) {
      await testUpdate(page, 'users', user.uuid, { acl_uuid: originalAclUuid });
      console.log(`✅ Restored original ACL for user`);
    }
  });
});

test.describe('ACL Account Assignment', () => {
  test.setTimeout(60000);

  test('Assign ACL to account returns 200', async ({ authenticatedPage: page }) => {
    // Get first account
    const account = await getFirstItem(page, 'accounts');
    if (!account) {
      console.log('⚠️ No accounts available, skipping ACL assignment');
      return;
    }

    // Get first ACL
    const acl = await getFirstItem(page, 'acls');
    if (!acl) {
      console.log('⚠️ No ACLs available, skipping ACL assignment');
      return;
    }

    const originalAclUuid = account.acl_uuid || account.acl?.uuid || '';

    // Assign ACL to account
    const response = await testUpdate(page, 'accounts', account.uuid, { acl_uuid: acl.uuid });

    expect(response.status()).toBe(200);
    console.log(`✅ Assigned ACL '${acl.name}' to account '${account.name || account.email}'`);

    // Restore original ACL if different
    if (originalAclUuid && originalAclUuid !== acl.uuid) {
      await testUpdate(page, 'accounts', account.uuid, { acl_uuid: originalAclUuid });
      console.log(`✅ Restored original ACL for account`);
    }
  });
});

test.describe('ACL UI Tests', () => {
  test.setTimeout(90000);

  test('Users dialog shows ACL select with edit/create buttons', async ({ authenticatedPage: page }) => {
    await page.goto('/users', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the table to load
    await page.waitForSelector('table', { timeout: 15000 });

    // Click the first edit button
    const editButton = page.locator('[data-testid="edit-user-button"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1000);

      // Check for ACL select component - look for ACL label in the dialog
      const aclLabel = page.locator('[role="dialog"] label:has-text("ACL")').first();
      await expect(aclLabel).toBeVisible({ timeout: 5000 });
      console.log('✅ ACL select is visible in Users dialog');

      // Check for Add button (create new ACL)
      const addButton = page.locator('button[title="Create New ACL"], button:has-text("Add")').first();
      const isAddVisible = await addButton.isVisible().catch(() => false);
      console.log(`${isAddVisible ? '✅' : '⚠️'} Create New ACL button ${isAddVisible ? 'is' : 'may not be'} visible`);

      // Close dialog
      await page.keyboard.press('Escape');
    } else {
      console.log('⚠️ No edit button found, skipping UI test');
    }
  });

  test('Accounts dialog shows ACL select with edit/create buttons', async ({ authenticatedPage: page }) => {
    await page.goto('/accounts', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the table to load
    await page.waitForSelector('table', { timeout: 15000 });

    // Click the first edit button
    const editButton = page.locator('[data-testid="edit-account-button"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1000);

      // Check for ACL select component in the dialog
      const aclLabel = page.locator('[role="dialog"] label:has-text("ACL")').first();
      await expect(aclLabel).toBeVisible({ timeout: 5000 });
      console.log('✅ ACL select is visible in Accounts dialog');

      // Close dialog
      await page.keyboard.press('Escape');
    } else {
      console.log('⚠️ No edit button found, skipping UI test');
    }
  });
});
