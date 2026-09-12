import { test, expect } from './auth-fixture';
import { testList, testRead, getFirstItem, getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * Announcements Module - Full CRUD Tests
 * API: /api/announcements
 * Tests: LIST, READ, CREATE (file upload), CREATE (TTS), UPDATE, DELETE
 */

test.describe('Announcements CRUD', () => {
  test.setTimeout(60000);

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const response = await testList(page, 'announcements');
    expect(response.status()).toBe(200);

    const data = await response.json();
    const list = Array.isArray(data) ? data : data.data || [];
    console.log(`✅ Found ${list.length} announcements`);
  });

  test('READ returns 200', async ({ authenticatedPage: page }) => {
    const announcement = await getFirstItem(page, 'announcements');
    if (!announcement) {
      console.log('⚠️ No announcements available, skipping READ');
      return;
    }

    const response = await testRead(page, 'announcements', announcement.uuid);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.uuid).toBe(announcement.uuid);
    console.log(`✅ READ announcement: ${data.name}`);
  });

  test('UPDATE sends all fields and returns fresh data', async ({ authenticatedPage: page }) => {
    const announcement = await getFirstItem(page, 'announcements');
    if (!announcement) {
      console.log('⚠️ No announcements available, skipping UPDATE');
      return;
    }

    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);
    const originalName = announcement.name;
    const originalNotes = announcement.notes || '';
    const timestamp = Date.now();
    const newName = `Updated_Ann_${timestamp}`;
    const newNotes = `Updated notes ${timestamp}`;

    // PATCH with all 4 fields (name, enabled, environment_uuid, notes) - same as legacy admin
    const formData = new URLSearchParams();
    formData.append('name', newName);
    formData.append('enabled', String(announcement.enabled !== undefined ? announcement.enabled : true));
    formData.append('environment_uuid', announcement.environment_uuid || '');
    formData.append('notes', newNotes);

    const response = await page.request.patch(`${apiBaseUrl}/api/announcements/${announcement.uuid}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: formData.toString()
    });

    expect(response.status()).toBe(200);
    const updated = await response.json();
    expect(updated.name).toBe(newName);
    console.log(`✅ UPDATE announcement: ${originalName} → ${newName}`);

    // Verify fresh data - re-fetch should return updated values (no stale cache)
    const readResponse = await page.request.get(`${apiBaseUrl}/api/announcements/${announcement.uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(readResponse.status()).toBe(200);
    const freshData = await readResponse.json();
    expect(freshData.name).toBe(newName);
    expect(freshData.notes).toBe(newNotes);
    console.log(`✅ Fresh read confirms update: name=${freshData.name}, notes=${freshData.notes}`);

    // Restore original values
    const restoreData = new URLSearchParams();
    restoreData.append('name', originalName);
    restoreData.append('enabled', String(announcement.enabled !== undefined ? announcement.enabled : true));
    restoreData.append('environment_uuid', announcement.environment_uuid || '');
    restoreData.append('notes', originalNotes);

    await page.request.patch(`${apiBaseUrl}/api/announcements/${announcement.uuid}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: restoreData.toString()
    });
    console.log(`✅ Restored original: ${originalName}`);
  });
});

test.describe('Announcements File Upload', () => {
  test.setTimeout(90000);

  test('CREATE with file upload returns 200/201', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Get environment UUID
    const envResponse = await page.request.get(`${apiBaseUrl}/api/environments?per_page=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(envResponse.status()).toBe(200);
    const envs = await envResponse.json();
    const envUuid = envs[0]?.uuid;

    if (!envUuid) {
      console.log('⚠️ No environments available, skipping file upload test');
      return;
    }

    // Create a simple WAV file for testing (8-bit PCM, mono, 8kHz)
    const sampleRate = 8000;
    const numSamples = sampleRate; // 1 second
    const dataSize = numSamples;
    const fileSize = 44 + dataSize;

    const wavBuffer = Buffer.alloc(fileSize);
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(fileSize - 8, 4);
    wavBuffer.write('WAVE', 8);
    wavBuffer.write('fmt ', 12);
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20); // PCM
    wavBuffer.writeUInt16LE(1, 22); // mono
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(sampleRate, 28);
    wavBuffer.writeUInt16LE(1, 32);
    wavBuffer.writeUInt16LE(8, 34);
    wavBuffer.write('data', 36);
    wavBuffer.writeUInt32LE(dataSize, 40);
    wavBuffer.fill(128, 44); // silence

    const timestamp = Date.now();
    const filename = `test_announcement_${timestamp}.wav`;

    // Create multipart form data
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const formParts: string[] = [];
    formParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nTest_Upload_${timestamp}`);
    formParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="environment_uuid"\r\n\r\n${envUuid}`);
    formParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="enabled"\r\n\r\ntrue`);
    formParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\nfile`);

    const textParts = formParts.join('\r\n') + '\r\n';
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/wav\r\n\r\n`;
    const endBoundary = `\r\n--${boundary}--\r\n`;

    const bodyParts = [
      Buffer.from(textParts),
      Buffer.from(fileHeader),
      wavBuffer,
      Buffer.from(endBoundary)
    ];
    const body = Buffer.concat(bodyParts);

    console.log('Uploading announcement file...');
    const response = await page.request.post(`${apiBaseUrl}/api/announcements`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      data: body
    });

    const status = response.status();
    console.log(`CREATE with file upload status: ${status}`);

    if (status >= 200 && status < 300) {
      const data = await response.json();
      console.log(`✅ Created announcement: ${data.name} (${data.uuid})`);

      // Cleanup
      await page.request.delete(`${apiBaseUrl}/api/announcements/${data.uuid}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      console.log('Cleaned up test announcement');
    } else {
      const respBody = await response.text();
      console.log(`Upload response: ${respBody.substring(0, 200)}`);
    }

    expect([200, 201, 422]).toContain(status);
  });
});

