import { apiService, toFormData } from '../apiService';

/**
 * IVR API Service
 * Handles all IVR-related API operations
 */
export const ivrApi = {
  /**
   * Get all IVRs for an environment
   */
  getIVRs: async (params = {}) => {
    try {
      console.log('IVR API: Getting IVRs with params:', params);
      const response = await apiService.get('/api/ivrs', params, 'fetching IVRs');
      console.log('IVR API: Response:', response);
      return response;
    } catch (error) {
      console.error('IVR API: Error getting IVRs:', error);
      throw error;
    }
  },

  /**
   * Get single IVR by ID
   */
  getIVR: async (id) => {
    try {
      console.log('IVR API: Getting IVR with id:', id);
      const response = await apiService.get(`/api/ivrs/${id}`, {}, `fetching IVR ${id}`);
      console.log('IVR API: Response:', response);
      return response;
    } catch (error) {
      console.error('IVR API: Error getting IVR:', error);
      throw error;
    }
  },

  /**
   * Create new IVR
   */
  createIVR: async (ivrData) => {
    try {
      console.log('IVR API: Creating IVR with data:', ivrData);
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      // Use centralized toFormData helper for proper nested object encoding
      const formData = toFormData(ivrData);

      const response = await apiService.post('/api/ivrs', formData, headers, `creating IVR ${ivrData.name}`, true);
      console.log('IVR API: Response:', response);
      return response;
    } catch (error) {
      console.error('IVR API: Error creating IVR:', error);
      throw error;
    }
  },

  /**
   * Update existing IVR
   */
  updateIVR: async (id, ivrData) => {
    try {
      console.log('IVR API: Updating IVR with id:', id, 'data:', ivrData);
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      // Clean entries to remove restricted fields (uuid, created_at, ivr_uuid)
      // These fields cause Sequel::MassAssignmentRestriction errors
      const cleanedData = { ...ivrData };
      if (cleanedData.entries && typeof cleanedData.entries === 'object') {
        const cleanedEntries = {};
        Object.keys(cleanedData.entries).forEach(key => {
          const entry = cleanedData.entries[key];
          // Only include fields that the API accepts for entries
          cleanedEntries[key] = {
            name: entry.name,
            bridge_type: entry.bridge_type,
            bridge_uuid: entry.bridge_uuid || ''
          };
        });
        cleanedData.entries = cleanedEntries;
      }

      // Use centralized toFormData helper for proper nested object encoding
      const formData = toFormData(cleanedData);

      const response = await apiService.patch(`/api/ivrs/${id}`, formData, headers, `updating IVR ${ivrData.name || id}`, true);
      console.log('IVR API: Response:', response);
      return response;
    } catch (error) {
      console.error('IVR API: Error updating IVR:', error);
      throw error;
    }
  },

  /**
   * Delete IVR
   */
  deleteIVR: async (id) => {
    try {
      console.log('IVR API: Deleting IVR with id:', id);
      const response = await apiService.delete(`/api/ivrs/${id}`, `deleting IVR ${id}`);
      console.log('IVR API: Response:', response);
      return response;
    } catch (error) {
      console.error('IVR API: Error deleting IVR:', error);
      throw error;
    }
  }
};