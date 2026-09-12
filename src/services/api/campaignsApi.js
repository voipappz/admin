import { apiService, toFormData } from '../apiService';

/**
 * Campaigns API Service
 * Handles all campaign management operations including CRUD, run/stop actions, and number management
 */
export const campaignsApi = {
  /**
   * Get all campaigns with optional filtering
   * @param {Object} params - Query parameters (page, per_page, search, etc.)
   * @returns {Promise<Object>} - Campaigns list with pagination info
   */
  getCampaigns: async (params = {}) => {
    if (params.limit) {
      params.per_page = params.limit;
      delete params.limit;
    }

    const queryParts = [];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParts.push(`${key}=${encodeURIComponent(value)}`);
      }
    }

    const queryString = queryParts.join('&');
    const url = `/api/campaigns${queryString ? `?${queryString}` : ''}`;
    const response = await apiService.get(url, {}, 'fetching campaigns', false);

    if (Array.isArray(response)) {
      return response;
    } else if (response?.data && Array.isArray(response.data)) {
      return response;
    }
    return response;
  },

  /**
   * Get a single campaign by ID
   * @param {string} id - The campaign UUID
   * @returns {Promise<Object>} - Campaign object
   */
  getCampaign: async (id) => {
    const url = `/api/campaigns/${id}`;
    return apiService.get(url, {}, `fetching campaign ${id}`, false);
  },

  /**
   * Create a new campaign
   * @param {Object} data - Campaign data
   * @returns {Promise<Object>} - Created campaign object
   */
  createCampaign: async (data) => {
    const url = `/api/campaigns`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = toFormData(data);
    return apiService.post(url, formData, headers, 'creating campaign', true);
  },

  /**
   * Update an existing campaign
   * @param {string} id - The campaign UUID
   * @param {Object} data - Updated campaign data
   * @returns {Promise<Object>} - Updated campaign object
   */
  updateCampaign: async (id, data) => {
    const url = `/api/campaigns/${id}`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = toFormData(data);
    return apiService.patch(url, formData, headers, `updating campaign ${id}`, true);
  },

  /**
   * Delete a campaign
   * @param {string} id - The campaign UUID
   * @returns {Promise<Object>} - Deletion confirmation
   */
  deleteCampaign: async (id) => {
    const url = `/api/campaigns/${id}`;
    return apiService.delete(url, {}, `deleting campaign ${id}`, true);
  },

  /**
   * Run a campaign (set status to 'run')
   * @param {string} id - The campaign UUID
   * @returns {Promise<Object>} - Updated campaign object
   */
  runCampaign: async (id) => {
    const url = `/api/campaigns/${id}`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('action', 'run');
    return apiService.patch(url, formData, headers, `running campaign ${id}`, true);
  },

  /**
   * Stop a campaign (set status to 'stop')
   * @param {string} id - The campaign UUID
   * @returns {Promise<Object>} - Updated campaign object
   */
  stopCampaign: async (id) => {
    const url = `/api/campaigns/${id}`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('action', 'stop');
    return apiService.patch(url, formData, headers, `stopping campaign ${id}`, true);
  },

  /**
   * Duplicate a campaign
   * @param {string} id - The source campaign UUID
   * @param {string} name - Name for the duplicated campaign
   * @returns {Promise<Object>} - Created campaign object
   */
  duplicateCampaign: async (id, name) => {
    const url = `/api/campaigns`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('action', 'duplicate');
    formData.append('uuid', id);
    formData.append('name', name);
    return apiService.post(url, formData, headers, 'duplicating campaign', true);
  },

  /**
   * Add numbers to a campaign
   * @param {string} id - The campaign UUID
   * @param {Array<string>} numbers - Array of phone numbers to add
   * @returns {Promise<Object>} - Updated campaign object
   */
  addNumbersToCampaign: async (id, numbers) => {
    const url = `/api/campaigns/${id}`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    numbers.forEach(num => formData.append('numbers[]', num));
    return apiService.patch(url, formData, headers, `adding numbers to campaign ${id}`, true);
  },

  /**
   * Get campaign numbers
   * @param {string} campaignUuid - The campaign UUID
   * @param {Object} params - Query parameters (page, per_page, etc.)
   * @returns {Promise<Object>} - Campaign numbers with pagination
   */
  getCampaignNumbers: async (campaignUuid, params = {}) => {
    const queryParts = [`campaign_uuid=${encodeURIComponent(campaignUuid)}`];
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParts.push(`${key}=${encodeURIComponent(value)}`);
      }
    }
    const url = `/api/campaign_numbers?${queryParts.join('&')}`;
    return apiService.get(url, {}, 'fetching campaign numbers', false);
  },

  /**
   * Delete a campaign number
   * @param {string} id - The campaign number UUID
   * @returns {Promise<Object>} - Deletion confirmation
   */
  deleteCampaignNumber: async (id) => {
    const url = `/api/campaign_numbers/${id}`;
    return apiService.delete(url, {}, `deleting campaign number ${id}`, true);
  },

  /**
   * Batch delete campaign numbers
   * @param {Array<string>} uuids - Array of campaign number UUIDs
   * @returns {Promise<Object>} - Batch operation result
   */
  batchDeleteCampaignNumbers: async (uuids) => {
    const url = `/api/campaign_numbers`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('action', 'delete');
    uuids.forEach(uuid => formData.append('uuids[]', uuid));
    return apiService.patch(url, formData, headers, 'batch deleting campaign numbers', true);
  },

  /**
   * Reset campaign numbers (set back to initial status)
   * @param {Array<string>} uuids - Array of campaign number UUIDs
   * @returns {Promise<Object>} - Batch operation result
   */
  resetCampaignNumbers: async (uuids) => {
    const url = `/api/campaign_numbers`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('action', 'reset');
    uuids.forEach(uuid => formData.append('uuids[]', uuid));
    return apiService.patch(url, formData, headers, 'resetting campaign numbers', true);
  },
};

export default campaignsApi;
