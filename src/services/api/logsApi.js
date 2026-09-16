import { apiService } from '../apiService';

// One subject's app log lines: GET /api/logs?subject_uuid=<uuid> answers
// { total, data: [{ time, app, severity, action, message, fields, ... }] }
// (the API's Log store). The other helpers that lived here called endpoints
// that no longer exist and had no callers; durable records are eventsApi.
export const logsApi = {
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

    const queryString = new URLSearchParams(filters).toString();
    return apiService.get(`/api/logs?${queryString}`);
  },
};

export default logsApi;
