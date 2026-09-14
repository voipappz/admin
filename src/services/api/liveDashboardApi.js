import { apiService } from '../apiService.js';

/**
 * liveDashboardApi — the Live Dashboard's data layer.
 *
 * TWO SOURCES, DELIBERATELY SEPARATE:
 *
 *   STRUCTURE  which columns to show, and what the row actions do.
 *              Postgres-backed configuration that changes when someone edits a
 *              dashboard, not when a call rings — so it is fetched once, over
 *              HTTP.
 *
 *   ROWS       the live values. Today these come from `/api/users?action=agents`
 *              on a timer; the pipeline being built in va-crystal will serve the
 *              same shape over the cable (LiveChannel -> JetStream KV), at which
 *              point only `fetchRows` changes and the screen does not.
 *
 * Column names arrive as `<scope>.<field>` — `user.status`, `queue.call_count`.
 * That prefix is the entity the value belongs to, and it is the same scope the
 * KV key uses, which is what lets the two data sources stay interchangeable.
 */

/** Widget definitions for a dashboard. Verified against nimbus-prod. */
export async function fetchWidgets(dashboardName = 'live') {
  const res = await apiService.get(
    `/api/dashboards/${dashboardName}?action=widgets`,
    {},
    'Fetching dashboard widgets',
    false,
    true,
  );
  return Array.isArray(res) ? res : [];
}

/**
 * Split `user.status_updated_at` into `{ scope: 'user', field: 'status_updated_at' }`.
 *
 * A name with no dot is treated as a bare field on the widget's own scope
 * rather than dropped — an older definition may not carry the prefix.
 */
export function splitColumn(name, fallbackScope = 'user') {
  const raw = String(name || '');
  const dot = raw.indexOf('.');
  if (dot === -1) return { scope: fallbackScope, field: raw };
  return { scope: raw.slice(0, dot), field: raw.slice(dot + 1) };
}

/** Every scope a widget's columns reference, de-duplicated. */
export function scopesOf(widget) {
  const cols = Array.isArray(widget?.columns) ? widget.columns : [];
  return [...new Set(cols.map((c) => splitColumn(c.name, widget?.title).scope))];
}

/**
 * Live agent rows for one environment.
 *
 * NOTE ON `state`: the deployed API returns a serialized Ruby object here
 * (`"#<State::User:0x...>"`) because `users.rb` calls `Identity::User#state`,
 * which is the redis-objects wrapper, where it means `#agent_state`. Anything
 * that does not look like a state word is discarded rather than rendered — a
 * blank cell is honest, an object address is not.
 */
export async function fetchAgents(environmentUuid) {
  if (!environmentUuid) return [];
  const params = new URLSearchParams({ action: 'agents' });
  params.append('search[environment_uuid]', environmentUuid);

  const res = await apiService.get(
    `/api/users?${params}`,
    {},
    'Fetching live agents',
    false,
    true,
  );
  return (Array.isArray(res) ? res : []).map(normalizeAgent);
}

const OBJECT_INSPECT = /^#</;

function usableState(value) {
  if (value == null) return '';
  const s = String(value);
  return OBJECT_INSPECT.test(s) ? '' : s;
}

/**
 * Map an agent row onto the `<field>` names the widget definitions use, so the
 * renderer reads one vocabulary regardless of which source produced the row.
 * The names are State::User's, which is also what the KV documents will carry.
 */
function normalizeAgent(a) {
  return {
    uuid: a.uuid,
    user_name: a.fullname || a.username || '',
    extension_username: a.username || '',
    status: a.status_name || '',
    status_uuid: a.status_uuid || '',
    state: usableState(a.state),
    // Not served by this endpoint. Present so the renderer finds the key and
    // shows an empty cell rather than `undefined`; the cable path fills them.
    status_updated_at: '',
    call_outgoing_count: null,
    call_incoming_count: null,
    first_call_at: '',
    call_answer_at: '',
    talking_to_number: '',
  };
}

/**
 * Calls currently in progress for an environment.
 *
 * NOT from `/api/calls?action=live` — that asks the switch directly
 * (`show calls as json` via the customer's node) and answers **500** on this
 * deployment. The plain call list is Postgres-backed and works, and a call
 * record carries `profile.state`: a finished call is `complete`, so anything
 * else is still up.
 *
 * This is the interim source. The node already maintains the authoritative
 * lists — `environment:<uuid>:live_calls_incoming` / `_outgoing` / `_local`,
 * rpush on start and lrem on end — and once LiveChannel serves them, live calls
 * become a list on the environment document rather than a filtered query.
 */
export async function fetchLiveCalls(environmentUuid, limit = 100) {
  if (!environmentUuid) return [];
  const res = await apiService.get(
    `/api/calls?per_page=${limit}`,
    {},
    'Fetching live calls',
    false,
    true,
  );
  const rows = Array.isArray(res) ? res : [];

  return rows
    .filter((c) => (c?.environment?.uuid || '') === environmentUuid)
    .filter((c) => String(c?.profile?.state || '').toLowerCase() !== 'complete')
    .map(normalizeCall);
}

function normalizeCall(c) {
  const p = c.profile || {};
  return {
    uuid: c.uuid,
    created_at: c.created_at,
    direction: p.direction || '',
    state: p.state || '',
    caller: p.caller_id_number || p.caller || '',
    // `sip_to_uri` is the fullest destination the switch reports; `dest` is the
    // bare number when the URI is absent.
    destination: (p.sip_to_uri || p.dest || '').split('@')[0],
    duration: p.talk_duration || p.duration || '',
    leg: [c.leg_a_type, c.leg_b_type].filter(Boolean).join(' → '),
  };
}

/** Environments the signed-in account can see. */
export async function fetchEnvironments() {
  const res = await apiService.get('/api/applications', {}, 'Fetching environments', false, true);
  return Array.isArray(res) ? res : [];
}

/**
 * Counts for the pill row and the stat tiles.
 *
 * Derived from the rows themselves — the deployed dashboard's pills, tiles and
 * donut are all counts over the same table, which is why the whole screen can
 * run off one subscription once the cable lands.
 */
export function summarize(rows) {
  const total = rows.length;
  const by = (s) => rows.filter((r) => String(r.status).toLowerCase() === s).length;
  const onCall = rows.filter((r) => {
    const st = String(r.state).toLowerCase();
    return st === 'in_a_queue_call' || st === 'answer';
  }).length;

  return {
    total,
    available: by('available'),
    onBreak: by('on_break'),
    loggedOut: by('logged_out'),
    onCall,
    waiting: rows.filter((r) => String(r.state).toLowerCase() === 'waiting').length,
    // Share of signed-in agents currently on a call. Zero agents is 0%, not NaN.
    utilization: total ? Math.round((onCall / total) * 100) : 0,
  };
}
