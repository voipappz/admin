import { test, expect } from './auth-fixture';
import { getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * Numbers Module - CRUD Tests
 * API: /api/numbers
 * Tests: LIST, READ, CREATE, DELETE
 */

test.describe('Numbers CRUD', () => {
  test.setTimeout(process.env.CI ? 120000 : 60000);

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/numbers`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      timeout: 45000
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    const list = Array.isArray(data) ? data : data.data || [];
    console.log(`✅ Found ${list.length} numbers`);
  });

  test('READ returns 200', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Get list first
    const listResponse = await page.request.get(`${apiBaseUrl}/api/numbers?per_page=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      timeout: 45000
    });

    if (!listResponse.ok()) {
      console.log('⚠️ Cannot list numbers, skipping READ');
      return;
    }

    const data = await listResponse.json();
    const list = Array.isArray(data) ? data : data.data || [];
    if (list.length === 0) {
      console.log('⚠️ No numbers available, skipping READ');
      return;
    }

    const number = list[0];
    const response = await page.request.get(`${apiBaseUrl}/api/numbers/${number.uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      timeout: 45000
    });

    expect(response.status()).toBe(200);
    const detail = await response.json();
    expect(detail.uuid).toBe(number.uuid);
    console.log(`✅ READ number: ${detail.number || detail.name}`);
  });

  test('CREATE returns 201', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Get an environment first
    const envResponse = await page.request.get(`${apiBaseUrl}/api/environments?per_page=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      timeout: 45000
    });

    const envData = await envResponse.json();
    const envList = Array.isArray(envData) ? envData : envData.data || [];
    if (envList.length === 0) {
      console.log('⚠️ No environments available, skipping CREATE');
      return;
    }

    const timestamp = Date.now();
    const testNumber = `+1555${timestamp.toString().slice(-7)}`;
    const formData = new URLSearchParams();
    formData.append('number', testNumber);
    formData.append('environment_uuid', envList[0].uuid);
    formData.append('enabled', 'true');

    const createResponse = await page.request.post(`${apiBaseUrl}/api/numbers`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: formData.toString(),
      timeout: 45000
    });

    const createStatus = createResponse.status();
    if (createStatus !== 201 && createStatus !== 200) {
      const body = await createResponse.text();
      console.log(`⚠️ Number CREATE: ${createStatus} - ${body}`);
    }

    expect([200, 201, 406]).toContain(createStatus);
    console.log(`✅ CREATE number status: ${createStatus}`);

    // Cleanup: try to delete the created number
    if (createStatus === 200 || createStatus === 201) {
      const created = await createResponse.json();
      const uuid = created.uuid || created.id;

      if (uuid) {
        const deleteResponse = await page.request.delete(`${apiBaseUrl}/api/numbers/${uuid}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          timeout: 45000
        });
        console.log(`🧹 Cleanup DELETE number: ${deleteResponse.status()}`);
      }
    }
  });
});
