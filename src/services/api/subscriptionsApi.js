import { apiService, toFormData } from '../apiService';

/**
 * Subscriptions API Service
 * Handles all subscription management operations based on AngularJS legacy patterns
 */

export const subscriptionsApi = {
  /**
   * Get all subscriptions with optional filtering
   * @param {Object} params - Query parameters (page, per_page, search, environment_uuid, tariff_uuid, status, etc.)
   * @returns {Promise<Array>} - Array of subscription objects
   */
  getSubscriptions: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/api/subscriptions${queryString ? `?${queryString}` : ''}`;
    return apiService.get(url, {}, 'fetching subscriptions', false);
  },

  /**
   * Get a single subscription by ID
   * @param {string} subscriptionId - The subscription ID
   * @returns {Promise<Object>} - Subscription object
   */
  getSubscription: async (subscriptionId) => {
    const url = `/api/subscriptions/${subscriptionId}`;
    return apiService.get(url, {}, `fetching subscription ${subscriptionId}`, false);
  },

  /**
   * Create a new subscription
   * @param {Object} subscriptionData - Subscription data
   * @returns {Promise<Object>} - Created subscription object
   */
  createSubscription: async (subscriptionData) => {
    const url = `/api/subscriptions`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(subscriptionData);

    return apiService.post(url, formData, headers, 'creating subscription', true);
  },

  /**
   * Update an existing subscription
   * @param {string} subscriptionId - The subscription ID
   * @param {Object} subscriptionData - Updated subscription data
   * @returns {Promise<Object>} - Updated subscription object
   */
  updateSubscription: async (subscriptionId, subscriptionData) => {
    const url = `/api/subscriptions/${subscriptionId}`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(subscriptionData);

    return apiService.patch(url, formData, headers, `updating subscription ${subscriptionId}`, true);
  },

  /**
   * Delete a subscription
   * @param {string} subscriptionId - The subscription ID
   * @returns {Promise<Object>} - Deletion confirmation
   */
  deleteSubscription: async (subscriptionId) => {
    const url = `/api/subscriptions/${subscriptionId}`;
    return apiService.delete(url, {}, `deleting subscription ${subscriptionId}`, true);
  },

  /**
   * Add credit to a subscription's balance (top-up)
   * @param {string} subscriptionId - The subscription ID
   * @param {number} amount - Positive integer units to add
   * @returns {Promise<Object>} - Updated subscription object
   */
  creditSubscription: async (subscriptionId, amount) => {
    const url = `/api/subscriptions/${subscriptionId}/credit`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('amount', amount);
    return apiService.post(url, formData, headers, `crediting subscription ${subscriptionId}`, true);
  },

  /**
   * Get a subscription's transactions (period invoices)
   * Each transaction carries amount (signed units), period_start/period_end and
   * meta.fee_units / meta.usage_units breakdown.
   * @param {string} subscriptionId - The subscription ID
   * @returns {Promise<Array>} - Array of transaction objects
   */
  getSubscriptionTransactions: async (subscriptionId) => {
    const url = `/api/subscriptions/${subscriptionId}/transactions`;
    return apiService.get(url, {}, `fetching transactions for subscription ${subscriptionId}`, false);
  },

  /**
   * Cancel a subscription (set to cancel at next period)
   * @param {string} subscriptionId - The subscription ID
   * @returns {Promise<Object>} - Updated subscription object
   */
  cancelSubscription: async (subscriptionId, reason = '') => {
    const url = `/api/subscriptions/${subscriptionId}`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('action', 'cancel');
    if (reason) formData.append('reason', reason);
    return apiService.patch(url, formData, headers, 'canceling subscription', true);
  },

  /**
   * Terminate a subscription (immediate termination)
   * @param {string} subscriptionId - The subscription ID
   * @returns {Promise<Object>} - Updated subscription object
   */
  terminateSubscription: async (subscriptionId) => {
    const url = `/api/subscriptions/${subscriptionId}`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('action', 'terminate');
    return apiService.patch(url, formData, headers, 'terminating subscription', true);
  },

  /**
   * Duplicate a subscription (create a copy)
   * @param {string} subscriptionId - The subscription ID
   * @returns {Promise<Object>} - New subscription object
   */
  duplicateSubscription: async (subscriptionId) => {
    const url = `/api/subscriptions`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const formData = new URLSearchParams();
    formData.append('action', 'duplicate');
    formData.append('source_id', subscriptionId);
    return apiService.post(url, formData, headers, 'duplicating subscription', true);
  },

  /**
   * Get subscription logs/activity
   * @param {string} subscriptionId - The subscription ID
   * @returns {Promise<Array>} - Array of log entries
   */
  getSubscriptionLogs: async (subscriptionId) => {
    // Use the new logs API pattern: GET /api/logs/?page=1&per_page=50&alert=&subject=subscription&subject_uuid={uuid}
    const params = new URLSearchParams({
      page: 1,
      per_page: 50,
      alert: '',
      subject: 'subscription',
      subject_uuid: subscriptionId
    });
    
    const url = `/api/logs/?${params.toString()}`;
    console.log('📡 Fetching subscription logs with new API pattern:', url);
    return apiService.get(url, {}, `fetching subscription logs for ${subscriptionId}`, false);
  },

  /**
   * Get subscription types
   * @returns {Promise<Array>} - Array of subscription types
   */
  getSubscriptionTypes: async () => {
    const url = `/api/subscriptions?action=types`;
    return apiService.get(url, {}, 'fetching subscription types', false);
  },

  /**
   * Get subscription statuses
   * @returns {Promise<Array>} - Array of subscription statuses
   */
  getSubscriptionStatuses: async () => {
    const url = `/api/subscriptions?action=statuses`;
    return apiService.get(url, {}, 'fetching subscription statuses', false);
  },

  /**
   * Get plans for subscriptions
   * @param {Object} params - Query parameters (environment_uuid, etc.)
   * @returns {Promise<Array>} - Array of plan objects
   */
  getPlans: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/api/plans${queryString ? `?${queryString}` : ''}`;
    return apiService.get(url, {}, 'fetching plans', false);
  }
};

export default subscriptionsApi;
