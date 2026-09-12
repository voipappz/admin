import { apiService } from '../apiService';

// Events API — queries event_store_events table
const BASE = '/api/events';

// All events calls skip the circuit breaker — event/syslog failures must not
// poison the global circuit breaker and block unrelated API requests.
export const eventsApi = {
  fetchLogs: (params) => {
    const filters = {
      page: params.page || 1,
      per_page: params.per_page || 50,
    };

    if (params.order_by) {
      filters.order_by = params.order_by;
      filters.order_type = params.order_type || 'desc';
    }

    if (params.alert !== undefined) filters.alert = params.alert;
    if (params.subject) filters.subject = params.subject;
    if (params.subject_uuid) filters.subject_uuid = params.subject_uuid;
    if (params.call_uuid) filters.call_uuid = params.call_uuid;
    if (params.user_uuid) filters.user_uuid = params.user_uuid;
    if (params.subscription_uuid) filters.subscription_uuid = params.subscription_uuid;
    if (params.service_uuid) filters.service_uuid = params.service_uuid;
    if (params.actor) filters.actor = params.actor;
    if (params.search) filters.search = params.search;
    if (params.level) filters.level = params.level;
    if (params.event_type) filters.event_type = params.event_type;
    if (params.from) filters.from = params.from;
    if (params.to) filters.to = params.to;

    const queryString = new URLSearchParams(filters).toString();
    return apiService.get(`${BASE}?${queryString}`, {}, 'fetching events', false, true);
  },

  fetchSubjectTypes: () => apiService.get(`${BASE}/subjects`, {}, 'fetching subject types', false, true),
  fetchApps: () => apiService.get(`${BASE}/apps`, {}, 'fetching event apps', false, true),
  fetchSubjects: (type) => apiService.get(`${BASE}/subject_uuids?type=${encodeURIComponent(type)}`, {}, 'fetching subjects', false, true),

  exportLogs: (format, params) => {
    const filters = { ...params, export: format };
    const queryString = new URLSearchParams(filters).toString();
    return apiService.get(`${BASE}/?${queryString}`, {}, 'exporting events', false, true);
  },

  fetchSources: () => apiService.get(`${BASE}/sources`, {}, 'fetching event sources', false, true),
  fetchStats: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiService.get(`${BASE}/stats${qs ? `?${qs}` : ''}`, {}, 'fetching event stats', false, true);
  },

  fetchAggregate: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiService.get(`${BASE}/aggregate?${qs}`, {}, 'fetching event aggregate', false, true);
  },

  fetchEvent: (eventId) => apiService.get(`${BASE}/${encodeURIComponent(eventId)}`, {}, 'fetching event', false, true),
  fetchEventTypes: () => apiService.get(`${BASE}/event_types`, {}, 'fetching event types', false, true),

  // Event count per subject_uuid for one subject type — one call for the whole
  // list, returns { "<uuid>": <count> }. Used for per-row "N events" badges.
  fetchCounts: (type) =>
    apiService.get(`${BASE}/counts?type=${encodeURIComponent(type)}`, {}, 'fetching event counts', false, true),
};

export default eventsApi;
