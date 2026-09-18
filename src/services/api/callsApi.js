import { apiService, toFormData } from '../apiService';

/**
 * Calls API Service
 * Handles call history management and search operations
 * Based on AngularJS admin legacy patterns: /src/scripts/services/calls/resource.js
 */

export const callsApi = {
  /**
   * Get dynamic fields configuration for calls
   * @returns {Promise<Array>} - Dynamic fields array for search and display
   */
  getFields: async () => {
    const url = `/api/calls?actions=fields`;
    return apiService.get(url, {}, 'fetching call fields', false);
  },

  /**
   * Get calls segments for advanced search (legacy action=segments)
   * @returns {Promise<Array>} - Available search segments
   */
  getSegments: async () => {
    const url = `/api/calls?action=segments`;
    return apiService.get(url, {}, 'fetching call segments', false);
  },

  /**
   * Get table column definitions (legacy action=columns)
   * @returns {Promise<Array>} - Table column configuration
   */
  getColumns: async () => {
    const url = `/api/calls?action=columns`;
    return apiService.get(url, {}, 'fetching call columns', false);
  },

  /**
   * Get saved search parameters (legacy action=params)
   * @returns {Promise<Array>} - Saved search parameters
   */
  getParams: async () => {
    const url = `/api/calls?action=params`;
    return apiService.get(url, {}, 'fetching call params', false);
  },

  /**
   * Save search parameters for persistence
   * @param {Object} params - Search parameters to save
   * @returns {Promise<Object>} - Save confirmation
   */
  saveParams: async (params) => {
    const url = `/api/calls?action=save_params`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const formData = toFormData(params);
    return apiService.patch(url, formData, headers, 'saving call search params', true);
  },

  /**
   * Get calls with filtering and pagination
   * @param {Object} params - Query parameters (page, per_page, search filters, etc.)
   * @returns {Promise<Object>} - Calls list with pagination info including X-Total header
   */
  getCalls: async (params = {}) => {
    // Convert 'limit' to 'per_page' to match API format
    if (params.limit) {
      params.per_page = params.limit;
      delete params.limit;
    }
    
    const queryString = new URLSearchParams(params).toString();
    const url = `/api/calls${queryString ? `?${queryString}` : ''}`;
    return apiService.get(url, {}, 'fetching calls', false);
  },

  /** Counts over the full filtered call set, used by Calls summary cards. */
  getAggregate: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiService.get(`/api/calls/aggregate${queryString ? `?${queryString}` : ''}`, {}, 'fetching call summary', false);
  },

  /**
   * Get a single call by ID
   * @param {string} callId - The call ID/UUID
   * @returns {Promise<Object>} - Call object with details
   */
  getCall: async (callId) => {
    const url = `/api/calls/${callId}`;
    return apiService.get(url, {}, `fetching call ${callId}`, false);
  },

  /**
   * Get call CDRs (Call Detail Records)
   * @param {string} callId - The call ID/UUID 
   * @returns {Promise<Array>} - CDR records array
   */
  getCallCDRs: async (callId) => {
    const url = `/api/calls/${callId}?type=cdrs`;
    return apiService.get(url, {}, `fetching CDRs for call ${callId}`, false);
  },

  /**
   * Get call logs
   * @param {string} callId - The call ID/UUID
   * @returns {Promise<Object>} - Call logs data
   */
  getCallLogs: async (callId) => {
    const url = `/api/calls/${callId}?type=logs`;
    return apiService.get(url, {}, `fetching logs for call ${callId}`, false);
  },

  /**
   * Get spanning tree data for call
   * @param {string} callId - The call ID/UUID
   * @returns {Promise<Array>} - Spanning tree data
   */
  getCallSpanning: async (callId) => {
    const url = `/api/calls/${callId}?type=spanning`;
    return apiService.get(url, {}, `fetching spanning data for call ${callId}`, false);
  },

  /**
   * Link call to email (send recording/details)
   * @param {string} callId - The call ID/UUID
   * @param {string} email - Recipient email address
   * @returns {Promise<Object>} - Link confirmation
   */
  linkCall: async (callId, email) => {
    const url = `/api/calls/${callId}/link`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const formData = toFormData({ email });
    return apiService.post(url, formData, headers, `linking call ${callId} to ${email}`, true);
  },

  /**
   * Add number to blacklist from call
   * @param {string} callUuid - The call UUID
   * @param {Object} blacklistData - Blacklist entry data
   * @returns {Promise<Object>} - Blacklist confirmation
   */
  addToBlacklist: async (callUuid, blacklistData = {}) => {
    const url = `/api/blacklists`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const data = { call_uuid: callUuid, ...blacklistData };
    const formData = toFormData(data);
    return apiService.post(url, formData, headers, `adding call ${callUuid} to blacklist`, true);
  },

  /**
   * Remove number from blacklist
   * @param {string} blacklistId - The blacklist entry ID
   * @returns {Promise<Object>} - Removal confirmation
   */
  removeFromBlacklist: async (blacklistId) => {
    const url = `/api/blacklists/${blacklistId}`;
    return apiService.delete(url, {}, `removing blacklist entry ${blacklistId}`, true);
  },

  /**
   * Export calls data to CSV
   * @param {Object} params - Export parameters (columns, filters, etc.)
   * @returns {Promise<Blob>} - CSV file data
   */
  exportCalls: async (params = {}) => {
    const exportParams = { ...params, export: 'csv' };
    const queryString = new URLSearchParams(exportParams).toString();
    const url = `/api/calls?${queryString}`;
    
    // For CSV export, we want the raw response
    const response = await fetch(`${apiService.getApiBaseUrl()}${url}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'Accept': 'text/csv,application/csv,*/*'
      }
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    return await response.blob();
  }
};
