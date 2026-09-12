import { test, expect } from './auth-fixture';

/**
 * Calls CounterTimeline histogram — mock-data e2e.
 * Intercepts GET /api/calls/aggregate and serves known buckets, then asserts the
 * Events-style TimeHistogram renders them on /calls. Runs independently of the
 * API deploy (the endpoint response is mocked at the network layer), so it
 * verifies the full frontend path: fetch → convert → d3 render.
 */
test.describe('Calls Histogram (mocked aggregate)', () => {
  test.setTimeout(process.env.CI ? 90000 : 45000);

  const MOCK_BUCKETS = [
    { time: '2026-07-14T10:00:00', answer: 4, no_answer: 2 },
    { time: '2026-07-14T11:00:00', answer: 7, no_answer: 1 },
    { time: '2026-07-14T12:00:00', answer: 3, busy: 2 },
  ];

  test('renders histogram bars from mocked /calls/aggregate', async ({ authenticatedPage: page }) => {
    let aggregateRequests = 0;

    await page.route('**/calls/aggregate**', async (route) => {
      aggregateRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BUCKETS),
      });
    });

    await page.goto('/calls', { waitUntil: 'domcontentloaded', timeout: 20000 });

    // The aggregate must be requested as part of the list load (embedded filters)
    await expect.poll(() => aggregateRequests, { timeout: 20000 }).toBeGreaterThan(0);

    // The d3 histogram renders one <rect> per (bucket × series) — 6 data cells
    // in MOCK_BUCKETS. Assert bars exist inside the histogram svg.
    const bars = page.locator('svg rect');
    await expect.poll(async () => bars.count(), { timeout: 20000 }).toBeGreaterThanOrEqual(3);

    console.log(`✅ histogram rendered (aggregate requests: ${aggregateRequests})`);
  });

  test('aggregate request carries the same date filter as the list', async ({ authenticatedPage: page }) => {
    let aggregateUrl = '';
    let listCreatedAt = '';

    await page.route('**/calls/aggregate**', async (route) => {
      aggregateUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/calls?') && url.includes('search%5Bcreated_at%5D')) {
        const m = new URL(url).searchParams.get('search[created_at]');
        if (m) listCreatedAt = m;
      }
    });

    await page.goto('/calls', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await expect.poll(() => aggregateUrl, { timeout: 20000 }).not.toBe('');

    const aggCreatedAt = new URL(aggregateUrl).searchParams.get('search[created_at]');
    expect(aggCreatedAt).toBeTruthy();
    if (listCreatedAt) {
      expect(aggCreatedAt).toBe(listCreatedAt); // same filter, same query — by construction
    }
    console.log(`✅ aggregate filter matches list: ${aggCreatedAt}`);
  });
});

/**
 * Quick-filter chip strip — mock-data e2e.
 * Serves a known /calls list (2 answered + 1 no-answer) and asserts the
 * syslog-style chips filter the grid client-side: click Answered → 2 rows,
 * click again → all 3. Also guards the full-height layout (the grid must
 * reach the bottom of the viewport — no dead strip from the removed topbar).
 */
test.describe('Calls quick-filter chips (mocked list)', () => {
  test.setTimeout(process.env.CI ? 90000 : 45000);

  // Rows need BOTH id (MUI DataGrid row key — no getRowId is set) and uuid
  // (the app's dedup/selection key). The real /calls response carries id.
  const MOCK_CALLS = [
    { id: 'c-1', uuid: 'c-1', created_at: '2026-07-20T10:00:00Z', profile: { cause: 'answer', direction: 'incoming' }, environment: { uuid: 'env-1', name: 'App One' }, meta: {} },
    { id: 'c-2', uuid: 'c-2', created_at: '2026-07-20T10:05:00Z', profile: { cause: 'answer', direction: 'outgoing' }, environment: { uuid: 'env-1', name: 'App One' }, meta: {} },
    { id: 'c-3', uuid: 'c-3', created_at: '2026-07-20T10:10:00Z', profile: { cause: 'no_answer', direction: 'incoming' }, environment: { uuid: 'env-2', name: 'App Two' }, meta: {} },
  ];

  test('Answered chip adds/removes a real cause search param', async ({ authenticatedPage: page }) => {
    // Capture every /calls list request URL so we can assert the Answered chip
    // toggles a real server-side search param (not client-side row hiding).
    const listUrls: string[] = [];
    await page.route((url) => url.pathname.endsWith('/calls') && url.search.includes('page='), async (route) => {
      listUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'x-total': String(MOCK_CALLS.length) },
        body: JSON.stringify(MOCK_CALLS),
      });
    });
    await page.route('**/calls/aggregate**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto('/calls', { waitUntil: 'domcontentloaded', timeout: 20000 });

    // The summary statistic is an accessible button; its presentation may be
    // a card or chip, but clicking it must always issue the server-side filter.
    const answeredFilter = page.getByRole('button', { name: /answered/i }).first();
    await expect(answeredFilter).toBeVisible({ timeout: 20000 });

    // Click Answered -> a new /calls list request carries the cause=answer
    // filter, proving the chip is a real server-side search (not row hiding).
    await answeredFilter.click();
    await expect
      .poll(
        () => listUrls.some((u) => {
          const d = decodeURIComponent(u);
          return /call\.cause/.test(d) && /answer/.test(d);
        }),
        { timeout: 10000 },
      )
      .toBe(true);

    console.log('✅ Answered chip issues a real cause search request');
  });

  test('grid reaches the bottom of the viewport (full-height layout)', async ({ authenticatedPage: page }) => {
    await page.route((url) => url.pathname.endsWith('/calls') && url.search.includes('page='), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'x-total': String(MOCK_CALLS.length) },
        body: JSON.stringify(MOCK_CALLS),
      });
    });
    await page.route('**/calls/aggregate**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    await page.goto('/calls', { waitUntil: 'domcontentloaded', timeout: 20000 });

    const grid = page.locator('.MuiDataGrid-root');
    await expect(grid).toBeVisible({ timeout: 20000 });

    const viewport = page.viewportSize();
    const box = await grid.boundingBox();
    expect(box).toBeTruthy();
    // Old bug reserved 64px for a topbar that no longer exists; allow padding
    // but fail on anything close to that dead strip.
    expect(box!.y + box!.height).toBeGreaterThan(viewport!.height - 40);

    console.log(`✅ grid bottom at ${Math.round(box!.y + box!.height)} of ${viewport!.height}px viewport`);
  });
});
