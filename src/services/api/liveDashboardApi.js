/**
 * liveDashboardApi — the Live Dashboard's pure helpers.
 *
 * Nothing here talks to the API any more. The screen's rows are the documents
 * the va-crystal node serves over the cable (LiveChannel -> JetStream KV), and
 * the node is also where an agent's name, extension and status name come from.
 * `fetchAgents` (`/api/users?action=agents`) and `fetchLiveCalls`
 * (`/api/calls`) were the polled fallback, removed on 2026-09-23: the API
 * ignores `action=agents` for a portal token and holds a call only after it
 * has ended, so neither could answer for the screen that used them.
 *
 * Column names arrive as `<scope>.<field>` — `user.status`, `queue.call_count`.
 * That prefix is the entity the value belongs to, and it is the same scope the
 * KV key uses.
 */

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
 * Counts for the pill row and the stat tiles.
 *
 * Derived from the rows themselves — the deployed dashboard's pills, tiles and
 * donut are all counts over the same table, which is why the whole screen
 * runs off one subscription.
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
