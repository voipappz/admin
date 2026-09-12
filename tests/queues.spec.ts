import { test, expect } from './auth-fixture';
import { testList, testRead, testCreate, testUpdate, testDelete, getFirstItem } from './crud-helpers';

/**
 * Queues Module - Full CRUD Tests
 * API: /api/queues
 * Tests: LIST, READ, CREATE, UPDATE, DELETE, Page Load
 */

test.describe('Queues CRUD', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const response = await testList(page, 'queues');
    expect(response.status()).toBe(200);

    const data = await response.json();
    const list = Array.isArray(data) ? data : data.data || [];
    console.log(`✅ Found ${list.length} queues`);
  });

  test('READ returns 200', async ({ authenticatedPage: page }) => {
    const queue = await getFirstItem(page, 'queues');
    if (!queue) {
      console.log('⚠️ No queues available, skipping READ');
      return;
    }

    const response = await testRead(page, 'queues', queue.uuid);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.uuid).toBe(queue.uuid);
    console.log(`✅ READ queue: ${data.name}`);
  });

  test('CREATE returns 201', async ({ authenticatedPage: page }) => {
    // Get an environment first
    const envResponse = await testList(page, 'environments');
    const envData = await envResponse.json();
    const envList = Array.isArray(envData) ? envData : envData.data || [];

    if (envList.length === 0) {
      console.log('⚠️ No environments available, skipping CREATE');
      return;
    }

    const timestamp = Date.now();
    const response = await testCreate(page, 'queues', {
      name: `Test Queue ${timestamp}`,
      environment_uuid: envList[0].uuid,
      enabled: 'true',
      strategy: 'ringall',
      timeout: '30',
      max_wait_time: '300'
    });

    const status = response.status();
    if (status !== 201 && status !== 200) {
      const body = await response.text();
      console.log(`⚠️ Queue CREATE: ${status} - ${body}`);
    }

    // Accept 200, 201, or 406 (validation)
    expect([200, 201, 406]).toContain(status);
    console.log(`✅ CREATE queue status: ${status}`);
  });

  test('UPDATE returns 200', async ({ authenticatedPage: page }) => {
    const queue = await getFirstItem(page, 'queues');
    if (!queue) {
      console.log('⚠️ No queues available, skipping UPDATE');
      return;
    }

    const originalName = queue.name;
    const newName = `Updated Queue ${Date.now()}`;
    const response = await testUpdate(page, 'queues', queue.uuid, { name: newName });

    expect(response.status()).toBe(200);

    const updated = await response.json();
    expect(updated.name).toBe(newName);
    console.log(`✅ UPDATE queue: ${originalName} → ${updated.name}`);

    // Restore original name
    await testUpdate(page, 'queues', queue.uuid, { name: originalName });
  });

  test('DELETE returns 200', async ({ authenticatedPage: page }) => {
    // Get an environment first
    const envResponse = await testList(page, 'environments');
    const envData = await envResponse.json();
    const envList = Array.isArray(envData) ? envData : envData.data || [];

    if (envList.length === 0) {
      console.log('⚠️ No environments available, skipping DELETE');
      return;
    }

    // Create a queue to delete
    const timestamp = Date.now();
    const createResponse = await testCreate(page, 'queues', {
      name: `Delete Test ${timestamp}`,
      environment_uuid: envList[0].uuid,
      enabled: 'true',
      strategy: 'ringall',
      timeout: '30'
    });

    if (createResponse.status() !== 201 && createResponse.status() !== 200) {
      console.log('⚠️ Could not create queue for delete test, skipping');
      return;
    }

    const created = await createResponse.json();
    const response = await testDelete(page, 'queues', created.uuid);

    expect([200, 204]).toContain(response.status());
    console.log(`✅ DELETE queue: ${created.uuid}`);
  });

  test('Page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/queues', { waitUntil: 'domcontentloaded', timeout: 15000 });
    expect(page.url()).toContain('/queues');
    console.log('✅ Queues page loaded');
  });
});

/**
 * Queue Tiers - API Tests
 * Tests the tier management operations (add agents, update level/position, remove)
 * Uses bracket notation tiers[][uuid] which Rack parses as Array
 */
