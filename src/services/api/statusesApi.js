import { apiService, toFormData } from '../apiService';

/**
 * Statuses API Service
 * Handles all status management operations including CRUD
 */
export const statusesApi = {
  /**
   * Get all statuses
   * @param {Object} params - Query parameters (page, per_page, etc.)
   * @returns {Promise<Array>} - Array of status objects
   */
  getStatuses: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/api/statuses${queryString ? `?${queryString}` : ''}`;
    return apiService.get(url, {}, 'fetching statuses', false);
  },

  /**
   * Get a single status by ID
   * @param {string} statusId - The status ID
   * @returns {Promise<Object>} - Status object
   */
  getStatus: async (statusId) => {
    const url = `/api/statuses/${statusId}`;
    return apiService.get(url, {}, `fetching status ${statusId}`, false);
  },

  /**
   * Create a new status
   * @param {Object} statusData - Status data (name, color, etc.)
   * @returns {Promise<Object>} - Created status object
   */
  createStatus: async (statusData) => {
    const url = `/api/statuses`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const formData = toFormData(statusData);
    return apiService.post(url, formData, headers, 'creating status', true);
  },

  /**
   * Update an existing status
   * @param {string} statusId - The status ID
   * @param {Object} statusData - Updated status data
   * @returns {Promise<Object>} - Updated status object
   */
  updateStatus: async (statusId, statusData) => {
    const url = `/api/statuses/${statusId}`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const formData = toFormData(statusData);
    return apiService.patch(url, formData, headers, `updating status ${statusId}`, true);
  },

  /**
   * Delete a status
   * @param {string} statusId - The status ID
   * @returns {Promise<Object>} - Deletion confirmation
   */
  deleteStatus: async (statusId) => {
    const url = `/api/statuses/${statusId}`;
    return apiService.delete(url, {}, `deleting status ${statusId}`, true);
  },

  /**
   * The agent-status vocabulary — { wire_key: 'Label' }, straight from the
   * platform's Agent::STATUSES_MAPPINGS. This endpoint exists specifically so
   * an agent on the USER surface can render their own presence picker (see
   * voipappz-api lib/endpoints/statuses.rb), so it's user-token friendly.
   * @returns {Promise<Object>} - key => label map
   */
  getAgentStatuses: async () => {
    return apiService.get('/api/statuses/agent_statuses', {}, 'fetching agent statuses', false);
  },

  /**
   * Publish the signed-in user's agent status. The wire value must be one of
   * getAgentStatuses()'s keys — the API validates against exactly that list.
   * @param {string} userUuid - The user's UUID
   * @param {string} type - Status key (e.g. 'available', 'on_break')
   * @param {string} [name] - Optional name/reason (e.g. a break reason)
   * @returns {Promise<Object>}
   */
  setAgentStatus: async (userUuid, type, name) => {
    // `action` selects the branch; `status` (+ optional `name`, the break
    // reason — the API defaults it to the humanized status) goes in the body.
    const url = `/api/users/${userUuid}?action=status`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const body = toFormData({ status: type, ...(name ? { name } : {}) });
    return apiService.patch(url, body, headers, 'setting agent status', true);
  }
};

export default statusesApi;
