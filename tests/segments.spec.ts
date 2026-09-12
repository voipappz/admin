import { test, expect, getAuthToken } from './auth-fixture';
import { getApiBaseUrl } from './crud-helpers';

/**
 * Segments CRUD Tests
 * Tests the standalone Segment API: create -> read -> update -> delete
 *
 * Segments define matching rules used by Call Conditions, Campaigns, Reports, etc.
 * Each segment has: name, field, operator, value (array), optional type/notes.
 *
 * API Endpoints:
 * - GET    /api/segments          - List (paginated)
 * - GET    /api/segments/:uuid    - Show
 * - POST   /api/segments          - Create
 * - PATCH  /api/segments/:uuid    - Update
 * - DELETE /api/segments/:uuid    - Delete
 */

test.describe('Segments CRUD', () => {
  const apiBaseUrl = getApiBaseUrl();

  function authHeaders(token: string) {
    return { 'Authorization': `Bearer ${token}` };
  }

  function formHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    };
  }

  test('LIST segments returns 200', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/segments?per_page=5`, {
      headers: authHeaders(token)
    });

    console.log('LIST Status:', response.status());
    expect(response.status()).toBe(200);

    const data = await response.json();
    console.log('Segments count:', Array.isArray(data) ? data.length : 'N/A');
    expect(Array.isArray(data)).toBe(true);

    // Verify segment object shape if any exist
    if (data.length > 0) {
      const seg = data[0];
      expect(seg).toHaveProperty('uuid');
      expect(seg).toHaveProperty('field');
      expect(seg).toHaveProperty('operator');
      expect(seg).toHaveProperty('value');
      console.log('Sample segment:', seg.uuid, seg.field, seg.operator, JSON.stringify(seg.value));
    }
  });

  test('CREATE -> READ -> UPDATE -> DELETE full cycle', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000);
    const token = await getAuthToken(page);
    expect(token).toBeTruthy();

    // ===== CREATE =====
    console.log('\n--- CREATE ---');
    const testName = `Test-Seg-${Date.now()}`;
    const createData = new URLSearchParams();
    createData.append('name', testName);
    createData.append('field', 'time.hour');
    createData.append('operator', 'BETWEEN');
    createData.append('value[]', '9');
    createData.append('value[]', '17');
    createData.append('type', 'time');
    createData.append('notes', 'CI test segment - business hours');

    const createResponse = await page.request.post(`${apiBaseUrl}/api/segments`, {
      headers: formHeaders(token),
      data: createData.toString()
    });

    console.log('CREATE Status:', createResponse.status());
    expect(createResponse.status()).toBe(201);

    const created = await createResponse.json();
    const segUuid = created.uuid;
    expect(segUuid).toBeTruthy();
    expect(created.name).toBe(testName);
    expect(created.field).toBe('time.hour');
    expect(created.operator).toBe('BETWEEN');
    expect(created.value).toEqual(['9', '17']);
    expect(created.type).toBe('time');
    console.log('Created UUID:', segUuid);

    // ===== READ =====
    console.log('\n--- READ ---');
    const readResponse = await page.request.get(`${apiBaseUrl}/api/segments/${segUuid}`, {
      headers: authHeaders(token)
    });
    expect(readResponse.status()).toBe(200);

    const readData = await readResponse.json();
    expect(readData.uuid).toBe(segUuid);
    expect(readData.name).toBe(testName);
    expect(readData.field).toBe('time.hour');
    expect(readData.operator).toBe('BETWEEN');
    expect(readData.value).toEqual(['9', '17']);
    console.log('Read verified:', readData.name);

    // ===== UPDATE =====
    console.log('\n--- UPDATE ---');
    const updatedName = `${testName}-Updated`;
    const updateData = new URLSearchParams();
    updateData.append('name', updatedName);
    updateData.append('operator', 'IN');
    updateData.append('value[]', '9');
    updateData.append('value[]', '10');
    updateData.append('value[]', '11');
    updateData.append('notes', 'Updated by CI test');

    const updateResponse = await page.request.patch(`${apiBaseUrl}/api/segments/${segUuid}`, {
      headers: formHeaders(token),
      data: updateData.toString()
    });

    console.log('UPDATE Status:', updateResponse.status());
    expect(updateResponse.status()).toBe(200);

    const updated = await updateResponse.json();
    expect(updated.name).toBe(updatedName);
    expect(updated.operator).toBe('IN');
    console.log('Update verified - name:', updated.name, 'operator:', updated.operator);

    // Re-read to confirm persistence (GET returns proper JSON array for value)
    const reReadResponse = await page.request.get(`${apiBaseUrl}/api/segments/${segUuid}`, {
      headers: authHeaders(token)
    });
    expect(reReadResponse.status()).toBe(200);
    const reReadData = await reReadResponse.json();
    expect(reReadData.name).toBe(updatedName);
    expect(reReadData.operator).toBe('IN');
    expect(reReadData.value).toEqual(['9', '10', '11']);
    console.log('Re-read confirmed');

    // ===== DELETE =====
    console.log('\n--- DELETE ---');
    const deleteResponse = await page.request.delete(`${apiBaseUrl}/api/segments/${segUuid}`, {
      headers: authHeaders(token)
    });
    console.log('DELETE Status:', deleteResponse.status());
    expect(deleteResponse.status()).toBe(200);

    // Verify deletion (should return 404)
    const verifyResponse = await page.request.get(`${apiBaseUrl}/api/segments/${segUuid}`, {
      headers: authHeaders(token)
    });
    expect(verifyResponse.status()).toBe(404);
    console.log('Deletion verified (404 on re-read)');

    console.log('\nFull CRUD cycle PASSED');
  });

  test('CREATE caller ID segment with IS operator', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000);
    const token = await getAuthToken(page);

    const testName = `Test-CallerID-${Date.now()}`;
    const createData = new URLSearchParams();
    createData.append('name', testName);
    createData.append('field', 'call.caller');
    createData.append('operator', 'IS');
    createData.append('value[]', '+1234567890');
    createData.append('type', 'time');

    const createResponse = await page.request.post(`${apiBaseUrl}/api/segments`, {
      headers: formHeaders(token),
      data: createData.toString()
    });

    console.log('CREATE caller IS Status:', createResponse.status());
    expect(createResponse.status()).toBe(201);

    const created = await createResponse.json();
    expect(created.field).toBe('call.caller');
    expect(created.operator).toBe('IS');
    expect(created.value).toEqual(['+1234567890']);
    console.log('Caller ID IS segment created:', created.uuid);

    // Cleanup
    const delResp = await page.request.delete(`${apiBaseUrl}/api/segments/${created.uuid}`, {
      headers: authHeaders(token)
    });
    expect(delResp.status()).toBe(200);
    console.log('Cleanup done');
  });

  test('CREATE destination segment with PREFIX operator', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000);
    const token = await getAuthToken(page);

    const testName = `Test-DestPrefix-${Date.now()}`;
    const createData = new URLSearchParams();
    createData.append('name', testName);
    createData.append('field', 'call.destination');
    createData.append('operator', 'PREFIX');
    createData.append('value[]', '+44');
    createData.append('type', 'time');

    const createResponse = await page.request.post(`${apiBaseUrl}/api/segments`, {
      headers: formHeaders(token),
      data: createData.toString()
    });

    console.log('CREATE destination PREFIX Status:', createResponse.status());
    expect(createResponse.status()).toBe(201);

    const created = await createResponse.json();
    expect(created.field).toBe('call.destination');
    expect(created.operator).toBe('PREFIX');
    expect(created.value).toEqual(['+44']);
    console.log('Destination PREFIX segment created:', created.uuid);

    // Cleanup
    const delResp = await page.request.delete(`${apiBaseUrl}/api/segments/${created.uuid}`, {
      headers: authHeaders(token)
    });
    expect(delResp.status()).toBe(200);
    console.log('Cleanup done');
  });

  test('CREATE weekday IN segment', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000);
    const token = await getAuthToken(page);

    const testName = `Test-Weekdays-${Date.now()}`;
    const createData = new URLSearchParams();
    createData.append('name', testName);
    createData.append('field', 'time.weekday');
    createData.append('operator', 'IN');
    createData.append('value[]', '1');
    createData.append('value[]', '2');
    createData.append('value[]', '3');
    createData.append('value[]', '4');
    createData.append('value[]', '5');
    createData.append('type', 'time');

    const createResponse = await page.request.post(`${apiBaseUrl}/api/segments`, {
      headers: formHeaders(token),
      data: createData.toString()
    });

    console.log('CREATE weekday IN Status:', createResponse.status());
    expect(createResponse.status()).toBe(201);

    const created = await createResponse.json();
    expect(created.field).toBe('time.weekday');
    expect(created.operator).toBe('IN');
    expect(created.value).toEqual(['1', '2', '3', '4', '5']);
    console.log('Weekday IN segment created:', created.uuid);

    // Cleanup
    const delResp = await page.request.delete(`${apiBaseUrl}/api/segments/${created.uuid}`, {
      headers: authHeaders(token)
    });
    expect(delResp.status()).toBe(200);
    console.log('Cleanup done');
  });

  test('CREATE caller NOT_IN segment (multiple values)', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000);
    const token = await getAuthToken(page);

    const testName = `Test-CallerNotIn-${Date.now()}`;
    const createData = new URLSearchParams();
    createData.append('name', testName);
    createData.append('field', 'call.caller');
    createData.append('operator', 'NOT_IN');
    createData.append('value[]', '+1111111111');
    createData.append('value[]', '+2222222222');
    createData.append('value[]', '+3333333333');

    const createResponse = await page.request.post(`${apiBaseUrl}/api/segments`, {
      headers: formHeaders(token),
      data: createData.toString()
    });

    console.log('CREATE caller NOT_IN Status:', createResponse.status());
    expect(createResponse.status()).toBe(201);

    const created = await createResponse.json();
    expect(created.field).toBe('call.caller');
    expect(created.operator).toBe('NOT_IN');
    expect(created.value).toHaveLength(3);
    console.log('Caller NOT_IN segment created:', created.uuid);

    // Cleanup
    const delResp = await page.request.delete(`${apiBaseUrl}/api/segments/${created.uuid}`, {
      headers: authHeaders(token)
    });
    expect(delResp.status()).toBe(200);
    console.log('Cleanup done');
  });

  test('LIST with search filter', async ({ authenticatedPage: page }) => {
    test.setTimeout(60000);
    const token = await getAuthToken(page);

    // Create a segment to search for
    const testName = `SearchTest-${Date.now()}`;
    const createData = new URLSearchParams();
    createData.append('name', testName);
    createData.append('field', 'time.hour');
    createData.append('operator', 'IS');
    createData.append('value[]', '12');

    const createResp = await page.request.post(`${apiBaseUrl}/api/segments`, {
      headers: formHeaders(token),
      data: createData.toString()
    });
    expect(createResp.status()).toBe(201);
    const created = await createResp.json();

    // Search by name
    const searchResp = await page.request.get(
      `${apiBaseUrl}/api/segments?per_page=10&search[name]=${encodeURIComponent(testName)}`,
      { headers: authHeaders(token) }
    );
    expect(searchResp.status()).toBe(200);

    const results = await searchResp.json();
    console.log('Search results for', testName, ':', results.length);
    expect(Array.isArray(results)).toBe(true);
    // Should find our segment
    const found = results.find((s: any) => s.uuid === created.uuid);
    expect(found).toBeTruthy();
    console.log('Search filter verified');

    // Cleanup
    const delResp = await page.request.delete(`${apiBaseUrl}/api/segments/${created.uuid}`, {
      headers: authHeaders(token)
    });
    expect(delResp.status()).toBe(200);
  });
});
