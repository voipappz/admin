import { test, expect } from './auth-fixture';
import { testCreate, testUpdate, testRead, testDelete, getApiBaseUrl, getAuthToken } from './crud-helpers';
import { randomUUID } from 'crypto';

/**
 * E2E gate for the transcription → cable pipeline (voipappz-api branch
 * feat/transcribe-cable-pipeline). Drives the admin's real API stack:
 *   - /api/workflows/node_types exposes the `cable_broadcast` (+ `ai_transcribe`) schemas
 *   - a workflow [start → ai_transcribe → cable_broadcast] saves + reads back intact
 *
 * SAFETY: only runs against a LOCAL api. nimbus-admin's default creds point at a
 * live customer instance (mtnunicom.mtn.com.gh) — this spec self-skips unless
 * VITE_API_BASE_URL targets localhost:5000, so it can never mutate a customer system.
 *
 * RED until the API branch with the cable_broadcast node is the running API; turns
 * GREEN once deployed. Mirror of the rspec E2E spec/pocketflow/e2e_transcribe_cable_spec.rb.
 */
const API = process.env.VITE_API_BASE_URL || '';
const IS_LOCAL = /\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(API);

test.describe('Transcribe → cable pipeline (admin → API)', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!IS_LOCAL, `requires a LOCAL api (VITE_API_BASE_URL=${API || 'unset'}); refusing to touch a remote/customer instance`);

  test('node_types exposes cable_broadcast + ai_transcribe schemas', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);
    const res = await page.request.get(`${getApiBaseUrl()}/api/workflows/node_types`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const types = await res.json();
    expect(types).toHaveProperty('ai_transcribe');
    expect(types).toHaveProperty('cable_broadcast');
    // self-describing schema the editor palette can render
    expect(types.cable_broadcast).toHaveProperty('fields');
    const fieldKeys = (types.cable_broadcast.fields || []).map((f: any) => f.key);
    expect(fieldKeys).toContain('action');
  });

  test('saves [start → ai_transcribe → cable_broadcast] and reads it back', async ({ authenticatedPage: page }) => {
    const name = `e2e-transcribe-cable-${randomUUID().slice(0, 8)}`;
    const created = await testCreate(page, 'workflows', { name, type: 'event', enabled: 'true' });
    expect(created.status()).toBe(201);
    const uuid = (await created.json()).uuid;

    const flow_data = JSON.stringify({
      nodes: [
        { id: 'start', type: 'start', data: {}, position: { x: 0, y: 0 } },
        { id: 'tr', type: 'ai_transcribe', position: { x: 200, y: 0 },
          data: { source: '{{event_data.recording_url}}', provider_uuid: 'STT_PROVIDER_UUID', language: 'he' } },
        { id: 'cb', type: 'cable_broadcast', position: { x: 400, y: 0 },
          data: { action: 'transcribe.done', language: 'he' } },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'tr', sourceHandle: 'default' },
        { id: 'e2', source: 'tr', target: 'cb', sourceHandle: 'done' },
      ],
    });

    const updated = await testUpdate(page, 'workflows', uuid, { flow_data });
    expect(updated.status()).toBe(200);

    const verify = await testRead(page, 'workflows', uuid);
    expect(verify.status()).toBe(200);
    const wf = await verify.json();
    expect(wf.flow_data.nodes.length).toBe(3);
    expect(wf.flow_data.edges.length).toBe(2);
    expect(wf.flow_data.nodes.map((n: any) => n.type)).toContain('cable_broadcast');

    await testDelete(page, 'workflows', uuid);
  });
});