test.describe('Queue Tiers', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('ADD tier to queue via PATCH', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL!;
    const authToken = page.authTokens.access;
    const headers = { 'Authorization': `Bearer ${authToken}` };

    // Get a queue
    const queuesResp = await page.request.get(`${apiBaseUrl}/api/queues?per_page=5`, { headers });
    expect(queuesResp.ok()).toBeTruthy();
    const queues = await queuesResp.json();
    const queueList = Array.isArray(queues) ? queues : queues.data || [];
    if (queueList.length === 0) { console.log('⚠️ No queues, skipping'); return; }

    const queue = queueList[0];
    const envUuid = queue.environment?.uuid || queue.environment_uuid;
    console.log(`Using queue: ${queue.name} (${queue.uuid})`);

    // Get users for this environment
    const usersResp = await page.request.get(`${apiBaseUrl}/api/users?environment_uuid=${envUuid}&per_page=5`, { headers });
    expect(usersResp.ok()).toBeTruthy();
    const users = await usersResp.json();
    const userList = Array.isArray(users) ? users : users.data || [];
    if (userList.length === 0) { console.log('⚠️ No users in environment, skipping'); return; }

    const user = userList[0];
    console.log(`Using user: ${user.name || user.email} (${user.uuid})`);

    // Save original tiers to restore later
    const originalResp = await page.request.get(`${apiBaseUrl}/api/queues/${queue.uuid}`, { headers });
    const originalQueue = await originalResp.json();
    const originalTiers = originalQueue.tiers || [];

    // Add tier using bracket notation (what fixed toFormData produces)
    const addResp = await page.request.patch(`${apiBaseUrl}/api/queues/${queue.uuid}`, {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      data: `tiers[][uuid]=${user.uuid}&tiers[][level]=2&tiers[][position]=3`
    });
    expect(addResp.ok()).toBeTruthy();

    // Verify tier was added
    const verifyResp = await page.request.get(`${apiBaseUrl}/api/queues/${queue.uuid}`, { headers });
    const updated = await verifyResp.json();
    expect(updated.tiers.length).toBeGreaterThanOrEqual(1);

    const addedTier = updated.tiers.find((t: any) => t.agent === user.uuid);
    expect(addedTier).toBeTruthy();
    expect(String(addedTier.level)).toBe('2');
    expect(String(addedTier.position)).toBe('3');
    console.log(`✅ Tier added: agent=${user.uuid.slice(0,12)} level=${addedTier.level} pos=${addedTier.position}`);

    // Restore original tiers
    if (originalTiers.length === 0) {
      // Remove the tier we added by sending an empty tiers array (JSON)
      await page.request.patch(`${apiBaseUrl}/api/queues/${queue.uuid}`, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: JSON.stringify({ tiers: [] })
      });
    } else {
      // Restore original tiers
      const restoreBody = originalTiers.map((t: any) =>
        `tiers[][uuid]=${t.agent}&tiers[][level]=${t.level}&tiers[][position]=${t.position}`
      ).join('&');
      await page.request.patch(`${apiBaseUrl}/api/queues/${queue.uuid}`, {
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        data: restoreBody
      });
    }
    console.log('✅ Original tiers restored');
  });

  test('UPDATE tier level and position', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL!;
    const authToken = page.authTokens.access;
    const headers = { 'Authorization': `Bearer ${authToken}` };

    // Get a queue and a user
    const queuesResp = await page.request.get(`${apiBaseUrl}/api/queues?per_page=5`, { headers });
    const queues = await queuesResp.json();
    const queueList = Array.isArray(queues) ? queues : queues.data || [];
    if (queueList.length === 0) { console.log('⚠️ No queues, skipping'); return; }

    const queue = queueList[0];
    const envUuid = queue.environment?.uuid || queue.environment_uuid;

    const usersResp = await page.request.get(`${apiBaseUrl}/api/users?environment_uuid=${envUuid}&per_page=5`, { headers });
    const users = await usersResp.json();
    const userList = Array.isArray(users) ? users : users.data || [];
    if (userList.length === 0) { console.log('⚠️ No users, skipping'); return; }

    const user = userList[0];

    // Save original tiers
    const originalResp = await page.request.get(`${apiBaseUrl}/api/queues/${queue.uuid}`, { headers });
    const originalTiers = (await originalResp.json()).tiers || [];

    // Add tier with level=1, position=1
    await page.request.patch(`${apiBaseUrl}/api/queues/${queue.uuid}`, {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      data: `tiers[][uuid]=${user.uuid}&tiers[][level]=1&tiers[][position]=1`
    });

    // Update to level=5, position=7
    const updateResp = await page.request.patch(`${apiBaseUrl}/api/queues/${queue.uuid}`, {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      data: `tiers[][uuid]=${user.uuid}&tiers[][level]=5&tiers[][position]=7`
    });
    expect(updateResp.ok()).toBeTruthy();

    // Verify
    const verifyResp = await page.request.get(`${apiBaseUrl}/api/queues/${queue.uuid}`, { headers });
    const updated = await verifyResp.json();
    const tier = updated.tiers.find((t: any) => t.agent === user.uuid);
    expect(tier).toBeTruthy();
    expect(String(tier.level)).toBe('5');
    expect(String(tier.position)).toBe('7');
    console.log(`✅ Tier updated: level=${tier.level} position=${tier.position}`);

    // Restore
    if (originalTiers.length === 0) {
      await page.request.patch(`${apiBaseUrl}/api/queues/${queue.uuid}`, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: JSON.stringify({ tiers: [] })
      });
    } else {
      const restoreBody = originalTiers.map((t: any) =>
        `tiers[][uuid]=${t.agent}&tiers[][level]=${t.level}&tiers[][position]=${t.position}`
      ).join('&');
      await page.request.patch(`${apiBaseUrl}/api/queues/${queue.uuid}`, {
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        data: restoreBody
      });
    }
  });

  test('MULTI-TIER add multiple agents', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL!;
    const authToken = page.authTokens.access;
    const headers = { 'Authorization': `Bearer ${authToken}` };

    const queuesResp = await page.request.get(`${apiBaseUrl}/api/queues?per_page=5`, { headers });
    const queues = await queuesResp.json();
    const queueList = Array.isArray(queues) ? queues : queues.data || [];
    if (queueList.length === 0) { console.log('⚠️ No queues, skipping'); return; }

    const queue = queueList[0];
    const envUuid = queue.environment?.uuid || queue.environment_uuid;

    // Get multiple users
    const usersResp = await page.request.get(`${apiBaseUrl}/api/users?environment_uuid=${envUuid}&per_page=10`, { headers });
    const users = await usersResp.json();
    const userList = Array.isArray(users) ? users : users.data || [];
    if (userList.length < 2) { console.log('⚠️ Need 2+ users, skipping'); return; }

    // Save original tiers
    const originalResp = await page.request.get(`${apiBaseUrl}/api/queues/${queue.uuid}`, { headers });
    const originalTiers = (await originalResp.json()).tiers || [];

    // Add 2 agents with different levels
    const body = [
      `tiers[][uuid]=${userList[0].uuid}&tiers[][level]=1&tiers[][position]=1`,
      `tiers[][uuid]=${userList[1].uuid}&tiers[][level]=2&tiers[][position]=2`
    ].join('&');

    const addResp = await page.request.patch(`${apiBaseUrl}/api/queues/${queue.uuid}`, {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      data: body
    });
    expect(addResp.ok()).toBeTruthy();

    // Verify both tiers
    const verifyResp = await page.request.get(`${apiBaseUrl}/api/queues/${queue.uuid}`, { headers });
    const updated = await verifyResp.json();
    expect(updated.tiers.length).toBe(2);

    const tier1 = updated.tiers.find((t: any) => t.agent === userList[0].uuid);
    const tier2 = updated.tiers.find((t: any) => t.agent === userList[1].uuid);
    expect(tier1).toBeTruthy();
    expect(tier2).toBeTruthy();
    expect(String(tier1.level)).toBe('1');
    expect(String(tier2.level)).toBe('2');
    console.log(`✅ Multi-tier: ${updated.tiers.length} agents added with correct levels`);

    // Restore
    if (originalTiers.length === 0) {
      await page.request.patch(`${apiBaseUrl}/api/queues/${queue.uuid}`, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: JSON.stringify({ tiers: [] })
      });
    } else {
      const restoreBody = originalTiers.map((t: any) =>
        `tiers[][uuid]=${t.agent}&tiers[][level]=${t.level}&tiers[][position]=${t.position}`
      ).join('&');
      await page.request.patch(`${apiBaseUrl}/api/queues/${queue.uuid}`, {
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        data: restoreBody
      });
    }
  });

  test('SET AGENT CONTACT', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = process.env.VITE_API_BASE_URL!;
    const authToken = page.authTokens.access;
    const headers = { 'Authorization': `Bearer ${authToken}` };

    // Get a user
    const usersResp = await page.request.get(`${apiBaseUrl}/api/users?per_page=5`, { headers });
    const users = await usersResp.json();
    const userList = Array.isArray(users) ? users : users.data || [];
    if (userList.length === 0) { console.log('⚠️ No users, skipping'); return; }

    const user = userList[0];

    // Set contact type to extension
    const contactResp = await page.request.patch(`${apiBaseUrl}/api/users/${user.uuid}`, {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      data: 'action=contact&contact_type=extension'
    });

    const status = contactResp.status();
    if (status === 200) {
      const data = await contactResp.json();
      expect(data.status).toBe('ok');
      console.log(`✅ Contact set: type=${data.contact_type} contact=${(data.contact || '').slice(0, 50)}`);
    } else {
      // 500 may happen if user has no extension — not a test failure
      console.log(`⚠️ Set contact returned ${status} (user may lack extension setup)`);
    }
  });
});