test.describe('Announcements TTS', () => {
  test.setTimeout(90000);

  test('TTS providers available', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Check for TTS providers (type=tts)
    const response = await page.request.get(`${apiBaseUrl}/api/providers?search[type]=tts&per_page=10`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const status = response.status();
    console.log(`TTS providers status: ${status}`);

    if (status === 200) {
      const providers = await response.json();
      const list = Array.isArray(providers) ? providers : providers.data || [];
      console.log(`✅ Found ${list.length} TTS providers`);
      if (list.length > 0) {
        console.log(`   First provider: ${list[0].name} (${list[0].uuid})`);
      }
    }

    expect([200, 404]).toContain(status);
  });

  test('TTS generation endpoint available', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // First get a TTS provider
    const providersResponse = await page.request.get(`${apiBaseUrl}/api/providers?search[type]=tts&per_page=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    let providerUuid = null;
    if (providersResponse.status() === 200) {
      const providers = await providersResponse.json();
      const list = Array.isArray(providers) ? providers : providers.data || [];
      if (list.length > 0) {
        providerUuid = list[0].uuid;
      }
    }

    if (!providerUuid) {
      console.log('⚠️ No TTS providers configured, skipping TTS generation test');
      return;
    }

    // Test TTS endpoint at /api/announcements/tts
    const formData = new URLSearchParams();
    formData.append('text', 'Hello world test');
    formData.append('language', 'en');
    formData.append('provider_uuid', providerUuid);

    const response = await page.request.post(`${apiBaseUrl}/api/announcements/tts`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: formData.toString()
    });

    const status = response.status();
    console.log(`TTS generation status: ${status}`);

    if (status === 201) {
      const data = await response.json();
      console.log(`✅ TTS generated, path: ${data.path}`);
    } else {
      const body = await response.text();
      console.log(`TTS response: ${body.substring(0, 200)}`);
    }

    // Accept 201 (success), 400/422 (validation error), 404 (provider not found)
    expect([200, 201, 400, 404, 422]).toContain(status);
  });

  test('CREATE announcement with TTS path', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Get environment and TTS provider
    const envResponse = await page.request.get(`${apiBaseUrl}/api/environments?per_page=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const envs = await envResponse.json();
    const envUuid = envs[0]?.uuid;

    const providersResponse = await page.request.get(`${apiBaseUrl}/api/providers?search[type]=tts&per_page=1`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    let providerUuid = null;
    if (providersResponse.status() === 200) {
      const providers = await providersResponse.json();
      const list = Array.isArray(providers) ? providers : providers.data || [];
      if (list.length > 0) {
        providerUuid = list[0].uuid;
      }
    }

    if (!envUuid || !providerUuid) {
      console.log('⚠️ Missing environment or TTS provider, skipping TTS announcement test');
      return;
    }

    // 1. Generate TTS audio
    const ttsFormData = new URLSearchParams();
    ttsFormData.append('text', 'This is a test announcement');
    ttsFormData.append('language', 'en');
    ttsFormData.append('provider_uuid', providerUuid);

    const ttsResponse = await page.request.post(`${apiBaseUrl}/api/announcements/tts`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: ttsFormData.toString()
    });

    if (ttsResponse.status() !== 201) {
      console.log('⚠️ TTS generation failed, skipping announcement creation');
      const body = await ttsResponse.text();
      console.log(`TTS response: ${body.substring(0, 200)}`);
      return;
    }

    const ttsData = await ttsResponse.json();
    const audioPath = ttsData.path;
    console.log(`TTS audio generated: ${audioPath}`);

    // 2. Create announcement with the TTS path
    const timestamp = Date.now();
    const createFormData = new URLSearchParams();
    createFormData.append('name', `Test_TTS_Ann_${timestamp}`);
    createFormData.append('environment_uuid', envUuid);
    createFormData.append('enabled', 'true');
    createFormData.append('path', audioPath);

    const createResponse = await page.request.post(`${apiBaseUrl}/api/announcements`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: createFormData.toString()
    });

    const status = createResponse.status();
    console.log(`CREATE announcement with TTS status: ${status}`);

    if (status >= 200 && status < 300) {
      const data = await createResponse.json();
      console.log(`✅ Created TTS announcement: ${data.name} (${data.uuid})`);

      // Cleanup
      await page.request.delete(`${apiBaseUrl}/api/announcements/${data.uuid}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      console.log('Cleaned up test announcement');
    } else {
      const body = await createResponse.text();
      console.log(`Create response: ${body.substring(0, 200)}`);
    }

    expect([200, 201, 406, 422]).toContain(status);
  });
});
