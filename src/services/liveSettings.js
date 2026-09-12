/**
 * liveSettings — display settings for the Live Dashboard, stored per browser.
 *
 * The live documents hold FACTS (status is `on_break`, the counter is 7); this
 * holds HOW TO RENDER THEM (on_break is amber). Keeping colours out of the
 * store is deliberate: a colour written per entity would be the same fact
 * duplicated on every row, rewritten on every state change, and unchangeable
 * without a deploy.
 *
 * Storage mirrors dashboardWidgetsApi's convention — `<prefix>:<scope>` in
 * localStorage, scoped to the selected environment so one tenant's palette
 * doesn't bleed into another's.
 *
 * DEFAULTS COME FROM TWO PLACES, AND THEY DISAGREE. Ruby's
 * `StateHelpers::STATE_COLORS` (va-crystal node/realtime/state_writers.cr, and
 * Identity::User in voipappz-api) maps `waiting` to green, but the deployed
 * Live Dashboard renders the Waiting chip BLUE. The rendered UI wins here:
 * these defaults are what an operator already recognises. That divergence is
 * also the argument for this file existing — the palette is a preference, not
 * a constant, and it is now editable instead of baked into two codebases that
 * had already drifted apart.
 */

const STORAGE_PREFIX = 'va-live-settings';

let currentScope = 'global';

/**
 * Scope settings to a tenant. Mirrors setDashboardStorageScope — call once the
 * selected environment is known; until then everything lands in one 'global'
 * bucket.
 */
export function setLiveSettingsScope(scope) {
  currentScope = scope || 'global';
}

const storageKey = () => `${STORAGE_PREFIX}:${currentScope}`;

/**
 * Agent status — the `status` column. Vocabulary comes from
 * Identity::User::STATUS_* in voipappz-api.
 */
export const DEFAULT_STATUS_COLORS = {
  available: '#22A45D',
  on_break: '#F0932B',
  logged_out: '#8A94A6',
};

/**
 * Agent state — the `state` column. Vocabulary comes from
 * StateHelpers::STATE_COLORS plus Identity::User::STATE_*.
 */
export const DEFAULT_STATE_COLORS = {
  waiting: '#2E86DE',
  receiving: '#F0932B',
  ringing: '#F0932B',
  answer: '#22A45D',
  in_a_queue_call: '#22A45D',
};

/**
 * Column order and visibility for the agents table, in the order the deployed
 * dashboard renders them. `key` is the `<field>` half of the widget
 * definition's `<scope>.<field>` column name.
 */
export const DEFAULT_COLUMNS = [
  { key: 'user_name', label: 'Name', visible: true },
  { key: 'extension_username', label: 'Extension', visible: true },
  { key: 'status', label: 'Status', visible: true, render: 'status' },
  { key: 'status_updated_at', label: 'For', visible: true, render: 'elapsed' },
  { key: 'state', label: 'State', visible: true, render: 'state' },
  { key: 'call_outgoing_count', label: 'Out', visible: true, render: 'count' },
  { key: 'call_incoming_count', label: 'In', visible: true, render: 'count' },
  { key: 'first_call_at', label: 'First call', visible: true, render: 'elapsed' },
  { key: 'call_answer_at', label: 'Talking for', visible: true, render: 'elapsed' },
  { key: 'talking_to_number', label: 'Talking to', visible: true },
];

export const DEFAULT_SETTINGS = {
  statusColors: DEFAULT_STATUS_COLORS,
  stateColors: DEFAULT_STATE_COLORS,
  columns: DEFAULT_COLUMNS,
  // How often the table re-renders while documents stream in. Frames arrive
  // per event; painting per event is what melts a busy tenant's tab.
  renderCoalesceMs: 250,
  // Used only when the cable never confirms — see useLiveEntities.
  fallbackPollMs: 10000,
};

/**
 * Deep-ish merge of stored settings over defaults.
 *
 * Colour maps merge KEY BY KEY rather than replacing wholesale: a stored map
 * written before a new status existed would otherwise hide that status's
 * default and render it unstyled. Columns are taken whole when stored, because
 * order and visibility are a single user decision — but any column added to
 * DEFAULT_COLUMNS later is appended so a new field is never silently missing.
 */
function merge(stored) {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_SETTINGS };

  const columns = Array.isArray(stored.columns) && stored.columns.length
    ? [
        ...stored.columns,
        ...DEFAULT_COLUMNS.filter((d) => !stored.columns.some((c) => c.key === d.key)),
      ]
    : DEFAULT_COLUMNS;

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    statusColors: { ...DEFAULT_STATUS_COLORS, ...(stored.statusColors || {}) },
    stateColors: { ...DEFAULT_STATE_COLORS, ...(stored.stateColors || {}) },
    columns,
  };
}

/**
 * Read the settings for the current scope.
 *
 * Never throws. localStorage is unavailable in a private window, can be
 * cleared, and throws outright in some embedded contexts — a dashboard that
 * fails to render because a preference could not be read is a worse outcome
 * than one rendered with defaults.
 */
export function getLiveSettings() {
  try {
    const raw = localStorage.getItem(storageKey());
    return merge(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Merge a patch into the stored settings and return the result. */
export function saveLiveSettings(patch) {
  const next = merge({ ...getLiveSettings(), ...(patch || {}) });
  try {
    localStorage.setItem(storageKey(), JSON.stringify(next));
  } catch {
    // Quota or a blocked store — the caller still gets the merged object, so
    // the change applies for this session even when it cannot be persisted.
  }
  return next;
}

/**
 * Drop the stored settings for this scope.
 *
 * Not a nicety: a palette edited to unreadable — white on white, every status
 * the same colour — otherwise wedges the dashboard with no way back that
 * doesn't involve devtools.
 */
export function resetLiveSettings() {
  try {
    localStorage.removeItem(storageKey());
  } catch {
    // Nothing stored, or no store. Defaults apply either way.
  }
  return { ...DEFAULT_SETTINGS };
}

/** Colour for a `status` value, or null when the value has no mapping. */
export function statusColor(status, settings = getLiveSettings()) {
  if (!status) return null;
  return settings.statusColors[String(status).toLowerCase()] || null;
}

/** Colour for a `state` value, or null when the value has no mapping. */
export function stateColor(state, settings = getLiveSettings()) {
  if (!state) return null;
  return settings.stateColors[String(state).toLowerCase()] || null;
}
