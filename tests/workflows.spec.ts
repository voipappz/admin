import { test, expect, getAuthToken } from './auth-fixture';
import { testList, testCreate, testUpdate, testDelete, testRead, getApiBaseUrl, buildFormData } from './crud-helpers';
import { randomUUID } from 'crypto';

/**
 * Workflows Module - Full CRUD Cycle Tests
 * API: /api/workflows
 * Tests: LIST, CREATE → READ → UPDATE → READ → DELETE → verify gone
 */

test.describe('Workflows CRUD', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(process.env.CI ? 90000 : 60000);

  test('LIST returns 200', async ({ authenticatedPage: page }) => {
    const response = await testList(page, 'workflows');
    expect(response.status()).toBe(200);
    const data = await response.json();
    const list = Array.isArray(data) ? data : data.data || [];
    console.log(`Found ${list.length} workflows`);
  });

  test('Full CRUD cycle: CREATE → READ → UPDATE → DELETE', async ({ authenticatedPage: page }) => {
    const typeUuid = randomUUID();
    const workflowName = `Test Workflow ${Date.now()}`;

    // 1. CREATE
    const createResponse = await testCreate(page, 'workflows', {
      name: workflowName,
      type: 'campaign',
      type_uuid: typeUuid,
      enabled: 'true',
      notes: 'Created by Playwright test',
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json();
    expect(created.name).toBe(workflowName);
    expect(created.type).toBe('campaign');
    const uuid = created.uuid;
    console.log(`Created workflow: ${uuid}`);

    // 2. READ — verify it exists
    const readResponse = await testRead(page, 'workflows', uuid);
    expect(readResponse.status()).toBe(200);
    const fetched = await readResponse.json();
    expect(fetched.uuid).toBe(uuid);
    expect(fetched.name).toBe(workflowName);
    console.log(`Read workflow: ${uuid}`);

    // 3. UPDATE — change name, notes, and add flow_data
    const updatedName = `Updated Workflow ${Date.now()}`;
    const flowData = JSON.stringify({
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start' } },
        { id: 'msg-1', type: 'message', position: { x: 300, y: 200 }, data: { label: 'Greet' } }
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'msg-1' }],
      settings: { flowType: 'ivr' }
    });

    const updateResponse = await testUpdate(page, 'workflows', uuid, {
      name: updatedName,
      notes: 'Updated by Playwright test',
      flow_data: flowData,
    });
    expect(updateResponse.status()).toBe(200);
    const updated = await updateResponse.json();
    expect(updated.name).toBe(updatedName);
    expect(updated.notes).toBe('Updated by Playwright test');
    expect(updated.flow_data).toBeTruthy();
    expect(updated.flow_data.nodes.length).toBe(2);
    expect(updated.flow_data.edges.length).toBe(1);
    console.log(`Updated workflow: ${uuid} — flow_data saved with ${updated.flow_data.nodes.length} nodes`);

    // 4. READ — verify update persisted
    const verifyResponse = await testRead(page, 'workflows', uuid);
    expect(verifyResponse.status()).toBe(200);
    const verified = await verifyResponse.json();
    expect(verified.name).toBe(updatedName);
    expect(verified.flow_data.nodes.length).toBe(2);
    console.log(`Verified update persisted for: ${uuid}`);

    // 5. DELETE
    const deleteResponse = await testDelete(page, 'workflows', uuid);
    expect(deleteResponse.status()).toBe(200);
    console.log(`Deleted workflow: ${uuid}`);

    // 6. Verify gone — should return 404
    const goneResponse = await testRead(page, 'workflows', uuid);
    expect(goneResponse.status()).toBe(404);
    console.log(`Confirmed deleted: ${uuid} returns 404`);
  });

  test('Page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/workflow', { waitUntil: 'domcontentloaded', timeout: 30000 });
    expect(page.url()).toContain('/workflow');
  });
});

/**
 * Node Types API — verify /api/workflows/node_types returns self-describing schemas
 */
