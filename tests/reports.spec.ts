import type { APIResponse, Page } from '@playwright/test';
import { test, expect } from './auth-fixture';
import { getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * Reports / Blazer workflow
 *
 * These are deliberately lifecycle tests, not permissive endpoint smokes. A
 * 422/500 is a failure: the product promise is that an account can see every
 * queries.yml report, create custom SQL, run it, edit and rerun it, and fork a
 * template or saved report into an editable copy.
 */

type FormValue = string | string[];

const formBody = (values: Record<string, FormValue>) => {
  const body = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => body.append(`${key}[]`, item));
    else body.append(key, value);
  });
  return body.toString();
};

const formHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/x-www-form-urlencoded',
});

const postForm = (
  page: Page,
  path: string,
  token: string,
  values: Record<string, FormValue>,
) => page.request.post(`${getApiBaseUrl()}${path}`, {
  headers: formHeaders(token),
  data: formBody(values),
});

const patchForm = (
  page: Page,
  path: string,
  token: string,
  values: Record<string, FormValue>,
) => page.request.patch(`${getApiBaseUrl()}${path}`, {
  headers: formHeaders(token),
  data: formBody(values),
});

const createCustomReport = async (page: Page, token: string, name: string) => {
  const response = await postForm(page, '/api/reports', token, {
    name,
    query: 'custom',
    type: 'table',
    enabled: 'true',
    fields: ['result'],
    params: ['call.created_at'],
    statement: 'SELECT 1 AS result',
    'meta[cache_ttl]': '0',
  });
  expect(response.status()).toBe(201);
  const report = await response.json();
  expect(report.uuid).toBeTruthy();
  return report;
};

const resultValue = (payload: any) => {
  const value = payload?.table?.data?.[0]?.result;
  return value && typeof value === 'object' && 'data' in value ? value.data : value;
};

const isSavedReportRun = (response: APIResponse, reportUuid: string) => {
  const url = new URL(response.url());
  return response.request().method() === 'GET'
    && url.pathname.endsWith(`/api/reports/${reportUuid}`)
    && url.searchParams.get('action') === 'run';
};

