import { apiService, toFormData } from '../apiService';

/**
 * ACLs (Access Control Lists) API Service
 * Handles all ACL management operations including CRUD and permissions
 */

export const aclsApi = {
  /**
   * Get all ACLs with optional filtering
   * @param {Object} params - Query parameters (page, per_page, search, etc.)
   * @returns {Promise<Object>} - ACLs list with pagination info
   */
  getACLs: async (params = {}) => {
    if (params.limit) {
      params.per_page = params.limit;
      delete params.limit;
    }

    const queryString = new URLSearchParams(params).toString();
    const url = `/api/acls${queryString ? `?${queryString}` : ''}`;
    return apiService.get(url, {}, 'fetching ACLs', false);
  },

  /**
   * Get a single ACL by ID
   * @param {string} aclId - The ACL UUID
   * @returns {Promise<Object>} - ACL object with full data
   */
  getACL: async (aclId) => {
    const url = `/api/acls/${aclId}`;
    return apiService.get(url, {}, `fetching ACL ${aclId}`, false);
  },

  /**
   * Get available ACL types
   * @returns {Promise<Array>} - List of ACL types
   */
  getACLTypes: async () => {
    const url = `/api/acls?action=types`;
    return apiService.get(url, {}, 'fetching ACL types', false);
  },

  /**
   * Get permissions data structure for a specific ACL type
   * @param {string} type - The ACL type
   * @returns {Promise<Object>} - Permissions structure with categories and elements
   */
  getACLTypeData: async (type) => {
    const url = `/api/acls?data=${encodeURIComponent(type)}`;
    return apiService.get(url, {}, `fetching ACL type data for ${type}`, false);
  },

  getCapabilities: async (type = 'account') => {
    const url = `/api/acls?action=capabilities&type=${encodeURIComponent(type)}`;
    return apiService.get(url, {}, 'fetching ACL capabilities', false);
  },

  /**
   * Create a new ACL
   * @param {Object} aclData - ACL data (name, type, data, notes)
   * @returns {Promise<Object>} - Created ACL object
   */
  createACL: async (aclData) => {
    const url = `/api/acls`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const formData = toFormData(aclData);
    return apiService.post(url, formData, headers, 'creating ACL', true);
  },

  /**
   * Update an existing ACL
   * @param {string} aclId - The ACL UUID
   * @param {Object} aclData - Updated ACL data
   * @returns {Promise<Object>} - Updated ACL object
   */
  updateACL: async (aclId, aclData) => {
    const url = `/api/acls/${aclId}`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const formData = toFormData(aclData);
    return apiService.patch(url, formData, headers, `updating ACL ${aclId}`, true);
  },

  /**
   * Delete an ACL
   * @param {string} aclId - The ACL UUID
   * @returns {Promise<Object>} - Deletion result
   */
  deleteACL: async (aclId) => {
    const url = `/api/acls/${aclId}`;
    return apiService.delete(url, {}, `deleting ACL ${aclId}`, true);
  },

  /**
   * Duplicate an existing ACL
   * @param {string} aclId - The ACL UUID to duplicate
   * @param {string} newName - Name for the duplicated ACL
   * @returns {Promise<Object>} - Duplicated ACL object
   */
  duplicateACL: async (aclId, newName) => {
    const url = `/api/acls?action=duplicate`;
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    const formData = toFormData({ uuid: aclId, name: newName });
    return apiService.post(url, formData, headers, 'duplicating ACL', true);
  }
};

export default aclsApi;