test.describe('Node Types API', () => {
  test.setTimeout(process.env.CI ? 90000 : 60000);

  test('node_types endpoint returns registered nodes', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const response = await page.request.get(`${apiBaseUrl}/api/workflows/node_types`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();

    // Has key node types
    expect(body).toHaveProperty('webhook');
    expect(body).toHaveProperty('log');
    expect(body).toHaveProperty('start');

    // Webhook has correct schema shape
    expect(body.webhook).toHaveProperty('label');
    expect(body.webhook).toHaveProperty('fields');
    expect(body.webhook).toHaveProperty('outputs');
    expect(body.webhook.fields.length).toBeGreaterThanOrEqual(2);
    expect(body.webhook.outputs.length).toBeGreaterThanOrEqual(2);

    // Fields have key and label
    const urlField = body.webhook.fields.find((f: any) => f.key === 'url');
    expect(urlField).toBeTruthy();
    expect(urlField.label).toBeTruthy();

    // Outputs have handle and label
    const sentOutput = body.webhook.outputs.find((o: any) => o.handle === 'webhook_sent');
    expect(sentOutput).toBeTruthy();

    console.log(`✓ node_types returned ${Object.keys(body).length} registered types`);
    console.log(`  Types: ${Object.keys(body).join(', ')}`);
  });
});

/**
 * PocketFlow WebhookNode — E2E format validation
 * Verifies the admin's ReactFlow save format matches what the backend PocketFlow expects:
 *   node.data.url, node.data.method, node.data.fields → @node_data in Ruby
 */
