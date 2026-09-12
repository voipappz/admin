/**
 * Canonical status -> color map (shared design token). Ported from app,
 * modeled on nimbus-admin's own legacy STATUS_BG_COLORS. Returns a MUI
 * palette key so consumers stay theme-driven rather than hardcoding hex.
 */
const STATUS_TO_COLOR = {
  completed: 'success',
  answer: 'success',
  answered: 'success',
  in_progress: 'primary',
  'in-progress': 'primary',
  in_call: 'primary',
  incall: 'primary',
  active: 'primary',
  ringing: 'default',
  queued: 'default',
  no_answer: 'warning',
  'no-answer': 'warning',
  busy: 'warning',
  failed: 'error',
  canceled: 'default',
  cancelled: 'default',
  available: 'success',
  on_break: 'warning',
  break: 'warning',
  offline: 'default',
  waiting: 'info'
};

/** MUI color key for a status string (defaults to 'default'). */
export function statusColor(status) {
  if (!status) return 'default';
  return STATUS_TO_COLOR[String(status).toLowerCase()] || 'default';
}

/** Human label for a status: snake/kebab -> Title Case. */
export function statusLabel(status) {
  if (!status) return '—';
  return String(status).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
