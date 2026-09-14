import { test, expect } from './auth-fixture';
import { testList, testRead, testCreate, testUpdate, testDelete, getFirstItem, getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * VML (Voice Markup Language) Module - Full CRUD Tests
 * API: /api/vmls
 * Tests: LIST, READ, CREATE, UPDATE, DELETE
 */

test.describe('VML CRUD', () => {
  test.setTimeout(60000);

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const response = await testList(page, 'vmls');
    expect(response.status()).toBe(200);

    const data = await response.json();
    const list = Array.isArray(data) ? data : data.data || [];
    console.log(`Found ${list.length} VMLs`);
  });

  test('READ returns 200', async ({ authenticatedPage: page }) => {
    const vml = await getFirstItem(page, 'vmls');
    if (!vml) {
      console.log('No VMLs available, skipping READ');
      return;
    }

    const response = await testRead(page, 'vmls', vml.uuid);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.uuid).toBe(vml.uuid);
    console.log(`READ VML: ${data.name}`);
  });

  test('Full CRUD cycle', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Get environment for create
    const envResponse = await page.request.get(`${apiBaseUrl}/api/applications?per_page=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(envResponse.status()).toBe(200);
    const envs = await envResponse.json();
    const envUuid = envs[0]?.uuid;

    if (!envUuid) {
      console.log('No environments available, skipping CRUD cycle');
      return;
    }

    const timestamp = Date.now();
    const vmlScript = '<vml><say>Test VML script</say></vml>';

    // CREATE
    const createResponse = await testCreate(page, 'vmls', {
      name: `Test_VML_${timestamp}`,
      environment_uuid: envUuid,
      enabled: 'true',
      vml: vmlScript
    });

    const createStatus = createResponse.status();
    expect([200, 201]).toContain(createStatus);

    const created = await createResponse.json();
    console.log(`Created VML: ${created.name} (${created.uuid})`);

    // READ
    const readResponse = await testRead(page, 'vmls', created.uuid);
    expect(readResponse.status()).toBe(200);

    // UPDATE
    const updateResponse = await testUpdate(page, 'vmls', created.uuid, {
      name: `Updated_VML_${timestamp}`
    });
    expect(updateResponse.status()).toBe(200);
    console.log(`Updated VML: ${created.uuid}`);

    // DELETE
    const deleteResponse = await testDelete(page, 'vmls', created.uuid);
    expect(deleteResponse.status()).toBe(200);
    console.log(`Deleted VML: ${created.uuid}`);

    console.log('VML Full CRUD cycle complete');
  });
});
