import { apiService, toFormData } from '../apiService';

/**
 * Accounts API Service
 * Handles account management operations
 */
export const accountsApi = {
  /**
   * Get all accounts with optional filtering
   * @param {Object} params - Query parameters (page, per_page, search, etc.)
   * @returns {Promise<Object>} - Accounts list with pagination info
   */
  getAccounts: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/api/accounts${queryString ? `?${queryString}` : ''}`;
    return apiService.get(url, {}, 'fetching accounts', false);
  },

  /**
   * Get a single account by ID
   * @param {string} accountId - The account ID
   * @returns {Promise<Object>} - Account object
   */
  getAccount: async (accountId) => {
    const url = `/api/accounts/${accountId}`;
    return apiService.get(url, {}, `fetching account ${accountId}`, false);
  },

  /**
   * Create a new account
   * @param {Object} accountData - Account data (name, email, password, resources, etc.)
   * @returns {Promise<Object>} - Created account object
   */
  createAccount: async (accountData) => {
    const url = `/api/accounts`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // Use centralized toFormData helper for proper nested object encoding
    const formData = toFormData(accountData);

    return apiService.post(url, formData, headers, 'creating account', true);
  },

  /**
   * Update an existing account
   * @param {string} accountId - The account ID
   * @param {Object} accountData - Updated account data
   * @returns {Promise<Object>} - Updated account object
   */
  updateAccount: async (accountId, accountData) => {
    const url = `/api/accounts/${accountId}`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const formData = toFormData(accountData);
    return apiService.patch(url, formData, headers, `updating account ${accountId}`, true);
  },

  /**
   * Delete an account
   * @param {string} accountId - The account ID
   * @returns {Promise<Object>} - Deletion confirmation
   */
  deleteAccount: async (accountId) => {
    const url = `/api/accounts/${accountId}`;
    return apiService.delete(url, {}, `deleting account ${accountId}`, true);
  },

  /**
   * Get available environments for account creation/editing
   * NOTE: For dropdown use - if you have > 100 environments, implement search/autocomplete
   * @param {Object} params - Query parameters
   * @param {number} params.per_page - Max results (default: 100)
   * @param {string} params.search - Search term for filtering
   * @returns {Promise<Array>} - Array of environment objects
   */
  getEnvironments: async (params = {}) => {
    const limit = params.per_page || 100; // Reasonable default
    const searchQuery = params.search ? `&search[name]=${encodeURIComponent(params.search)}` : '';
    const url = `/api/applications?per_page=${limit}${searchQuery}`;
    return apiService.get(url, {}, 'fetching environments for accounts', false);
  },

  /**
   * Get available ACLs for account creation/editing
   * Filtered by type=account to only show account-type ACLs
   * @returns {Promise<Array>} - Array of account-type ACL objects
   */
  getAcls: async () => {
    const url = `/api/acls?search[type]=account`;
    return apiService.get(url, {}, 'fetching account ACLs', false);
  },

  // Customers list is fetched in CustomerEnvironmentContext via GET /api/customers (va_root only)

  /**
   * Reset account password (admin action) - Manual password setting
   * @param {string} accountId - The account ID
   * @param {string} newPassword - The new password
   * @returns {Promise<Object>} - Success confirmation
   */
  resetAccountPassword: async (accountId, newPassword) => {
    const url = `/api/accounts/${accountId}`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const formData = new URLSearchParams();
    formData.append('password', newPassword);
    return apiService.patch(url, formData.toString(), headers, `resetting account password`, true);
  },

  /**
   * Generate random password for account (server generates new password)
   * @param {string} accountId - The account ID
   * @returns {Promise<Object>} - Object with generated password { password: 'xyz123' }
   */
  generateAccountPassword: async (accountId) => {
    const url = `/api/accounts/${accountId}?action=reset_password`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const formData = new URLSearchParams();
    return apiService.patch(url, formData.toString(), headers, `generating new password for account`, true);
  },

  /**
   * Generate Basic Auth token (resets password and returns Base64-encoded "Basic email:password")
   * @param {string} accountId - The account ID
   * @returns {Promise<Object>} - { basic_auth: "Basic dXNlckBleGFtcGxlLmNvbTpwYXNz..." }
   */
  generateBasicAuth: async (accountId) => {
    const url = `/api/accounts/${accountId}?action=generate_basic_auth`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    const formData = new URLSearchParams();
    return apiService.patch(url, formData.toString(), headers, `generating basic auth token`, true);
  }
};

export default accountsApi;