test.describe('Reports / Blazer workflow', () => {
  test.setTimeout(90000);

  test('catalog exposes every queries.yml template in the reports list', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    const [queriesResponse, reportsResponse] = await Promise.all([
      page.request.get(`${apiBaseUrl}/api/reports/queries`, { headers }),
      page.request.get(`${apiBaseUrl}/api/reports`, { headers }),
    ]);

    expect(queriesResponse.status()).toBe(200);
    expect(reportsResponse.status()).toBe(200);

    const queries = await queriesResponse.json();
    const reports = await reportsResponse.json();
    const templateNames = queries
      .filter((query: any) => query.source === 'template')
      .map((query: any) => query.name);
    const reportNames = new Set(reports.map((report: any) => report.name));

    expect(templateNames.length).toBeGreaterThan(0);
    expect(templateNames.filter((name: string) => !reportNames.has(name))).toEqual([]);
    expect(reports.filter((report: any) => report.source === 'template'))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ editable: false }),
      ]));
  });

  test('server returns scatter, map, and target-line visualization metadata', async ({ authenticatedPage: page }) => {
    const token = await getAuthToken(page);

    const scatter = await postForm(page, '/api/reports/run', token, {
      statement: 'SELECT 1 AS x, 2 AS y',
    });
    expect(scatter.status()).toBe(200);
    expect((await scatter.json()).chart).toBe('scatter');

    const map = await postForm(page, '/api/reports/run', token, {
      statement: 'SELECT 32.0853 AS latitude, 34.7818 AS longitude',
    });
    expect(map.status()).toBe(200);
    expect((await map.json()).chart).toBe('map');

    const target = await postForm(page, '/api/reports/run', token, {
      statement: 'SELECT now() AS day, 5 AS calls, 10 AS target',
    });
    expect(target.status()).toBe(200);
    const targetPayload = await target.json();
    expect(targetPayload.chart).toBe('line');
    expect(targetPayload.target_column).toBe('target');
  });

  test('API creates, runs, edits, reruns, forks, runs a range, and cleans up', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };
    const createdUuids: string[] = [];

    try {
      const report = await createCustomReport(page, token, `PW Report ${Date.now()}`);
      createdUuids.push(report.uuid);

      const now = Math.floor(Date.now() / 1000);
      const firstRun = await page.request.get(
        `${apiBaseUrl}/api/reports/${report.uuid}?action=run&start_date=${now - 86400}&end_date=${now}`,
        { headers },
      );
      expect(firstRun.status()).toBe(200);
      const firstPayload = await firstRun.json();
      expect(firstPayload.error).toBeFalsy();
      expect(Number(resultValue(firstPayload))).toBe(1);

      const update = await patchForm(page, `/api/reports/${report.uuid}`, token, {
        statement: 'SELECT 2 AS result',
      });
      expect(update.status()).toBe(200);

      const editedRun = await page.request.get(
        `${apiBaseUrl}/api/reports/${report.uuid}?action=run`,
        { headers },
      );
      expect(editedRun.status()).toBe(200);
      const editedPayload = await editedRun.json();
      expect(editedPayload.error).toBeFalsy();
      expect(Number(resultValue(editedPayload))).toBe(2);

      const forkResponse = await postForm(
        page,
        `/api/reports/${report.uuid}/fork`,
        token,
        { name: `PW Report Copy ${Date.now()}` },
      );
      expect(forkResponse.status()).toBe(201);
      const fork = await forkResponse.json();
      createdUuids.push(fork.uuid);
      expect(fork.uuid).not.toBe(report.uuid);

      const forkRun = await page.request.get(
        `${apiBaseUrl}/api/reports/${fork.uuid}?action=run`,
        { headers },
      );
      expect(forkRun.status()).toBe(200);
      const forkPayload = await forkRun.json();
      expect(forkPayload.error).toBeFalsy();
      expect(Number(resultValue(forkPayload))).toBe(2);
    } finally {
      for (const uuid of createdUuids.reverse()) {
        await page.request.delete(`${apiBaseUrl}/api/reports/${uuid}`, { headers });
      }
    }
  });

  test('admin can run, edit and rerun, then fork the saved report', async ({ authenticatedPage: page }) => {
    const apiBaseUrl = getApiBaseUrl();
    const token = await getAuthToken(page);
    const headers = { Authorization: `Bearer ${token}` };
    const createdUuids: string[] = [];
    const name = `PW Admin Report ${Date.now()}`;

    try {
      const report = await createCustomReport(page, token, name);
      createdUuids.push(report.uuid);

      await page.goto('/reports', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: 'New Report' })).toBeVisible();
      await expect(page.getByText(name, { exact: true })).toBeVisible();

      const selectRun = page.waitForResponse((response) => isSavedReportRun(response, report.uuid));
      await page.getByText(name, { exact: true }).click();
      expect((await selectRun).status()).toBe(200);

      // The complete BI workflow is visible from the selected report toolbar.
      await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit report' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Fork report' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Report history' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'table view' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'chart view' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();

      const explicitRun = page.waitForResponse((response) => isSavedReportRun(response, report.uuid));
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      expect((await explicitRun).status()).toBe(200);

      const historyResponse = page.waitForResponse((response) => (
        response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith('/api/reports/audits')
      ));
      await page.getByRole('button', { name: 'Report history' }).click();
      const history = await historyResponse;
      expect(history.status()).toBe(200);
      expect(await history.json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ report_name: name }),
      ]));
      const historyDialog = page.getByRole('dialog', { name: /Report run history/ });
      await expect(historyDialog).toBeVisible();
      await historyDialog.getByRole('button', { name: 'Close' }).click();

      const rangedRun = page.waitForResponse((response) => isSavedReportRun(response, report.uuid));
      await page.getByRole('button', { name: '7 Days', exact: true }).click();
      const rangedResponse = await rangedRun;
      expect(rangedResponse.status()).toBe(200);
      const rangedUrl = new URL(rangedResponse.url());
      const startDate = Number(rangedUrl.searchParams.get('start_date'));
      const endDate = Number(rangedUrl.searchParams.get('end_date'));
      expect(startDate).toBeGreaterThan(0);
      expect(endDate).toBeGreaterThan(startDate);
      // Inclusive seven local calendar days; tolerate DST transitions.
      expect(endDate - startDate).toBeGreaterThan(6 * 86400);
      expect(endDate - startDate).toBeLessThanOrEqual(7 * 86400);

      await page.getByRole('button', { name: 'Edit report' }).click();
      const dialog = page.getByRole('dialog', { name: 'Edit Report' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('tab', { name: 'Query' }).click();
      await dialog.locator('textarea').fill('SELECT 3 AS result');

      const adHocRun = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'POST' && url.pathname.endsWith('/api/reports/run');
      });
      await dialog.getByRole('button', { name: 'Run', exact: true }).click();
      const adHocResponse = await adHocRun;
      expect(adHocResponse.status()).toBe(200);
      expect(Number(resultValue(await adHocResponse.json()))).toBe(3);

      const saveResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'PATCH'
          && url.pathname.endsWith(`/api/reports/${report.uuid}`);
      });
      const savedReportRun = page.waitForResponse((response) => isSavedReportRun(response, report.uuid));
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      expect((await saveResponse).status()).toBe(200);
      const savedRunResponse = await savedReportRun;
      expect(savedRunResponse.status()).toBe(200);
      expect(Number(resultValue(await savedRunResponse.json()))).toBe(3);

      const forkResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'POST'
          && url.pathname.endsWith(`/api/reports/${report.uuid}/fork`);
      });
      await page.getByRole('button', { name: 'Fork report' }).click();
      const forkResponse = await forkResponsePromise;
      expect(forkResponse.status()).toBe(201);
      const fork = await forkResponse.json();
      createdUuids.push(fork.uuid);
      await expect(page).toHaveURL(new RegExp(`report=${fork.uuid}`));

      const forkRun = page.waitForResponse((response) => isSavedReportRun(response, fork.uuid));
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      expect((await forkRun).status()).toBe(200);
    } finally {
      for (const uuid of createdUuids.reverse()) {
        await page.request.delete(`${apiBaseUrl}/api/reports/${uuid}`, { headers });
      }
    }
  });
});
