/**
 * Widgets API Service
 * Based on AngularJS: va-voipbox-admin/src/scripts/services/widgets/resource.js
 *
 * Endpoints:
 * - GET /api/widgets - List all widgets
 * - GET /api/widgets/:id - Get widget by ID
 * - POST /api/widgets - Create widget
 * - PATCH /api/widgets/:id - Update widget
 * - DELETE /api/widgets/:id - Delete widget
 * - GET /api/queries - List available queries for widgets
 * - GET /api/queries/:id - Get query details (params, fields)
 */
import { apiService, toFormData } from '../apiService';

export const widgetsApi = {
  /**
   * Get all widgets with optional filters
   */
  getWidgets: async (params = {}) => {
    const queryParams = {
      page: 1,
      per_page: 100,
      order_by: 'created_at',
      order_type: 'desc',
      ...params
    };
    const queryString = new URLSearchParams(queryParams).toString();
    const url = `/api/widgets?${queryString}`;
    return apiService.get(url, {}, 'fetching widgets', false);
  },

  /**
   * Get widget by ID
   */
  getWidget: async (id) => {
    return apiService.get(`/api/widgets/${id}`, {}, 'fetching widget', false);
  },

  /**
   * Create a new widget
   */
  createWidget: async (widgetData) => {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Map title to name if present
    const data = { ...widgetData };
    if (data.title && !data.name) {
      data.name = data.title;
      delete data.title;
    }

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(data);

    return apiService.post('/api/widgets', formData, headers, 'creating widget', false);
  },

  /**
   * Update an existing widget
   */
  updateWidget: async (id, widgetData) => {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Map title to name if present
    const data = { ...widgetData };
    if (data.title && !data.name) {
      data.name = data.title;
      delete data.title;
    }

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(data);

    return apiService.patch(`/api/widgets/${id}`, formData, headers, 'updating widget', false);
  },

  /**
   * Delete a widget
   */
  deleteWidget: async (id) => {
    return apiService.delete(`/api/widgets/${id}`, {}, 'deleting widget', false);
  },

  /**
   * Duplicate a widget
   */
  duplicateWidget: async (id) => {
    return apiService.post(`/api/widgets/${id}?action=duplicate`, '', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, 'duplicating widget', false);
  },

  /**
   * Get available queries for widgets
   */
  getQueries: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/api/queries${queryString ? `?${queryString}` : ''}`;
    return apiService.get(url, {}, 'fetching queries', false);
  },

  /**
   * Get query by ID (includes params and fields)
   */
  getQuery: async (id) => {
    return apiService.get(`/api/queries/${id}`, {}, 'fetching query', false);
  },

  /**
   * Get available widget types
   */
  getWidgetTypes: () => [
    { value: 'counter', label: 'Counter', description: 'Single value counter' },
    { value: 'table', label: 'Table', description: 'Data table view' },
    { value: 'pie', label: 'Pie Chart', description: 'Pie chart visualization' },
    { value: 'line', label: 'Line Chart', description: 'Time series line chart' },
    { value: 'bar', label: 'Bar Chart', description: 'Bar chart comparison' },
  ],

  /**
   * Get available data sources (summary types)
   */
  getDataSources: () => [
    { value: 'summary', label: 'Summary Stats', fields: ['available', 'onCall', 'onBreak', 'waiting', 'activeCalls', 'totalToday'] },
    { value: 'agents', label: 'Live Agents', fields: ['available', 'onCall', 'onBreak', 'waiting', 'total'] },
    { value: 'calls', label: 'Live Calls', fields: ['activeCalls', 'totalToday', 'averageDuration', 'totalDuration'] },
    { value: 'registrations', label: 'SIP Registrations', fields: ['registered', 'total', 'offline'] },
  ],
};

export default widgetsApi;
