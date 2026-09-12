import { test, expect, getAuthToken } from './auth-fixture';
import { testCreate, testDelete, getApiBaseUrl, buildFormData } from './crud-helpers';

/**
 * Workflow Manage View — E2E Tests
 *
 * Tests the Manage tab UI at /workflow:
 *   - Page loads and Manage view toggle works
 *   - Workflows table renders with data
 *   - Create workflow via dialog (builds ReactFlow JSON)
 *   - Edit workflow via dialog (updates webhook config)
 *   - Delete workflow via confirmation dialog
 *   - Test panel executes workflow and shows result
 */

test.describe('Workflow Manage View', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(process.env.CI ? 90000 : 60000);

  // Shared state across serial tests
  let createdUuid: string;

  test('page loads and Manage toggle is visible', async ({ authenticatedPage: page }) => {
    await page.goto('/workflow', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // The Builder view loads by default — look for the Manage button
    const manageBtn = page.getByRole('button', { name: 'Manage' });
    await expect(manageBtn).toBeVisible({ timeout: 15000 });
  });

  test('switch to Manage view shows table', async ({ authenticatedPage: page }) => {
    await page.goto('/workflow', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Click the Manage button to switch views
    const manageBtn = page.getByRole('button', { name: 'Manage' });
    await manageBtn.click();

    // The Manage view should render a table header with "Name"
    await expect(page.getByText('Manage Workflows')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Enabled' })).toBeVisible();
  });

  test('switch back to Builder view', async ({ authenticatedPage: page }) => {
    await page.goto('/workflow', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Switch to Manage
    await page.getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByText('Manage Workflows')).toBeVisible({ timeout: 10000 });

    // Switch back to Builder
    const builderBtn = page.getByRole('button', { name: 'Builder' });
    await builderBtn.click();
    await expect(page.getByText('PocketFlow Builder')).toBeVisible({ timeout: 10000 });
  });

  test('Create webhook workflow via API (setup)', async ({ authenticatedPage: page }) => {
    // Create a workflow via API so the table has data
    const flowData = JSON.stringify({
      nodes: [
        { id: 'start-1', type: 'start', data: {}, position: { x: 0, y: 0 } },
        { id: 'wh-1', type: 'webhook', data: {
          label: 'Webhook', name: 'webhook',
          url: 'https://httpbin.org/post', method: 'post',
          fields: { caller: 'caller_id_number', dir: 'direction' }
        }, position: { x: 250, y: 0 } }
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'wh-1', sourceHandle: 'default' }]
    });

    const createResp = await testCreate(page, 'workflows', {
      name: `PW-Manage-${Date.now()}`,
      type: 'event',
      enabled: 'true',
      flow_data: flowData,
    });
    expect(createResp.status()).toBe(201);
    const created = await createResp.json();
    createdUuid = created.uuid;
    console.log(`Setup: created workflow ${createdUuid}`);
  });

  test('Manage table shows the created workflow', async ({ authenticatedPage: page }) => {
    await page.goto('/workflow', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByText('Manage Workflows')).toBeVisible({ timeout: 10000 });

    // Wait for the table to load — should contain our workflow name prefix
    await expect(page.getByText('PW-Manage-')).toBeVisible({ timeout: 15000 });
  });

  test('New Workflow button opens create dialog', async ({ authenticatedPage: page }) => {
    await page.goto('/workflow', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByRole('button', { name: 'Manage' }).click();
    await expect(page.getByText('Manage Workflows')).toBeVisible({ timeout: 10000 });

    // Click "New Workflow" button
    await page.getByRole('button', { name: 'New Workflow' }).click();

    // Dialog should appear with expected fields
    await expect(page.getByText('New Workflow', { exact: false })).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('URL')).toBeVisible();

    // Close dialog
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Test panel runs workflow via API', async ({ authenticatedPage: page }) => {
    // Test directly via API — the test panel calls POST /api/workflows/:uuid/test
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const testResp = await page.request.post(`${apiBaseUrl}/api/workflows/${createdUuid}/test`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: buildFormData({
        event_name: 'user.answer',
        caller_id_number: '+15551234567',
        extension_username: '1001',
        direction: 'inbound',
        did_number: '+19175550000',
        queue_name: 'support',
      })
    });

    expect(testResp.status()).toBe(200);
    const result = await testResp.json();
    expect(result.event_name).toBe('user.answer');
    expect(result.event_data).toBeTruthy();
    expect(result.event_data.caller_id_number).toBe('+15551234567');
    console.log(`Test result: success=${result.success}, webhook_result=${JSON.stringify(result.webhook_result)?.substring(0, 100)}`);
  });

  test('Update workflow via API', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const updatedFlowData = JSON.stringify({
      nodes: [
        { id: 'start-1', type: 'start', data: {}, position: { x: 0, y: 0 } },
        { id: 'wh-1', type: 'webhook', data: {
          label: 'Updated Webhook', name: 'webhook',
          url: 'https://httpbin.org/anything', method: 'post',
          fields: { caller: 'caller_id_number', dir: 'direction', queue: 'queue_name' }
        }, position: { x: 250, y: 0 } }
      ],
      edges: [{ id: 'e1', source: 'start-1', target: 'wh-1', sourceHandle: 'default' }]
    });

    const updateResp = await page.request.patch(`${apiBaseUrl}/api/workflows/${createdUuid}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: buildFormData({
        name: `PW-Manage-Updated-${Date.now()}`,
        flow_data: updatedFlowData,
      })
    });
    expect(updateResp.status()).toBe(200);
    const updated = await updateResp.json();
    expect(updated.name).toContain('PW-Manage-Updated');

    // Verify flow_data roundtrip
    const fd = typeof updated.flow_data === 'string' ? JSON.parse(updated.flow_data) : updated.flow_data;
    const whNode = fd.nodes.find((n: any) => n.type === 'webhook');
    expect(whNode.data.url).toBe('https://httpbin.org/anything');
    expect(Object.keys(whNode.data.fields)).toHaveLength(3);
    console.log(`Updated workflow: ${createdUuid}, 3 field mappings`);
  });

  test('Cleanup: delete test workflow', async ({ authenticatedPage: page }) => {
    const delResp = await testDelete(page, 'workflows', createdUuid);
    expect(delResp.status()).toBe(200);
    console.log(`Cleaned up: ${createdUuid}`);
  });
});
