import { test, expect } from './auth-fixture';
import { testList, testRead, testCreate, testUpdate, testDelete, getFirstItem } from './crud-helpers';

/**
 * Templates Module - Full CRUD Tests
 * API: /api/templates
 * Backend fields: name (required), type (required), text (required), enabled, notes, meta, profile
 * Types: sms, account, user, voicemail, facsimile, conference, call, subscription, reminder
 */

test.describe('Templates CRUD', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const response = await testList(page, 'templates');
    expect(response.status()).toBe(200);

    const data = await response.json();
    const list = Array.isArray(data) ? data : data.data || [];
    console.log(`Found ${list.length} templates`);
  });

  test('READ returns 200', async ({ authenticatedPage: page }) => {
    const item = await getFirstItem(page, 'templates');
    if (!item) {
      console.log('No templates available, skipping READ');
      return;
    }

    const response = await testRead(page, 'templates', item.uuid);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.uuid).toBe(item.uuid);
    console.log(`READ template: ${data.name} (type: ${data.type})`);
  });

  test('CREATE returns 201', async ({ authenticatedPage: page }) => {
    const timestamp = Date.now();
    const response = await testCreate(page, 'templates', {
      name: `Test Template ${timestamp}`,
      type: 'sms',
      text: 'Hello {{caller_id_number}}, this is a test template.',
      enabled: 'true',
      notes: 'Created by Playwright test'
    });

    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toContain('Test Template');
    expect(created.type).toBe('sms');
    expect(created.text).toContain('{{caller_id_number}}');
    console.log(`CREATE template: ${created.name} (uuid: ${created.uuid})`);
  });

  test('UPDATE returns 200', async ({ authenticatedPage: page }) => {
    // Create a template to update
    const timestamp = Date.now();
    const createResp = await testCreate(page, 'templates', {
      name: `Update Test ${timestamp}`,
      type: 'account',
      text: 'Welcome {{first_name}} {{last_name}}',
      enabled: 'true'
    });

    if (createResp.status() !== 201) {
      console.log('Could not create template for update test, skipping');
      return;
    }

    const created = await createResp.json();

    // Update the template
    const newName = `Updated Template ${timestamp}`;
    const response = await testUpdate(page, 'templates', created.uuid, {
      name: newName,
      text: 'Updated: Welcome {{first_name}}!',
      enabled: 'false'
    });

    expect(response.status()).toBe(200);

    const updated = await response.json();
    expect(updated.name).toBe(newName);
    expect(updated.text).toContain('Updated:');
    console.log(`UPDATE template: ${created.name} -> ${updated.name}`);

    // Clean up
    await testDelete(page, 'templates', created.uuid);
  });

  test('DELETE returns 200', async ({ authenticatedPage: page }) => {
    // Create a template to delete
    const timestamp = Date.now();
    const createResp = await testCreate(page, 'templates', {
      name: `Delete Test ${timestamp}`,
      type: 'sms',
      text: 'Temp template for delete test',
      enabled: 'true'
    });

    if (createResp.status() !== 201) {
      console.log('Could not create template for delete test, skipping');
      return;
    }

    const created = await createResp.json();
    const response = await testDelete(page, 'templates', created.uuid);

    expect([200, 204]).toContain(response.status());
    console.log(`DELETE template: ${created.uuid}`);
  });

  test('Page loads', async ({ authenticatedPage: page }) => {
    const timeout = process.env.CI ? 30000 : 15000;
    await page.goto('/templates', { waitUntil: 'domcontentloaded', timeout });
    expect(page.url()).toContain('/templates');
    console.log('Templates page loaded');
  });
});
