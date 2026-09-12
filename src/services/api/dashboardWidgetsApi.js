/**
 * dashboardWidgetsApi — CRUD for the LOCAL dashboard widget definitions.
 *
 * Same contract as `app`'s services/dashboardsApi.js (ported UI/hooks call
 * these functions unchanged), but backed by localStorage instead of a
 * Postgres-backed `/dashboard/widgets` REST API — that API belonged to
 * app's own Elixir portal, not voipappz-api, and nothing equivalent exists
 * (or is being added) here. A definition only ever says what to show;
 * widget VALUES always come from the live Influx-backed snapshot
 * (useDashboardSnapshot), never from here.
 *
 * Counter metrics are the DashboardSnapshot.stats keys.
 */
export const COUNTER_METRICS = ['total', 'answered', 'failed', 'avg_duration_sec'];

import { WIDGET_TEMPLATES, applyTemplate } from '../../components/DashboardBuilder/widgetTemplates';

const STORAGE_PREFIX = 'dashboard-definitions';
let currentScope = 'global';

/**
 * Scope storage to a tenant so boards don't bleed across environments —
 * the admin's selected environment uuid, or a portal user's own
 * environment_uuid. Call this once scope is known (mirrors config.js's
 * setDynamicApiBaseUrl pattern); defaults to a single 'global' bucket
 * until then.
 */
export function setDashboardStorageScope(scope) {
  currentScope = scope || 'global';
}

const storageKey = () => `${STORAGE_PREFIX}:${currentScope}`;

// A first-run board, not an empty one.
//
// The screen used to open with three built-in tiles and nothing else, and the
// only way to see a statistic was to know to click "Add widget" and then pick
// a measurement and an aggregation. That is a builder's task on what is
// supposed to be an end user's landing page. These five are the questions an
// agent actually opens the portal to answer, already wired to measurements
// this platform writes.
//
// Seeded only when no board has ever been stored for this scope. Deleting a
// widget sticks: the store is written on first read, so an empty board stays
// empty rather than resurrecting itself on the next load.
const STARTER_WIDGET_KEYS = ['callsToday', 'callsInProgress', 'avgCallDuration', 'extensionsTotal', 'recentCalls'];

function starterWidgets() {
  try {
    return STARTER_WIDGET_KEYS
      .filter((key) => WIDGET_TEMPLATES[key])
      .map((key) => ({ ...applyTemplate(key), uuid: uuid(), dashboard_uuid: 'default' }));
  } catch {
    // A broken template must not cost the user their dashboard.
    return [];
  }
}

const emptyStore = () => ({
  dashboards: [{ uuid: 'default', name: 'Default' }],
  widgets: { default: starterWidgets() }
});

function readStore() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) {
      // Persist the seed immediately. Without this the starter board is
      // recreated on every load and deleting a widget appears to do nothing.
      const seeded = emptyStore();
      writeStore(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.dashboards) || typeof parsed.widgets !== 'object') return emptyStore();
    // Always guarantee a 'default' dashboard exists, same as app's dashboardId fallback.
    if (!parsed.dashboards.some((d) => d.uuid === 'default')) {
      parsed.dashboards.unshift({ uuid: 'default', name: 'Default' });
    }
    if (!parsed.widgets.default) parsed.widgets.default = [];
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(store));
  } catch {
    // storage disabled/full — mutations silently no-op past this point,
    // matching the "storage disabled" tolerance already used elsewhere here.
  }
}

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `w-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export async function getDashboards() {
  return readStore().dashboards;
}

export async function createDashboard(name) {
  const store = readStore();
  const created = { uuid: uuid(), name };
  store.dashboards.push(created);
  store.widgets[created.uuid] = [];
  writeStore(store);
  return created;
}

export async function renameDashboard(dashboardUuid, name) {
  const store = readStore();
  const dashboard = store.dashboards.find((d) => d.uuid === dashboardUuid);
  if (dashboard) dashboard.name = name;
  writeStore(store);
  return dashboard || null;
}

export async function deleteDashboard(dashboardUuid) {
  if (dashboardUuid === 'default') return null; // the default board is never removable
  const store = readStore();
  store.dashboards = store.dashboards.filter((d) => d.uuid !== dashboardUuid);
  delete store.widgets[dashboardUuid];
  writeStore(store);
  return true;
}

export async function getWidgets(dashboardUuid = 'default') {
  return readStore().widgets[dashboardUuid] || [];
}

export async function createWidget(widget, dashboardUuid = 'default') {
  const store = readStore();
  const created = { ...widget, uuid: uuid(), dashboard_uuid: dashboardUuid };
  if (!store.widgets[dashboardUuid]) store.widgets[dashboardUuid] = [];
  store.widgets[dashboardUuid].push(created);
  writeStore(store);
  return created;
}

export async function updateWidget(widgetUuid, patch, dashboardUuid = 'default') {
  const store = readStore();
  const list = store.widgets[dashboardUuid] || [];
  const index = list.findIndex((w) => w.uuid === widgetUuid);
  if (index === -1) return null;
  list[index] = { ...list[index], ...patch };
  writeStore(store);
  return list[index];
}

export async function deleteWidget(widgetUuid) {
  const store = readStore();
  for (const dashboardUuid of Object.keys(store.widgets)) {
    store.widgets[dashboardUuid] = store.widgets[dashboardUuid].filter((w) => w.uuid !== widgetUuid);
  }
  writeStore(store);
  return true;
}
