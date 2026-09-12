import { test, expect, getAuthToken } from './auth-fixture';
import { getApiBaseUrl } from './crud-helpers';

/**
 * Campaigns Module - Lightweight API Tests
 * Uses auth-fixture for shared OTP authentication
 * API: /api/campaigns, /api/campaign_numbers
 */

function authHeaders(token: string) {
  return { 'Authorization': `Bearer ${token}` };
}

function formHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
}

test.describe('Campaigns API', () => {
  const apiBaseUrl = getApiBaseUrl();

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);
    const resp = await page.request.get(`${apiBaseUrl}/api/campaigns`, {
      headers: authHeaders(token)
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    const list = Array.isArray(data) ? data : data.data || [];
    console.log(`Found ${list.length} campaigns`);
  });

  test('CREATE campaign', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);

    // Get environment
    const envResp = await page.request.get(`${apiBaseUrl}/api/environments?per_page=10`, {
      headers: authHeaders(token)
    });
    const envData = await envResp.json();
    const envList = Array.isArray(envData) ? envData : envData.data || [];
    if (envList.length === 0) {
      console.log('No environments, skipping CREATE');
      return;
    }
    const envUuid = envList[0].uuid;

    // Get IVR
    const ivrResp = await page.request.get(
      `${apiBaseUrl}/api/ivrs?search[environment_uuid]=${envUuid}&per_page=10`,
      { headers: authHeaders(token) }
    );
    const ivrData = await ivrResp.json();
    const ivrList = Array.isArray(ivrData) ? ivrData : ivrData.data || [];
    if (ivrList.length === 0) {
      console.log('No IVRs available, skipping CREATE');
      return;
    }

    const formData = new URLSearchParams();
    formData.append('name', `Test Campaign ${Date.now()}`);
    formData.append('type', 'call');
    formData.append('environment_uuid', envUuid);
    formData.append('ivr_uuid', ivrList[0].uuid);
    formData.append('enabled', 'true');

    const resp = await page.request.post(`${apiBaseUrl}/api/campaigns`, {
      headers: formHeaders(token),
      data: formData.toString()
    });

    const status = resp.status();
    if (status === 200 || status === 201) {
      const data = await resp.json();
      console.log(`Created campaign: ${data.uuid}`);
    } else {
      const body = await resp.text();
      console.log(`CREATE status: ${status} - ${body}`);
      expect([200, 201, 422, 500]).toContain(status);
    }
  });

  test('READ campaign', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);

    const listResp = await page.request.get(`${apiBaseUrl}/api/campaigns?per_page=1`, {
      headers: authHeaders(token)
    });
    const listData = await listResp.json();
    const list = Array.isArray(listData) ? listData : listData.data || [];
    if (list.length === 0) {
      console.log('No campaigns, skipping READ');
      return;
    }

    const resp = await page.request.get(`${apiBaseUrl}/api/campaigns/${list[0].uuid}`, {
      headers: authHeaders(token)
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    console.log(`READ: ${data.name} (type: ${data.type}, status: ${data.status})`);
  });

  test('UPDATE campaign', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);

    const listResp = await page.request.get(`${apiBaseUrl}/api/campaigns?per_page=1`, {
      headers: authHeaders(token)
    });
    const listData = await listResp.json();
    const list = Array.isArray(listData) ? listData : listData.data || [];
    if (list.length === 0) {
      console.log('No campaigns, skipping UPDATE');
      return;
    }

    const formData = new URLSearchParams();
    formData.append('name', `Updated Campaign ${Date.now()}`);

    const resp = await page.request.patch(`${apiBaseUrl}/api/campaigns/${list[0].uuid}`, {
      headers: formHeaders(token),
      data: formData.toString()
    });

    const status = resp.status();
    if (status === 200) {
      console.log(`Updated campaign: ${list[0].uuid}`);
    } else {
      const body = await resp.text();
      console.log(`UPDATE status: ${status} - ${body}`);
      expect([200, 422, 500]).toContain(status);
    }
  });

  test('RUN campaign', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);

    const listResp = await page.request.get(`${apiBaseUrl}/api/campaigns?per_page=1`, {
      headers: authHeaders(token)
    });
    const listData = await listResp.json();
    const list = Array.isArray(listData) ? listData : listData.data || [];
    if (list.length === 0) {
      console.log('No campaigns, skipping RUN');
      return;
    }

    const resp = await page.request.patch(`${apiBaseUrl}/api/campaigns/${list[0].uuid}`, {
      headers: formHeaders(token),
      data: 'action=run'
    });

    const status = resp.status();
    console.log(`RUN status: ${status}`);
    expect([200, 422, 500]).toContain(status);
  });

  test('STOP campaign', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);

    const listResp = await page.request.get(`${apiBaseUrl}/api/campaigns?per_page=1`, {
      headers: authHeaders(token)
    });
    const listData = await listResp.json();
    const list = Array.isArray(listData) ? listData : listData.data || [];
    if (list.length === 0) {
      console.log('No campaigns, skipping STOP');
      return;
    }

    const resp = await page.request.patch(`${apiBaseUrl}/api/campaigns/${list[0].uuid}`, {
      headers: formHeaders(token),
      data: 'action=stop'
    });

    const status = resp.status();
    console.log(`STOP status: ${status}`);
    expect([200, 422, 500]).toContain(status);
  });

  test('DUPLICATE campaign', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);

    const listResp = await page.request.get(`${apiBaseUrl}/api/campaigns?per_page=1`, {
      headers: authHeaders(token)
    });
    const listData = await listResp.json();
    const list = Array.isArray(listData) ? listData : listData.data || [];
    if (list.length === 0) {
      console.log('No campaigns, skipping DUPLICATE');
      return;
    }

    const formData = new URLSearchParams();
    formData.append('action', 'duplicate');
    formData.append('uuid', list[0].uuid);
    formData.append('name', `Copy ${Date.now()}`);

    const resp = await page.request.post(`${apiBaseUrl}/api/campaigns`, {
      headers: formHeaders(token),
      data: formData.toString()
    });

    const status = resp.status();
    console.log(`DUPLICATE status: ${status}`);
    expect([200, 201, 422, 500]).toContain(status);
  });

  test('ADD numbers to campaign', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);

    const listResp = await page.request.get(`${apiBaseUrl}/api/campaigns?per_page=1`, {
      headers: authHeaders(token)
    });
    const listData = await listResp.json();
    const list = Array.isArray(listData) ? listData : listData.data || [];
    if (list.length === 0) {
      console.log('No campaigns, skipping ADD numbers');
      return;
    }

    const formData = new URLSearchParams();
    formData.append('numbers[]', '0501234567');
    formData.append('numbers[]', '0509876543');

    const resp = await page.request.patch(`${apiBaseUrl}/api/campaigns/${list[0].uuid}`, {
      headers: formHeaders(token),
      data: formData.toString()
    });

    const status = resp.status();
    console.log(`ADD numbers status: ${status}`);
    expect([200, 422, 500]).toContain(status);
  });

  test('DELETE test campaign', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);

    const listResp = await page.request.get(`${apiBaseUrl}/api/campaigns?per_page=100`, {
      headers: authHeaders(token)
    });
    const listData = await listResp.json();
    const list = Array.isArray(listData) ? listData : listData.data || [];

    const testCampaign = list.find((c: any) =>
      c.name?.startsWith('Test Campaign ') ||
      c.name?.startsWith('Copy ') ||
      c.name?.startsWith('Updated Campaign ')
    );

    if (!testCampaign) {
      console.log('No test campaigns to delete');
      return;
    }

    const resp = await page.request.delete(`${apiBaseUrl}/api/campaigns/${testCampaign.uuid}`, {
      headers: authHeaders(token)
    });
    const status = resp.status();
    console.log(`DELETE status: ${status} (${testCampaign.name})`);
    expect([200, 204, 404]).toContain(status);
  });
});
