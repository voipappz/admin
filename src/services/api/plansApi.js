import { apiService, toFormData } from '../apiService';

/**
 * Plans API Service
 * Handles all plan management operations
 */

export const plansApi = {
  /**
   * Get all plans with optional filtering
   * @param {Object} params - Query parameters (e.g., customer_uuid)
   * @returns {Promise<Array>} - Array of plan objects
   */
  getPlans: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/api/plans${queryString ? `?${queryString}` : ''}`;
    return apiService.get(url, {}, 'fetching plans', false);
  },

  /**
   * Get a single plan by ID
   * @param {string} planId - The plan ID
   * @returns {Promise<Object>} - Plan object
   */
  getPlan: async (planId) => {
    const url = `/api/plans/${planId}`;
    return apiService.get(url, {}, `fetching plan ${planId}`, false);
  },

  /**
   * Create a new plan
   * @param {Object} planData - Plan data
   * @returns {Promise<Object>} - Created plan object
   */
  createPlan: async (planData) => {
    const url = `/api/plans`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(planData);

    return apiService.post(url, formData, headers, 'creating plan', true);
  },

  /**
   * Update an existing plan
   * @param {string} planId - The plan ID
   * @param {Object} planData - Updated plan data
   * @returns {Promise<Object>} - Updated plan object
   */
  updatePlan: async (planId, planData) => {
    const url = `/api/plans/${planId}`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(planData);

    return apiService.patch(url, formData, headers, `updating plan ${planId}`, true);
  },

  /**
   * Delete a plan
   * @param {string} planId - The plan ID
   * @returns {Promise<Object>} - Deletion confirmation
   */
  deletePlan: async (planId) => {
    const url = `/api/plans/${planId}`;
    return apiService.delete(url, {}, `deleting plan ${planId}`, true);
  },

  /**
   * Get available plan period units from the API (Plan::PERIODS).
   * The admin stays "stupid" — it sources the enum from the backend rather than
   * hardcoding it. Falls back to the known set only if the request fails.
   * @returns {Promise<Array>} - Array of period options
   */
  getPeriods: async () => {
    try {
      const res = await apiService.get('/api/plans?action=periods', {}, 'fetching plan periods', false);
      if (Array.isArray(res) && res.length) return res;
    } catch {
      // fall through to fallback
    }
    return ['hour', 'day', 'week', 'month', 'year'];
  },

  /**
   * Routing-strategy options for the plan.type select — [{ val, name }] from
   * the API (config lives in Plan::STRATEGIES). Never hardcode the list.
   * @returns {Promise<Array<{val:string,name:string}>>}
   */
  getStrategies: async () => {
    try {
      const res = await apiService.get('/api/plans?action=strategies', {}, 'fetching plan strategies', false);
      if (Array.isArray(res) && res.length) return res;
    } catch {
      // fall through to fallback
    }
    return [{ val: 'lcr', name: 'Least Cost Routing (LCR)' }];
  },

  // ===== Plan Items API =====

  /**
   * Get items for a plan
   * @param {string} planId - The plan UUID
   * @returns {Promise<Array>} - Array of plan items
   */
  getItems: async (planId) => {
    const url = `/api/plans/${planId}/items`;
    return apiService.get(url, {}, `fetching plan items for ${planId}`, false);
  },

  /**
   * Set items for a plan (batch operation)
   * API expects: items[0][name], items[0][val], items[1][name], ...
   * Required fields per item: name, val
   * @param {string} planId - The plan UUID
   * @param {Array} itemsArray - Array of item objects {name, val}
   * @returns {Promise<Object>} - Result with items array
   */
  setItems: async (planId, itemsArray) => {
    const url = `/api/plans/${planId}/items`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Build form data with items array format expected by API
    const formData = new URLSearchParams();
    itemsArray.forEach((item, index) => {
      formData.append(`items[${index}][name]`, item.name || '');
      formData.append(`items[${index}][val]`, item.val || '');
    });

    console.log('Setting items for plan:', planId, formData.toString());
    return apiService.post(url, formData, headers, 'setting plan items', true);
  },

  /**
   * Delete an item from a plan
   * @param {string} itemUuid - The item UUID
   * @returns {Promise<Object>} - Deletion confirmation
   */
  deleteItem: async (itemUuid) => {
    const url = `/api/plans/items/${itemUuid}`;
    return apiService.delete(url, {}, `deleting plan item ${itemUuid}`, true);
  },

  /**
   * Import items from CSV file
   * @param {string} planId - The plan UUID
   * @param {File} file - CSV file to import
   * @returns {Promise<Object>} - Import result
   */
  importItems: async (planId, file) => {
    const url = `/api/plans/${planId}/items`;
    const formData = new FormData();
    formData.append('file', file);
    return apiService.post(url, formData, {}, 'importing plan items', true);
  },
};

export default plansApi;
