import { test, expect } from './auth-fixture';
import { testList, testRead, testCreate, testUpdate, testDelete, getFirstItem } from './crud-helpers';

/**
 * Environments Module - Full CRUD Tests
 * API: /api/environments
 * Tests: LIST, READ, CREATE, UPDATE, DELETE, Page Load
 */

test.describe('Environments CRUD', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const response = await testList(page, 'environments');
    expect(response.status()).toBe(200);

    const data = await response.json();
    const list = Array.isArray(data) ? data : data.data || [];
    console.log(`✅ Found ${list.length} environments`);
  });

  test('READ returns 200', async ({ authenticatedPage: page }) => {
    const env = await getFirstItem(page, 'environments');
    if (!env) {
      console.log('⚠️ No environments available, skipping READ');
      return;
    }

    const response = await testRead(page, 'environments', env.uuid);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.uuid).toBe(env.uuid);
    console.log(`✅ READ environment: ${data.name}`);
  });

  test('CREATE returns 201', async ({ authenticatedPage: page }) => {
    const timestamp = Date.now();
    const response = await testCreate(page, 'environments', {
      name: `Test Env ${timestamp}`,
      enabled: 'true'
    });

    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toContain('Test Env');
    console.log(`✅ CREATE environment: ${created.name}`);
  });

  test('UPDATE returns 200', async ({ authenticatedPage: page }) => {
    const env = await getFirstItem(page, 'environments');
    if (!env) {
      console.log('⚠️ No environments available, skipping UPDATE');
      return;
    }

    const originalName = env.name;
    const newName = `Updated Env ${Date.now()}`;
    const response = await testUpdate(page, 'environments', env.uuid, {
      name: newName,
      enabled: 'true'
    });

    expect(response.status()).toBe(200);

    const updated = await response.json();
    expect(updated.name).toBe(newName);
    console.log(`✅ UPDATE environment: ${originalName} → ${updated.name}`);

    // Restore original name
    await testUpdate(page, 'environments', env.uuid, { name: originalName });
  });

  test('DELETE returns 200', async ({ authenticatedPage: page }) => {
    // Create an environment to delete
    const timestamp = Date.now();
    const createResponse = await testCreate(page, 'environments', {
      name: `Delete Test ${timestamp}`,
      enabled: 'true'
    });

    if (createResponse.status() !== 201 && createResponse.status() !== 200) {
      console.log('⚠️ Could not create environment for delete test, skipping');
      return;
    }

    const created = await createResponse.json();
    const response = await testDelete(page, 'environments', created.uuid);

    expect([200, 204]).toContain(response.status());
    console.log(`✅ DELETE environment: ${created.uuid}`);
  });

  test('Page loads', async ({ authenticatedPage: page }) => {
    // Use longer timeout in CI environment
    const timeout = process.env.CI ? 30000 : 15000;
    await page.goto('/environments', { waitUntil: 'domcontentloaded', timeout });
    expect(page.url()).toContain('/environments');
    console.log('✅ Environments page loaded');
  });
});
