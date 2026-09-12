import { apiService, toFormData } from '../apiService';

/**
 * Feature Flags API — admin management of the Flipper-backed, per-user feature
 * service in voipappz-api.
 *
 *   GET   /api/feature_flags            → [{ name, label, global, percentage_of_actors, users, environments }]
 *   PATCH /api/feature_flags/:name      → same shape, after applying one gate
 *
 * A "gate" is one of:
 *   { scope: 'global',      enabled }
 *   { scope: 'user',        uuid, enabled }
 *   { scope: 'environment', uuid, enabled }
 *   { scope: 'percentage',  percentage }   // 0..100 of users
 *
 * (User-login OTP is NOT here — it's a per-environment profile setting.)
 */
export const featureFlagsApi = {
  list: async () =>
    apiService.get('/api/feature_flags', {}, 'fetching feature flags', false),

  /** Apply one gate; resolves to the flag's updated state. */
  setGate: async (name, { scope, uuid, enabled, percentage } = {}) => {
    const payload = { scope };
    if (uuid !== undefined) payload.uuid = uuid;
    if (enabled !== undefined) payload.enabled = enabled ? 'true' : 'false';
    if (percentage !== undefined) payload.percentage = String(percentage);

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    return apiService.patch(
      `/api/feature_flags/${encodeURIComponent(name)}`,
      toFormData(payload),
      headers,
      `updating feature flag ${name}`,
      true,
    );
  },
};

export default featureFlagsApi;
