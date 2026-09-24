import { apiService } from '../apiService';

/**
 * Alerts — threshold breaches, written by Jobs::Tasks::PersistThresholdAlerts.
 *
 * These used to call /tasks/monitoring_alerts*. Endpoints::Tasks has no `auth!`,
 * so those routes answered anyone: an unauthenticated GET to
 * /tasks/monitoring_alerts/stats and /config returned 200 in production, handing
 * out the fleet's alert state and every threshold in alerts.yaml. They live on
 * /api/monitoring/alerts* now, behind auth, alongside the rest of monitoring.
 */
const BASE = '/api/monitoring/alerts';

export const alertsApi = {
  // { alerts[], total, timestamp }
  getAlerts: () =>
    apiService.get(BASE, {}, 'fetching alerts', false, true),

  // { total, by_level: { critical, warning, info }, by_type, recent_24h }
  getStats: () =>
    apiService.get(`${BASE}/stats`, {}, 'fetching alert stats', false, true),

  getBySeverity: (level) =>
    apiService.get(`${BASE}/severity/${encodeURIComponent(level)}`, {}, `fetching ${level} alerts`, false, true),

  /** The parsed config/alerts.yaml — the thresholds the backend alerts on. */
  getConfig: () =>
    apiService.get(`${BASE}/config`, {}, 'fetching alert config', false, true),

  // Silent: the rail removes the alert itself, and "Mark all read" would
  // otherwise raise one toast per alert.
  acknowledge: (id) =>
    apiService.put(`${BASE}/${encodeURIComponent(id)}/acknowledge`, {}, {}, `acknowledging alert ${id}`, false),

  dismiss: (id) =>
    apiService.delete(`${BASE}/${encodeURIComponent(id)}`, {}, `dismissing alert ${id}`, true),
};

export default alertsApi;
