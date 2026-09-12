import { apiService } from '../apiService';

export const logsApi = {
  // Main logs endpoint (following exact AngularJS pattern)
  fetchLogs: (params) => {
    // Build parameters exactly like AngularJS logsResource pattern
    const filters = {
      page: params.page || 1,
      per_page: params.per_page || 50,  // Use per_page like AngularJS
    };

    // Add sorting if provided (AngularJS uses order_by and order_type)
    if (params.order_by) {
      filters.order_by = params.order_by;
      filters.order_type = params.order_type || 'desc';  // AngularJS uses order_type
    }

    // Add subject filters exactly like AngularJS parameters
    if (params.alert !== undefined) {
      filters.alert = params.alert;
    }
    if (params.subject) {
      filters.subject = params.subject;
    }
    if (params.subject_uuid) {
      filters.subject_uuid = params.subject_uuid;
    }

    // Add search filter
    if (params.search) {
      filters.search = params.search;
    }

    // Add level filter
    if (params.level) {
      filters.level = params.level;
    }

    // Add event_type filter
    if (params.event_type) {
      filters.event_type = params.event_type;
    }

    // Add time range filters (unix timestamps)
    if (params.from) {
      filters.from = params.from;
    }
    if (params.to) {
      filters.to = params.to;
    }

    // Build query string exactly like AngularJS: /api/logs?:filter (like queriesResource)
    const queryString = new URLSearchParams(filters).toString();
    return apiService.get(`/api/logs?${queryString}`);
  },

  // Get available subject types (AngularJS: logSubjectTypes)
  fetchSubjectTypes: () => {
    return apiService.get('/api/logs/subjects');
  },

  // Get available applications (AngularJS: logApps)
  fetchApps: () => {
    return apiService.get('/api/logs/apps');
  },

  // Get subjects for a specific type (AngularJS: logSubjects)
  fetchSubjects: (type) => {
    return apiService.get(`/api/logs/subject_uuids?type=${encodeURIComponent(type)}`);
  },

  // Export logs
  exportLogs: (format, params) => {
    const filters = {
      ...params,
      export: format
    };
    const queryString = new URLSearchParams(filters).toString();
    return apiService.get(`/api/logs/?${queryString}`);
  },

  // Fetch available log sources
  fetchSources: () =>
    apiService.get('/api/logs/sources', {}, 'fetching log sources', false),

  // Fetch log statistics
  fetchStats: () =>
    apiService.get('/api/logs/stats', {}, 'fetching log stats', false),

  // Fetch logs by hostname
  fetchByHost: (hostname) =>
    apiService.get(`/api/logs/host/${encodeURIComponent(hostname)}`, {}, `fetching logs for host ${hostname}`, false),

  // Fetch logs by service name
  fetchByService: (serviceName) =>
    apiService.get(`/api/logs/service/${encodeURIComponent(serviceName)}`, {}, `fetching logs for service ${serviceName}`, false),

  // Search logs with query
  search: (query) =>
    apiService.post('/api/logs/search', query, {}, 'searching logs', false),

  // Aggregate for charts — group_by=event_type|level
  fetchAggregate: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiService.get(`/api/logs/aggregate?${qs}`, {}, 'fetching log aggregate', false);
  },

  // Get a single event by its UUID
  fetchEvent: (eventId) =>
    apiService.get(`/api/logs/${encodeURIComponent(eventId)}`),

  // Get distinct event types for filter dropdown
  fetchEventTypes: () =>
    apiService.get('/api/logs/event_types', {}, 'fetching event types', false),

  // Export logs by time range and format
  exportByRange: (format = 'json', range = '1h') => {
    const queryString = new URLSearchParams({ format, range }).toString();
    return apiService.get(`/api/logs/export?${queryString}`, {}, 'exporting logs', false);
  },
};

export default logsApi;