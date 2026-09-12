import { apiService, toFormData } from '../apiService';

/**
 * Customers API Service
 * Handles customer-level operations including extension number generation
 */

export const customersApi = {
  /**
   * Get a customer by UUID via GET /api/customers/:id
   * @param {string} customerId - Customer UUID
   * @returns {Promise<Object>} - Customer object (uuid, name, profile, node_uuid, etc.)
   */
  getCustomerByUuid: async (customerId) => {
    return apiService.get(`/api/customers/${customerId}`);
  },

  /**
   * Create a new customer via POST /api/customers (root only)
   * @param {Object} data - Customer data (name, enabled, notes, profile, node_uuid)
   * @returns {Promise<Object>} - Created customer object
   */
  createCustomer: async (data) => {
    // Encode profile/meta as key/val (profile[key]=val) like the User screen —
    // NOT JSON.stringify, which the API can't parse into hstore (it produced the
    // ":" garbage values). toFormData also omits empty values, so a blank
    // account_root isn't sent and never hits its UUID validator.
    const formData = toFormData(data);
    return apiService.post('/api/customers', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  },

  /**
   * Update a customer via PATCH /api/customers/:id
   * @param {string} customerId - Customer UUID
   * @param {Object} data - Fields to update (e.g. { node_uuid: '...' })
   * @returns {Promise<Object>} - Updated customer object
   */
  updateCustomer: async (customerId, data) => {
    // Encode profile/meta as key/val (profile[key]=val) like the User screen,
    // so the API parses them into hstore correctly (JSON.stringify produced the
    // ":" garbage). toFormData omits empty values, so a blank account_root isn't
    // sent and never trips its UUID validator.
    const formData = toFormData(data);
    return apiService.patch(`/api/customers/${customerId}`, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  },

  /**
   * Get the next available extension number for a customer's domain
   * @param {string} environmentUuid - Environment UUID to get customer context
   * @returns {Promise<Object>} - Object with extension_number property
   */
  getNextExtension: async (environmentUuid) => {
    if (!environmentUuid) {
      throw new Error('Environment UUID is required');
    }

    try {
      // Query all extensions for this environment
      const params = new URLSearchParams({
        page: 1,
        per_page: 9999, // Get all extensions to find the max
        'search[environment_uuid]': environmentUuid,
        'search[enabled]': 'true'
      });

      const url = `/api/extensions?${params.toString()}`;
      const response = await apiService.get(url, {}, 'fetching extensions', false);

      // Extract extensions array from response
      const extensions = Array.isArray(response) ? response : (response?.data || []);

      // Find the maximum extension number from numeric usernames
      let maxExtension = 0;
      extensions.forEach(ext => {
        const username = ext.username || ext.extension_username;
        // Only consider numeric usernames for auto-increment
        if (username && /^\d+$/.test(username)) {
          const num = parseInt(username, 10);
          if (num > maxExtension && num < 999999) {
            maxExtension = num;
          }
        }
      });

      // Return next extension number (or default starting number)
      const nextExtension = maxExtension > 0 ? maxExtension + 1 : Math.floor(Math.random() * 9000) + 1000;

      return { extension_number: nextExtension.toString() };
    } catch (error) {
      console.error('Error getting next extension:', error);
      // Fallback to random number if query fails
      const randomExtension = Math.floor(Math.random() * 9000) + 1000;
      return { extension_number: randomExtension.toString() };
    }
  },

  /**
   * Validate if an extension username is available
   * @param {string} username - Extension username to validate
   * @param {string} environmentUuid - Environment UUID for domain context
   * @returns {Promise<Object>} - Object with { available: boolean, message: string }
   */
  validateExtensionUsername: async (username, environmentUuid) => {
    if (!username || !environmentUuid) {
      throw new Error('Username and environment UUID are required');
    }

    const params = new URLSearchParams({
      username: username,
      environment_uuid: environmentUuid
    });

    const url = `/api/extensions/validate?${params.toString()}`;

    try {
      const response = await apiService.get(url, {}, 'validating extension username', false);
      return response;
    } catch {
      // If endpoint doesn't exist yet, check via extensions list
      return customersApi.checkExtensionExists(username, environmentUuid);
    }
  },

  /**
   * Check if extension username exists by querying extensions list
   * Fallback method if validate endpoint doesn't exist
   * @param {string} username - Extension username to check
   * @param {string} environmentUuid - Environment UUID
   * @returns {Promise<Object>} - Object with { available: boolean, message: string }
   */
  checkExtensionExists: async (username, environmentUuid) => {
    try {
      const params = new URLSearchParams({
        page: 1,
        per_page: 1,
        'search[username]': username,
        'search[environment_uuid]': environmentUuid
      });

      const url = `/api/extensions?${params.toString()}`;
      const response = await apiService.get(url, {}, 'checking extension existence', false);

      // Check if any extensions were returned with this exact username
      const extensions = Array.isArray(response) ? response : (response?.data || []);
      const exists = extensions.some(ext =>
        ext.username === username && ext.environment_uuid === environmentUuid
      );

      return {
        available: !exists,
        message: exists ? 'Device number already exists' : 'Available'
      };
    } catch (error) {
      console.error('Error checking extension existence:', error);
      return {
        available: false,
        message: 'Validation failed - please try again'
      };
    }
  }
};

export default customersApi;
