import { test, expect } from './auth-fixture';
import {
  testCreate,
  testRead,
  testUpdate,
  testDelete,
  getApiBaseUrl,
  getAuthToken,
} from './crud-helpers';

/**
 * Plan Items <- Tariff
 *
 * End-to-end through the real admin API: create a TARIFF, create a PLAN, then
 * add the tariff to the plan as a plan ITEM (POST /api/plans/:uuid/items with
 * items[i][name]/[val]). The backend stores it in the `items` table as
 * { name: tariff name, val: tariff uuid } and resolves Plan#tariffs from it.
 *
 * Verifies the create path actually works and the item is linked to the tariff
 * (val == tariff uuid), with no logic failure end to end.
 */
test.describe('Plan items (tariff)', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);

  test('create a tariff and add it to a plan as an item', async ({ authenticatedPage: page }) => {
    const ts = Date.now();
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    // 1) Create a tariff (scheme is required for a 201).
    const tariffRes = await testCreate(page, 'tariffs', {
      name: `PW Tariff ${ts}`,
      scheme: 'prepaid',
      enabled: 'true',
    });
    expect(tariffRes.status(), await tariffRes.text()).toBe(201);
    const tariff = await tariffRes.json();
    expect(tariff.uuid).toBeTruthy();
    console.log(`✅ created tariff ${tariff.uuid}`);

    // 2) Create a plan.
    const planRes = await testCreate(page, 'plans', {
      name: `PW Plan ${ts}`,
      enabled: 'true',
      period: 'month',
      interval: '1',
    });
    expect([200, 201]).toContain(planRes.status());
    const plan = await planRes.json();
    expect(plan.uuid).toBeTruthy();
    console.log(`✅ created plan ${plan.uuid}`);

    // 3) Add the tariff to the plan as an item.
    const itemForm = new URLSearchParams();
    itemForm.append('items[0][name]', tariff.name);
    itemForm.append('items[0][val]', tariff.uuid);

    const itemRes = await page.request.post(`${apiBaseUrl}/api/plans/${plan.uuid}/items`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: itemForm.toString(),
    });
    expect(itemRes.status(), await itemRes.text()).toBe(200);

    // 4) The response echoes the created items — the item must reference the
    //    tariff via `val`, proving the link was stored.
    const body = await itemRes.json();
    const vals = (body.items || []).map((i: any) => i.val);
    expect(vals).toContain(tariff.uuid);
    console.log(`✅ tariff ${tariff.uuid} linked to plan ${plan.uuid} as an item`);

    // 5) Read the plan's items, then delete the item (full item CRUD).
    const getRes = await page.request.get(`${apiBaseUrl}/api/plans/${plan.uuid}/items`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(getRes.status()).toBe(200);
    const items = await getRes.json();
    const item = items.find((i: any) => i.val === tariff.uuid);
    expect(item, 'item should be returned by GET items').toBeTruthy();

    const delItemRes = await page.request.delete(`${apiBaseUrl}/api/plans/items/${item.uuid}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(delItemRes.status()).toBe(200);
    console.log(`✅ deleted plan item ${item.uuid}`);

    // Cleanup (best-effort).
    await testDelete(page, 'plans', plan.uuid);
    await testDelete(page, 'tariffs', tariff.uuid);
  });

  test('create a tariff and attach it to a provider', async ({ authenticatedPage: page }) => {
    const ts = Date.now();

    // 1) Create a tariff.
    const tariffRes = await testCreate(page, 'tariffs', {
      name: `PW Tariff Prov ${ts}`,
      scheme: 'prepaid',
      enabled: 'true',
    });
    expect(tariffRes.status(), await tariffRes.text()).toBe(201);
    const tariff = await tariffRes.json();

    // 2) Create a SIP provider linked to that tariff.
    const provRes = await testCreate(page, 'providers', {
      name: `PW Provider ${ts}`,
      type: 'sip',
      tariff_uuid: tariff.uuid,
    });
    expect(provRes.status(), await provRes.text()).toBe(201);
    const provider = await provRes.json();
    expect(provider.tariff_uuid).toBe(tariff.uuid);

    // 3) Re-read the provider — the tariff link persisted.
    const readRes = await testRead(page, 'providers', provider.uuid);
    expect(readRes.status()).toBe(200);
    const read = await readRes.json();
    expect(read.tariff_uuid).toBe(tariff.uuid);
    console.log(`✅ provider ${provider.uuid} linked to tariff ${tariff.uuid}`);

    await testDelete(page, 'providers', provider.uuid);
    await testDelete(page, 'tariffs', tariff.uuid);
  });

  test('edit a plan: rename it and replace its tariff', async ({ authenticatedPage: page }) => {
    const ts = Date.now();
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const setItems = (planUuid: string, items: { name: string; val: string }[]) => {
      const form = new URLSearchParams();
      items.forEach((it, i) => {
        form.append(`items[${i}][name]`, it.name);
        form.append(`items[${i}][val]`, it.val);
      });
      return page.request.post(`${apiBaseUrl}/api/plans/${planUuid}/items`, {
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        data: form.toString(),
      });
    };

    const t1 = await (await testCreate(page, 'tariffs', { name: `PW T1 ${ts}`, scheme: 'prepaid', enabled: 'true' })).json();
    const t2 = await (await testCreate(page, 'tariffs', { name: `PW T2 ${ts}`, scheme: 'prepaid', enabled: 'true' })).json();
    const plan = await (await testCreate(page, 'plans', { name: `PW Plan Edit ${ts}`, enabled: 'true', period: 'month', interval: '1' })).json();

    // add tariff t1
    expect((await setItems(plan.uuid, [{ name: t1.name, val: t1.uuid }])).status()).toBe(200);
    // EDIT the plan itself (rename)
    const upd = await testUpdate(page, 'plans', plan.uuid, { name: `PW Plan Edited ${ts}` });
    expect(upd.status()).toBe(200);
    expect((await upd.json()).name).toBe(`PW Plan Edited ${ts}`);
    // EDIT the items: replace t1 with t2
    expect((await setItems(plan.uuid, [{ name: t2.name, val: t2.uuid }])).status()).toBe(200);

    // verify only t2 remains
    const items = await (await page.request.get(`${apiBaseUrl}/api/plans/${plan.uuid}/items`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })).json();
    const vals = items.map((i: any) => i.val);
    expect(vals).toContain(t2.uuid);
    expect(vals).not.toContain(t1.uuid);
    console.log(`✅ edited plan ${plan.uuid}: tariff replaced t1→t2`);

    await testDelete(page, 'plans', plan.uuid);
    await testDelete(page, 'tariffs', t1.uuid);
    await testDelete(page, 'tariffs', t2.uuid);
  });

  test('rejects an item with no val (tariff uuid)', async ({ authenticatedPage: page }) => {
    const ts = Date.now();
    const apiBaseUrl = getApiBaseUrl();
    const authToken = await getAuthToken(page);

    const planRes = await testCreate(page, 'plans', {
      name: `PW Plan NoVal ${ts}`,
      enabled: 'true',
      period: 'month',
      interval: '1',
    });
    expect([200, 201]).toContain(planRes.status());
    const plan = await planRes.json();

    const itemForm = new URLSearchParams();
    itemForm.append('items[0][name]', 'no-val-item');

    const itemRes = await page.request.post(`${apiBaseUrl}/api/plans/${plan.uuid}/items`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: itemForm.toString(),
    });
    // SetItems raises "val is required" -> the endpoint surfaces a non-2xx.
    expect(itemRes.status()).toBeGreaterThanOrEqual(400);

    await testDelete(page, 'plans', plan.uuid);
  });
});
