import { apiService, toFormData } from '../apiService';

/**
 * Reports API Service
 * Handles all report management operations including CRUD, execution, and queries
 */

export const reportsApi = {
  /**
   * List the BI dashboards (queries.yml categories) — tabs only, no data.
   * @returns {Promise<Object>} - { dashboards: [{ category, count, reports: [{name, type}] }] }
   */
  getDashboards: async () => {
    return apiService.get('/api/reports/dashboards', {}, 'fetching dashboards', false);
  },

  /**
   * Run one dashboard category: every queries.yml report tagged with that
   * :category:, executed customer/environment-scoped, with auto chart detection.
   * @param {string} category - e.g. 'billing', 'calls', 'queue', 'extensions', 'providers'
   * @param {Object} opts - { startDate, endDate } as epoch seconds
   * @returns {Promise<Object>} - { category, reports: [{ name, type, columns, rows, chart, error? }] }
   */
  runDashboardCategory: async (category, opts = {}) => {
    const queryParts = [];
    if (opts.startDate) queryParts.push(`start_date=${opts.startDate}`);
    if (opts.endDate) queryParts.push(`end_date=${opts.endDate}`);
    const queryString = queryParts.length ? `?${queryParts.join('&')}` : '';
    return apiService.get(
      `/api/reports/dashboards/${encodeURIComponent(category)}${queryString}`,
      {}, `running ${category} dashboard`, false
    );
  },

  /**
   * Get all reports with optional filtering
   * @param {Object} params - Query parameters (page, per_page, search, etc.)
   * @returns {Promise<Array>} - Reports list
   */
  getReports: async (params = {}) => {
    const queryParts = [];

    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.per_page) queryParts.push(`per_page=${params.per_page}`);
    if (params.order_by) queryParts.push(`order_by=${params.order_by}`);
    if (params.order_kind) queryParts.push(`order_kind=${params.order_kind}`);

    const queryString = queryParts.length ? `?${queryParts.join('&')}` : '';
    return apiService.get(`/api/reports${queryString}`, {}, 'fetching reports', false);
  },

  /**
   * Get a single report with full details
   * @param {string} reportId - The report UUID
   * @returns {Promise<Object>} - Report object with details
   */
  getReport: async (reportId) => {
    return apiService.get(`/api/reports/${reportId}?action=load`, {}, 'fetching report', false);
  },

  /**
   * Create a new report
   * @param {Object} reportData - Report data (name, type, query, params, fields, etc.)
   * @returns {Promise<Object>} - Created report object
   */
  createReport: async (reportData) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = toFormData(reportData);
    return apiService.post('/api/reports', formData, headers, 'creating report', true);
  },

  /**
   * Fork a saved report or queries.yml template into a new editable report.
   * The source is left unchanged.
   */
  forkReport: async (reportId, reportData = {}) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = toFormData(reportData);
    return apiService.post(
      `/api/reports/${encodeURIComponent(reportId)}/fork`,
      formData,
      headers,
      'forking report',
      true
    );
  },

  /**
   * Update an existing report
   * @param {string} reportId - The report UUID
   * @param {Object} reportData - Updated report data
   * @returns {Promise<Object>} - Updated report object
   */
  updateReport: async (reportId, reportData) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = toFormData(reportData);
    return apiService.patch(`/api/reports/${reportId}`, formData, headers, 'updating report', true);
  },

  /**
   * Delete a report
   * @param {string} reportId - The report UUID
   * @returns {Promise<void>}
   */
  deleteReport: async (reportId) => {
    return apiService.delete(`/api/reports/${reportId}`, {}, 'deleting report', true);
  },

  /**
   * Run/execute a report with optional filters
   * @param {string} reportId - The report UUID
   * @param {Object} filters - Filter parameters (start_date, end_date, limit, offset, etc.)
   * @returns {Promise<Object>} - Report execution results
   */
  runReport: async (reportId, filters = {}) => {
    const queryParts = ['action=run'];

    if (filters.start_date) queryParts.push(`start_date=${filters.start_date}`);
    if (filters.end_date) queryParts.push(`end_date=${filters.end_date}`);
    if (filters.limit) queryParts.push(`limit=${filters.limit}`);
    if (filters.offset) queryParts.push(`offset=${filters.offset}`);

    // Add any additional filter params
    Object.entries(filters).forEach(([key, value]) => {
      if (!['start_date', 'end_date', 'limit', 'offset'].includes(key) && value !== undefined) {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    });

    const queryString = queryParts.join('&');
    return apiService.get(`/api/reports/${reportId}?${queryString}`, {}, 'running report', false);
  },

  /**
   * Export report data to CSV
   * @param {string} reportId - The report UUID
   * @param {Object} filters - Filter parameters
   * @param {Array} columns - Column names to export
   * @returns {Promise<Blob>} - CSV file blob
   */
  exportReport: async (reportId, filters = {}, columns = []) => {
    const queryParts = ['action=export'];

    if (filters.start_date) queryParts.push(`start_date=${filters.start_date}`);
    if (filters.end_date) queryParts.push(`end_date=${filters.end_date}`);
    if (columns.length) queryParts.push(`columns=${columns.join(',')}`);

    const queryString = queryParts.join('&');
    return apiService.get(`/api/reports/${reportId}?${queryString}`, {}, 'exporting report', false);
  },

  /**
   * Get saved parameters for a report
   * @param {string} reportId - The report UUID
   * @returns {Promise<Object>} - Saved parameters
   */
  getReportParams: async (reportId) => {
    return apiService.get(`/api/reports/${reportId}?action=params`, {}, 'fetching report params', false);
  },

  /**
   * Save parameters for a report
   * @param {string} reportId - The report UUID
   * @param {Object} params - Parameters to save
   * @returns {Promise<Object>} - Saved parameters
   */
  saveReportParams: async (reportId, params) => {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = toFormData({ params });
    return apiService.patch(`/api/reports/${reportId}?action=save_params`, formData, headers, 'saving report params', true);
  },

  /**
   * Get available filter segments for a report
   * @param {string} reportId - The report UUID
   * @returns {Promise<Object>} - Available segments
   */
  getReportSegments: async (reportId) => {
    return apiService.get(`/api/reports/${reportId}?action=segments`, {}, 'fetching report segments', false);
  },

  // ==================== QUERIES ====================

  /**
   * The report/display types the engine supports (Report::TYPES). Server-owned,
   * so a type added there shows up in the pickers without an admin change.
   * @returns {Promise<Array<string>>} - e.g. ['table','call','pie','line','bar',…]
   */
  getTypes: async () => {
    return apiService.get('/api/reports/types', {}, 'fetching report types', false);
  },

  /**
   * Blazer-style smart variables: resolved dropdown options for a query
   * variable, declared once in queries.yml (:smart_variables:). Lets the user
   * pick "Sales" instead of typing a raw occupation_id UUID.
   * @param {string} name - Variable name; omit for every declared variable
   * @returns {Promise<Object>} - { <name>: [{ value, label }] }
   */
  getVariables: async (name) => {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    return apiService.get(`/api/reports/variables${query}`, {}, 'fetching smart variables', false);
  },

  /** Tenant-scoped report execution history from EventAudit. */
  getAudits: async (reportName, limit = 100) => {
    const query = new URLSearchParams();
    if (reportName) query.set('report', reportName);
    query.set('limit', String(limit));
    return apiService.get(`/api/reports/audits?${query}`, {}, 'fetching report history', false);
  },

  /**
   * Get all available queries for report creation
   * @returns {Promise<Array>} - List of queries
   */
  getQueries: async () => {
    return apiService.get('/api/reports/queries', {}, 'fetching queries', false);
  },

  /**
   * Get a single query with its params and fields
   * @param {string} queryId - The query name
   * @returns {Promise<Object>} - Query object with params and fields
   */
  getQuery: async (queryId) => {
    return apiService.get(`/api/reports?name=${encodeURIComponent(queryId)}&action=statement`, {}, 'fetching query', false);
  },

  // POST /api/reports/run — read-only SQL against the application's Postgres DB.
  runAdHoc: async (statement, filters = {}) => {
    // Pass the URLSearchParams object (NOT .toString()) so apiService.post sends
    // it as application/x-www-form-urlencoded. A string would be JSON-encoded and
    // the backend would never parse `statement` → empty query / no data.
    const body = new URLSearchParams({ statement });
    if (filters.start_date) body.append('start_date', filters.start_date);
    if (filters.end_date)   body.append('end_date',   filters.end_date);
    return apiService.post('/api/reports/run', body, {}, 'running ad-hoc query', false);
  },
};

export default reportsApi;
