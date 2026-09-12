#!/usr/bin/env node
/**
 * Smoke-check EVERY queries.yml report against a live API.
 *
 * Runs each dashboard category through GET /api/reports/dashboards/:category
 * and prints per-report status, so a SQL regression (a dropped GROUP BY, a
 * renamed column) is visible without clicking through every screen. The admin
 * silently hides errored reports, which is how PG::GroupingError on six
 * reports went unnoticed.
 *
 *   node scripts/check-reports.mjs            # 30d window, all categories
 *   node scripts/check-reports.mjs calls      # one category
 *   node scripts/check-reports.mjs --days 7
 *
 * Reads VITE_API_BASE_URL / TEST_EMAIL / TEST_PASSWORD / VA_TEST_OTP from the
 * environment (source .env first). Exits non-zero if any report errored.
 */

// No default host: a baked-in URL is how a check silently reports on the wrong
// environment. Everything comes from .env.
const API   = process.env.VITE_API_BASE_URL;
const EMAIL = process.env.TEST_EMAIL;
const PASS  = process.env.TEST_PASSWORD;
const OTP   = process.env.VA_TEST_OTP;

const args = process.argv.slice(2);
const daysIdx = args.indexOf('--days');
const days = daysIdx >= 0 ? Number(args[daysIdx + 1]) : 30;
const only = args.filter((a, i) => !a.startsWith('--') && !(daysIdx >= 0 && i === daysIdx + 1));

const missing = [
  ['VITE_API_BASE_URL', API], ['TEST_EMAIL', EMAIL],
  ['TEST_PASSWORD', PASS], ['VA_TEST_OTP', OTP],
].filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  console.error(`Missing ${missing.join(', ')} — run: source .env && node scripts/check-reports.mjs`);
  process.exit(2);
}

const q = encodeURIComponent;

async function login() {
  const step1 = await fetch(`${API}/auth/login?email=${q(EMAIL)}&password=${q(PASS)}`, { method: 'POST' });
  const { temp_token } = await step1.json();
  if (!temp_token) throw new Error('login failed — no temp_token (account locked after 5 bad attempts?)');

  const step2 = await fetch(
    `${API}/auth/otp/verify?temp_token=${q(temp_token)}&code=${q(OTP)}&email=${q(EMAIL)}&password=${q(PASS)}`,
    { method: 'POST' }
  );
  const { access } = await step2.json();
  if (!access) throw new Error('OTP verify failed — no access token');
  return access;
}

const get = (path, token) =>
  fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

const token = await login();

const { dashboards = [] } = await get('/api/reports/dashboards', token);
const categories = (only.length ? dashboards.filter((d) => only.includes(d.category)) : dashboards)
  .map((d) => d.category);

if (!categories.length) {
  console.error(`No matching category. Available: ${dashboards.map((d) => d.category).join(', ')}`);
  process.exit(2);
}

const now = Math.floor(Date.now() / 1000);
const start = now - days * 24 * 3600;

let failed = 0;
let empty = 0;
let ok = 0;

for (const category of categories) {
  console.log(`\n${category}`);
  const res = await get(`/api/reports/dashboards/${q(category)}?start_date=${start}&end_date=${now}`, token);

  for (const r of res.reports || []) {
    if (r.error) {
      failed++;
      console.log(`  FAIL  ${r.name} — ${String(r.error).split('\n')[0]}`);
    } else if (!(r.rows || []).length) {
      empty++;
      console.log(`  empty ${r.name} (no data in ${days}d — not an error)`);
    } else {
      ok++;
      console.log(`  ok    ${r.name} — ${r.rows.length} rows, chart=${r.chart}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Persistence round-trip: params / fields / group must survive a reload.
// PATCH the settings, re-GET the report, assert what comes back matches.
// ---------------------------------------------------------------------------
// pairs, not an object: URLSearchParams comma-joins array values instead of
// repeating the key, which is what the Rack form parser needs for fields[].
const patch = (path, pairs) =>
  fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(pairs),
  }).then((r) => r.status);

// Field values come back as [{name}] or plain strings depending on the setting.
const names = (v) => JSON.stringify((v || []).map((e) => e?.name ?? e));

const [target] = (await get('/api/reports', token)) || [];

if (!target) {
  console.log('\nsave round-trip: skipped — no saved reports on this account');
} else {
  console.log(`\nsave round-trip on "${target.name}"`);

  const expect = (label, want, got, status) => {
    const pass = status < 300 && got === JSON.stringify(want);
    if (!pass) failed++;
    console.log(`  ${pass ? 'ok   ' : 'FAIL '} ${label} — sent ${JSON.stringify(want)}, got ${got} (${status})`);
  };

  const fields = ['call.count', 'call.count_uniq'];
  const params = ['call.created_at'];
  const status = await patch(`/api/reports/${target.uuid}`,
    [...fields.map((f) => ['fields[]', f]), ...params.map((p) => ['params[]', p])]);
  const after = await get(`/api/reports/${target.uuid}?action=load`, token);
  expect('fields', fields, names(after?.fields), status);
  expect('params', params, names(after?.params), status);

  // group is saved through the save_params action, not the plain PATCH
  const group = ['call.callee'];
  const gStatus = await patch(`/api/reports/${target.uuid}?action=save_params`,
    [['params[field]', 'group_columns'], ...group.map((g) => ['params[value][]', g])]);
  const afterGroup = await get(`/api/reports/${target.uuid}?action=load`, token);
  expect('group_columns', group, names(afterGroup?.group_columns), gStatus);
}

console.log(`\n${ok} ok, ${empty} empty, ${failed} failed  (window: ${days}d, api: ${API})`);
process.exit(failed > 0 ? 1 : 0);