test.describe('PocketFlow Webhook Format', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(process.env.CI ? 90000 : 60000);

  test('webhook node flow_data roundtrips correctly', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // Find an event service to link to
    const svcResp = await page.request.get(`${apiBaseUrl}/api/services?type=event`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const services = await svcResp.json();
    const serviceUuid = Array.isArray(services) && services.length > 0
      ? services[0].uuid
      : randomUUID();

    // CREATE workflow with webhook node — same format the admin ReactFlow builder saves
    const flowData = JSON.stringify({
      nodes: [
        {
          id: 'start-1', type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start', icon: 'play-circle', color: '#22c55e', flowName: 'webhook_test' }
        },
        {
          id: 'wh-1', type: 'webhook',
          position: { x: 300, y: 100 },
          data: {
            label: 'CRM Webhook', icon: 'link', color: '#ec4899',
            url: 'https://crm.example.com/events',
            method: 'post',
            fields: {
              status: 'event.name',
              caller_id: 'call.caller_id_number',
              agent: 'call.extension_username',
              direction: 'call.direction'
            }
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'wh-1', sourceHandle: 'next' }
      ],
      settings: { flowType: 'event' }
    });

    const createResp = await page.request.post(`${apiBaseUrl}/api/workflows`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: buildFormData({
        name: `PW-Webhook-${Date.now()}`,
        type: 'event',
        type_uuid: serviceUuid,
        enabled: 'true',
        flow_data: flowData,
      })
    });
    expect(createResp.status()).toBe(201);
    const created = await createResp.json();
    const uuid = created.uuid;
    console.log(`Created webhook workflow: ${uuid}`);

    // READ back and verify flow_data roundtrip
    const readResp = await page.request.get(`${apiBaseUrl}/api/workflows/${uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(readResp.status()).toBe(200);
    const wf = await readResp.json();

    const fd = typeof wf.flow_data === 'string' ? JSON.parse(wf.flow_data) : wf.flow_data;
    expect(fd.nodes).toHaveLength(2);
    expect(fd.edges).toHaveLength(1);

    // Verify webhook node data matches backend expected format
    const webhookNode = fd.nodes.find((n: any) => n.type === 'webhook');
    expect(webhookNode).toBeTruthy();
    expect(webhookNode.data.url).toBe('https://crm.example.com/events');
    expect(webhookNode.data.method).toBe('post');
    expect(webhookNode.data.fields).toEqual({
      status: 'event.name',
      caller_id: 'call.caller_id_number',
      agent: 'call.extension_username',
      direction: 'call.direction'
    });
    console.log('✓ Webhook node data roundtrips correctly (url, method, fields)');

    // Verify edge sourceHandle preserved
    expect(fd.edges[0].source).toBe('start-1');
    expect(fd.edges[0].target).toBe('wh-1');
    expect(fd.edges[0].sourceHandle).toBe('next');
    console.log('✓ Edge sourceHandle preserved');

    // Verify workflow metadata
    expect(wf.type).toBe('event');
    expect(wf.type_uuid).toBe(serviceUuid);
    console.log('✓ Workflow type=event, type_uuid links to service');

    // CLEANUP
    const delResp = await page.request.delete(`${apiBaseUrl}/api/workflows/${uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(delResp.status()).toBe(200);
    console.log(`Cleaned up: ${uuid}`);
  });

  test('webhook field mapping UPDATE roundtrips', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // CREATE with 2 fields
    const flowV1 = JSON.stringify({
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'wh-1', type: 'webhook', position: { x: 200, y: 0 }, data: {
          url: 'https://hooks.example.com/v1', method: 'post',
          fields: { status: 'event.name', caller: 'call.caller_id_number' }
        }}
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'wh-1', sourceHandle: 'next' }]
    });

    const createResp = await page.request.post(`${apiBaseUrl}/api/workflows`, {
      headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      data: buildFormData({ name: `PW-Fields-${Date.now()}`, type: 'campaign', type_uuid: randomUUID(), enabled: 'true', flow_data: flowV1 })
    });
    expect(createResp.status()).toBe(201);
    const uuid = (await createResp.json()).uuid;

    // UPDATE — add 4 more fields (simulates user editing in admin UI)
    const flowV2 = JSON.stringify({
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'wh-1', type: 'webhook', position: { x: 200, y: 0 }, data: {
          url: 'https://hooks.example.com/v2', method: 'post',
          fields: {
            status: 'event.name', caller: 'call.caller_id_number',
            agent: 'call.extension_username', direction: 'call.direction',
            duration: 'call.duration_time', queue: 'call.queue_name'
          }
        }}
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'wh-1', sourceHandle: 'next' }]
    });

    const updateResp = await page.request.patch(`${apiBaseUrl}/api/workflows/${uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      data: buildFormData({ flow_data: flowV2 })
    });
    expect(updateResp.status()).toBe(200);

    // READ — verify 6 fields and updated URL
    const readResp = await page.request.get(`${apiBaseUrl}/api/workflows/${uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const wf = await readResp.json();
    const fd = typeof wf.flow_data === 'string' ? JSON.parse(wf.flow_data) : wf.flow_data;
    const webhookNode = fd.nodes.find((n: any) => n.type === 'webhook');

    expect(webhookNode.data.url).toBe('https://hooks.example.com/v2');
    expect(Object.keys(webhookNode.data.fields)).toHaveLength(6);
    expect(webhookNode.data.fields.duration).toBe('call.duration_time');
    expect(webhookNode.data.fields.queue).toBe('call.queue_name');
    console.log('✓ Updated fields roundtrip correctly (6 fields)');

    // CLEANUP
    await page.request.delete(`${apiBaseUrl}/api/workflows/${uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
  });

  test('webhook with no fields sends raw event data', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // CREATE webhook with NO fields — backend should send generic body
    const flowData = JSON.stringify({
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { label: 'Start' } },
        { id: 'wh-1', type: 'webhook', position: { x: 200, y: 0 }, data: {
          url: 'https://analytics.example.com/events', method: 'post'
        }}
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'wh-1', sourceHandle: 'next' }]
    });

    const createResp = await page.request.post(`${apiBaseUrl}/api/workflows`, {
      headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      data: buildFormData({ name: `PW-NoFields-${Date.now()}`, type: 'campaign', type_uuid: randomUUID(), enabled: 'true', flow_data: flowData })
    });
    expect(createResp.status()).toBe(201);
    const uuid = (await createResp.json()).uuid;

    // READ — verify no fields key
    const readResp = await page.request.get(`${apiBaseUrl}/api/workflows/${uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const wf = await readResp.json();
    const fd = typeof wf.flow_data === 'string' ? JSON.parse(wf.flow_data) : wf.flow_data;
    const webhookNode = fd.nodes.find((n: any) => n.type === 'webhook');

    expect(webhookNode.data.url).toBe('https://analytics.example.com/events');
    expect(webhookNode.data.method).toBe('post');
    expect(webhookNode.data.fields).toBeUndefined();
    console.log('✓ Webhook without fields stored correctly (raw event mode)');

    // CLEANUP
    await page.request.delete(`${apiBaseUrl}/api/workflows/${uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
  });
});

/**
 * Real-world Workflow Creation — Service → Workflow → Webhook pipeline
 * Tests realistic use cases: CRM integration, analytics, Slack notifications
 */
test.describe('Workflow Creation — real-world examples', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(process.env.CI ? 90000 : 60000);

  // Shared: create or find an event service to link workflows to
  async function getOrCreateService(page: any) {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);
    const headers = { 'Authorization': `Bearer ${authToken}` };

    // Try to find existing event service
    const listResp = await page.request.get(`${apiBaseUrl}/api/services?type=event`, { headers });
    if (listResp.ok()) {
      const services = await listResp.json();
      const list = Array.isArray(services) ? services : services.data || [];
      if (list.length > 0) return { uuid: list[0].uuid, cleanup: false };
    }

    // Create one
    const createResp = await page.request.post(`${apiBaseUrl}/api/services`, {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      data: buildFormData({
        name: `PW-EventService-${Date.now()}`,
        type: 'event',
        enabled: 'true',
      })
    });
    if (createResp.status() === 201) {
      const svc = await createResp.json();
      return { uuid: svc.uuid, cleanup: true };
    }

    // Fallback
    return { uuid: randomUUID(), cleanup: false };
  }

  // Helper: create workflow linked to service, verify, cleanup
  async function createWorkflow(page: any, opts: {
    name: string, serviceUuid: string, nodes: any[], edges: any[]
  }) {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);
    const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/x-www-form-urlencoded' };

    const createResp = await page.request.post(`${apiBaseUrl}/api/workflows`, {
      headers,
      data: buildFormData({
        name: opts.name,
        type: 'event',
        type_uuid: opts.serviceUuid,
        enabled: 'true',
        flow_data: JSON.stringify({ nodes: opts.nodes, edges: opts.edges }),
      })
    });
    expect(createResp.status()).toBe(201);
    const created = await createResp.json();
    console.log(`Created workflow: ${created.uuid} (${opts.name})`);
    return created;
  }

  async function readWorkflow(page: any, uuid: string) {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);
    const resp = await page.request.get(`${apiBaseUrl}/api/workflows/${uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    expect(resp.status()).toBe(200);
    const wf = await resp.json();
    wf._fd = typeof wf.flow_data === 'string' ? JSON.parse(wf.flow_data) : wf.flow_data;
    return wf;
  }

  async function deleteWorkflow(page: any, uuid: string) {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);
    await page.request.delete(`${apiBaseUrl}/api/workflows/${uuid}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
  }

  test('CRM integration — push call events to Salesforce', async ({ authenticatedPage: page }) => {
    const svc = await getOrCreateService(page);

    const wf = await createWorkflow(page, {
      name: `CRM-Salesforce-${Date.now()}`,
      serviceUuid: svc.uuid,
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { flowName: 'salesforce_crm' } },
        { id: 'crm-wh', type: 'webhook', position: { x: 300, y: 0 }, data: {
          label: 'Push to Salesforce',
          url: 'https://hooks.salesforce.com/services/callcenter/events',
          method: 'post',
          fields: {
            event_type: 'event.name',
            caller_number: 'call.caller_id_number',
            agent_ext: 'call.extension_username',
            call_direction: 'call.direction',
            call_duration: 'call.duration_time',
            queue: 'call.queue_name',
            did: 'call.did_number',
            call_id: 'call.uuid'
          }
        }}
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'crm-wh', sourceHandle: 'default' }]
    });

    // Verify
    const read = await readWorkflow(page, wf.uuid);
    expect(read.type).toBe('event');
    expect(read.type_uuid).toBe(svc.uuid);
    const whNode = read._fd.nodes.find((n: any) => n.type === 'webhook');
    expect(whNode.data.url).toBe('https://hooks.salesforce.com/services/callcenter/events');
    expect(whNode.data.method).toBe('post');
    expect(Object.keys(whNode.data.fields)).toHaveLength(8);
    expect(whNode.data.fields.caller_number).toBe('call.caller_id_number');
    expect(whNode.data.fields.call_id).toBe('call.uuid');
    console.log('✓ CRM Salesforce workflow: 8 field mappings, linked to service');

    await deleteWorkflow(page, wf.uuid);
    if (svc.cleanup) await deleteWorkflow(page, svc.uuid);
  });

  test('Slack notification — alert on missed calls', async ({ authenticatedPage: page }) => {
    const svc = await getOrCreateService(page);

    const wf = await createWorkflow(page, {
      name: `Slack-MissedCall-${Date.now()}`,
      serviceUuid: svc.uuid,
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { flowName: 'slack_missed_call' } },
        { id: 'slack-wh', type: 'webhook', position: { x: 300, y: 0 }, data: {
          label: 'Slack Alert',
          url: 'https://webhook.example.com/slack-compatible/missed-call',
          method: 'post',
          fields: {
            text: 'event.name',
            caller: 'call.caller_id_number',
            queue: 'call.queue_name'
          }
        }}
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'slack-wh', sourceHandle: 'default' }]
    });

    const read = await readWorkflow(page, wf.uuid);
    const whNode = read._fd.nodes.find((n: any) => n.type === 'webhook');
    expect(whNode.data.url).toContain('hooks.slack.com');
    expect(whNode.data.fields.caller).toBe('call.caller_id_number');
    console.log('✓ Slack missed-call notification workflow');

    await deleteWorkflow(page, wf.uuid);
  });

  test('dual webhook — CRM + analytics on same event', async ({ authenticatedPage: page }) => {
    const svc = await getOrCreateService(page);

    const wf = await createWorkflow(page, {
      name: `Dual-CRM-Analytics-${Date.now()}`,
      serviceUuid: svc.uuid,
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 0, y: 100 }, data: { flowName: 'dual_webhook' } },
        { id: 'crm-wh', type: 'webhook', position: { x: 300, y: 0 }, data: {
          label: 'CRM Update',
          url: 'https://api.hubspot.com/webhooks/v1/call-events',
          method: 'post',
          fields: {
            event: 'event.name',
            phone: 'call.caller_id_number',
            agent: 'call.extension_username',
            duration: 'call.duration_time'
          }
        }},
        { id: 'analytics-wh', type: 'webhook', position: { x: 300, y: 200 }, data: {
          label: 'Analytics',
          url: 'https://analytics.company.com/api/v1/events',
          method: 'post_url_encoded'
          // No fields — sends raw event data
        }}
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'crm-wh', sourceHandle: 'default' },
        { id: 'e2', source: 'crm-wh', target: 'analytics-wh', sourceHandle: 'webhook_sent' }
      ]
    });

    const read = await readWorkflow(page, wf.uuid);
    expect(read._fd.nodes).toHaveLength(3);
    expect(read._fd.edges).toHaveLength(2);

    // CRM node has mapped fields
    const crm = read._fd.nodes.find((n: any) => n.id === 'crm-wh');
    expect(crm.data.url).toContain('hubspot.com');
    expect(crm.data.method).toBe('post');
    expect(Object.keys(crm.data.fields)).toHaveLength(4);

    // Analytics node has no fields (raw mode), uses form encoding
    const analytics = read._fd.nodes.find((n: any) => n.id === 'analytics-wh');
    expect(analytics.data.method).toBe('post_url_encoded');
    expect(analytics.data.fields).toBeUndefined();

    // Edge chain: start → CRM (on success) → analytics
    expect(read._fd.edges[1].sourceHandle).toBe('webhook_sent');
    console.log('✓ Dual webhook: CRM (mapped) → Analytics (raw), chained on success');

    await deleteWorkflow(page, wf.uuid);
  });

  test('failover webhook — primary + backup on failure', async ({ authenticatedPage: page }) => {
    const svc = await getOrCreateService(page);

    const wf = await createWorkflow(page, {
      name: `Failover-${Date.now()}`,
      serviceUuid: svc.uuid,
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 0, y: 100 }, data: { flowName: 'failover' } },
        { id: 'primary', type: 'webhook', position: { x: 300, y: 0 }, data: {
          label: 'Primary CRM',
          url: 'https://primary-crm.company.com/api/calls',
          method: 'post',
          fields: { caller: 'call.caller_id_number', event: 'event.name' }
        }},
        { id: 'backup', type: 'webhook', position: { x: 300, y: 200 }, data: {
          label: 'Backup CRM',
          url: 'https://backup-crm.company.com/api/calls',
          method: 'post',
          fields: { caller: 'call.caller_id_number', event: 'event.name' }
        }}
      ],
      edges: [
        { id: 'e1', source: 'start-1', target: 'primary', sourceHandle: 'default' },
        { id: 'e2', source: 'primary', target: 'backup', sourceHandle: 'webhook_failed' }
      ]
    });

    const read = await readWorkflow(page, wf.uuid);
    expect(read._fd.edges[1].sourceHandle).toBe('webhook_failed');
    expect(read._fd.nodes.find((n: any) => n.id === 'backup').data.url).toContain('backup-crm');
    console.log('✓ Failover: primary → backup on webhook_failed');

    await deleteWorkflow(page, wf.uuid);
  });
});
