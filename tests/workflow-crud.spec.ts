import { test, expect, getAuthToken } from './auth-fixture';
import { getApiBaseUrl, buildFormData } from './crud-helpers';

/**
 * Single workflow full CRUD with service connection + test event simulation.
 * Service CREATE → Workflow CREATE → READ → UPDATE → READ → TEST EVENT → DELETE → Service DELETE
 */
test.describe('Workflow + Service full CRUD', () => {
  test.setTimeout(process.env.CI ? 120000 : 90000);

  test('full lifecycle: service → workflow → webhook → cleanup', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);
    const headers = { 'Authorization': `Bearer ${authToken}` };
    const postHeaders = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };

    // ── 1. CREATE SERVICE (event trigger) ──
    const svcResp = await page.request.post(`${apiBaseUrl}/api/services`, {
      headers: postHeaders,
      data: buildFormData({
        name: `PW-Service-${Date.now()}`,
        type: 'event',
        enabled: 'true',
        triggers: ['user.answer', 'user.hangup', 'queue.end'],
      })
    });
    expect(svcResp.status()).toBe(201);
    const service = await svcResp.json();
    console.log(`1. Created service: ${service.uuid} (${service.name})`);

    // ── 2. CREATE WORKFLOW linked to service ──
    const flowV1 = {
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { flowName: 'crm_integration' } },
        { id: 'wh-1', type: 'webhook', position: { x: 300, y: 0 }, data: {
          label: 'CRM Webhook',
          url: 'https://hooks.salesforce.com/services/callcenter/events',
          method: 'post',
          fields: {
            event_type: 'event.name',
            caller: 'call.caller_id_number',
            agent: 'call.extension_username'
          }
        }}
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'wh-1', sourceHandle: 'default' }]
    };

    const wfResp = await page.request.post(`${apiBaseUrl}/api/workflows`, {
      headers: postHeaders,
      data: buildFormData({
        name: `CRM-Workflow-${Date.now()}`,
        type: 'event',
        type_uuid: service.uuid,
        enabled: 'true',
        flow_data: JSON.stringify(flowV1),
      })
    });
    expect(wfResp.status()).toBe(201);
    const workflow = await wfResp.json();
    console.log(`2. Created workflow: ${workflow.uuid} linked to service ${service.uuid}`);

    // ── 3. READ — verify workflow + flow_data ──
    const readResp = await page.request.get(`${apiBaseUrl}/api/workflows/${workflow.uuid}`, { headers });
    expect(readResp.status()).toBe(200);
    const read = await readResp.json();
    const fd1 = typeof read.flow_data === 'string' ? JSON.parse(read.flow_data) : read.flow_data;

    expect(read.type).toBe('event');
    expect(read.type_uuid).toBe(service.uuid);
    expect(fd1.nodes).toHaveLength(2);
    expect(fd1.edges).toHaveLength(1);

    const wh1 = fd1.nodes.find((n: any) => n.type === 'webhook');
    expect(wh1.data.url).toBe('https://hooks.salesforce.com/services/callcenter/events');
    expect(wh1.data.method).toBe('post');
    expect(Object.keys(wh1.data.fields)).toHaveLength(3);
    console.log(`3. Read OK: 2 nodes, 3 field mappings, type_uuid=${read.type_uuid}`);

    // ── 4. UPDATE — add more fields + change URL ──
    const flowV2 = {
      nodes: [
        { id: 'start-1', type: 'start', position: { x: 0, y: 0 }, data: { flowName: 'crm_integration' } },
        { id: 'wh-1', type: 'webhook', position: { x: 300, y: 0 }, data: {
          label: 'CRM Webhook v2',
          url: 'https://hooks.salesforce.com/services/callcenter/events/v2',
          method: 'post',
          fields: {
            event_type: 'event.name',
            caller: 'call.caller_id_number',
            agent: 'call.extension_username',
            direction: 'call.direction',
            duration: 'call.duration_time',
            queue: 'call.queue_name'
          }
        }}
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'wh-1', sourceHandle: 'default' }]
    };

    const updateResp = await page.request.patch(`${apiBaseUrl}/api/workflows/${workflow.uuid}`, {
      headers: postHeaders,
      data: buildFormData({
        name: `CRM-Workflow-Updated-${Date.now()}`,
        flow_data: JSON.stringify(flowV2),
      })
    });
    expect(updateResp.status()).toBe(200);
    console.log(`4. Updated workflow: added 3 more fields, changed URL`);

    // ── 5. READ — verify update persisted ──
    const verifyResp = await page.request.get(`${apiBaseUrl}/api/workflows/${workflow.uuid}`, { headers });
    expect(verifyResp.status()).toBe(200);
    const verified = await verifyResp.json();
    const fd2 = typeof verified.flow_data === 'string' ? JSON.parse(verified.flow_data) : verified.flow_data;

    const wh2 = fd2.nodes.find((n: any) => n.type === 'webhook');
    expect(wh2.data.url).toContain('/v2');
    expect(Object.keys(wh2.data.fields)).toHaveLength(6);
    expect(wh2.data.fields.duration).toBe('call.duration_time');
    expect(wh2.data.fields.queue).toBe('call.queue_name');
    console.log(`5. Verified update: 6 fields, URL updated to /v2`);

    // ── 5b. TEST EVENT — simulate event execution ──
    const testResp = await page.request.post(`${apiBaseUrl}/api/workflows/${workflow.uuid}/test`, {
      headers: postHeaders,
      data: buildFormData({
        event_name: 'user.answer',
        caller_id_number: '+15559876543',
        extension_username: '2001',
        direction: 'inbound',
        duration_time: '30',
        did_number: '+19175551234',
        queue_name: 'sales',
      })
    });
    expect(testResp.status()).toBe(200);
    const testResult = await testResp.json();
    expect(testResult.event_name).toBe('user.answer');
    expect(testResult.event_data).toBeTruthy();
    expect(testResult.event_data.caller_id_number).toBe('+15559876543');
    expect(testResult.event_data.extension_username).toBe('2001');
    expect(testResult.event_data.direction).toBe('inbound');
    expect(testResult.event_data.did_number).toBe('+19175551234');
    expect(testResult.event_data.queue_name).toBe('sales');
    // webhook_result may or may not succeed (external URL), but endpoint must return 200
    console.log(`5b. Test event OK: event_name=${testResult.event_name}, success=${testResult.success}`);

    // ── 5c. TEST EVENT with defaults — no params ──
    const testDefaultResp = await page.request.post(`${apiBaseUrl}/api/workflows/${workflow.uuid}/test`, {
      headers: postHeaders,
      data: ''
    });
    expect(testDefaultResp.status()).toBe(200);
    const testDefault = await testDefaultResp.json();
    expect(testDefault.event_name).toBe('user.answer');
    expect(testDefault.event_data.caller_id_number).toBe('+15551234567');
    console.log(`5c. Test event with defaults OK: uses default caller_id`);

    // ── 6. DELETE WORKFLOW ──
    const delWfResp = await page.request.delete(`${apiBaseUrl}/api/workflows/${workflow.uuid}`, { headers });
    expect(delWfResp.status()).toBe(200);

    const goneResp = await page.request.get(`${apiBaseUrl}/api/workflows/${workflow.uuid}`, { headers });
    expect(goneResp.status()).toBe(404);
    console.log(`6. Deleted workflow — confirmed 404`);

    // ── 6b. TEST on deleted workflow — should 404 ──
    const testGoneResp = await page.request.post(`${apiBaseUrl}/api/workflows/${workflow.uuid}/test`, {
      headers: postHeaders,
      data: ''
    });
    expect(testGoneResp.status()).toBe(404);
    console.log(`6b. Test on deleted workflow returns 404 — correct`);

    // ── 7. DELETE SERVICE ──
    const delSvcResp = await page.request.delete(`${apiBaseUrl}/api/services/${service.uuid}`, { headers });
    expect(delSvcResp.status()).toBe(200);
    console.log(`7. Deleted service — full cleanup done`);
  });
});
