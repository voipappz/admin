import { apiService, toFormData } from '../apiService';

/**
 * Monitors API Service
 * Health monitoring with SQL and HTTP checks
 *
 * IMPORTANT: Monitors are now stored as Services with type='monitor'
 * This API wraps the /api/services endpoint with monitor-specific mappings
 *
 * Service data structure for monitors:
 * - profile: { query, interval, type: 'sql'|'http' }
 * - conditions: { operator, threshold }
 */

// Query types supported
export const QUERY_TYPES = [
  { value: 'sql', label: 'SQL Query' },
  { value: 'http', label: 'HTTP Check' }
];

// Comparison operators (stored in conditions hstore)
export const OPERATORS = [
  { value: 'gt', label: '>', description: 'Greater than' },
  { value: 'lt', label: '<', description: 'Less than' },
  { value: 'eq', label: '=', description: 'Equal to' },
  { value: 'gte', label: '>=', description: 'Greater than or equal' },
  { value: 'lte', label: '<=', description: 'Less than or equal' }
];

// Interval options (in seconds)
export const INTERVALS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' }
];

/**
 * Transform Service data to Monitor format (for UI)
 * @param {Object} service - Service object from API
 * @returns {Object} - Monitor object for UI
 */
const serviceToMonitor = (service) => {
  if (!service) return null;

  const profile = service.profile || {};
  const conditions = service.conditions || {};

  return {
    uuid: service.uuid,
    name: service.name,
    enabled: service.enabled,
    customer_uuid: service.customer_uuid,
    environment_uuids: service.environment_uuids,
    // Map profile fields
    query: profile.query || '',
    query_type: profile.type || 'sql',
    interval: profile.interval ? parseInt(profile.interval, 10) : 300,
    // Map conditions fields
    operator: conditions.operator || 'gt',
    threshold: conditions.threshold ? parseFloat(conditions.threshold) : 0,
    // Status fields (may come from timeseries/events)
    status: service.status || 'pending',
    last_value: service.last_value,
    last_check: service.last_check,
    notes: service.notes || profile.notes || '',
    // Timestamps
    created_at: service.created_at,
    updated_at: service.updated_at
  };
};

/**
 * Transform Monitor data to Service format (for API)
 * @param {Object} monitorData - Monitor data from UI
 * @returns {Object} - Service data for API
 */
const monitorToService = (monitorData) => {
  const data = {
    type: 'monitor',
    name: monitorData.name,
    enabled: monitorData.enabled !== false,
    triggers: monitorData.triggers || ['monitor_check'],
    // Build profile object
    profile: {
      query: monitorData.query,
      interval: monitorData.interval || 300,
      type: monitorData.query_type || 'sql'
    },
    // Build conditions object
    conditions: {
      operator: monitorData.operator || 'gt',
      threshold: monitorData.threshold || 0
    }
  };

  // Add optional fields if provided
  if (monitorData.customer_uuid) {
    data.customer_uuid = monitorData.customer_uuid;
  }
  if (monitorData.environment_uuids) {
    data.environment_uuids = monitorData.environment_uuids;
  }
  if (monitorData.notes) {
    data.profile.notes = monitorData.notes;
  }

  return data;
};

export const monitorsApi = {
  /**
   * Get all monitors (Services with type='monitor')
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} - Array of monitor objects
   */
  getMonitors: async (params = {}) => {
    const queryString = new URLSearchParams();

    // Always filter by type=monitor
    queryString.append('type', 'monitor');

    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        if (typeof params[key] === 'object') {
          // Handle nested search params
          Object.keys(params[key]).forEach(subKey => {
            queryString.append(`search[${subKey}]`, params[key][subKey]);
          });
        } else {
          queryString.append(key, params[key]);
        }
      }
    });

    const url = `/api/services?${queryString.toString()}`;
    // Skip circuit breaker for health monitor calls - they shouldn't block other API calls
    const response = await apiService.get(url, {}, 'fetching monitors', false, true);

    // Transform service data to monitor format
    if (Array.isArray(response)) {
      return response.map(serviceToMonitor);
    }
    if (response && Array.isArray(response.data)) {
      return response.data.map(serviceToMonitor);
    }
    return [];
  },

  /**
   * Get a single monitor by ID
   * @param {string} monitorId - The monitor UUID
   * @returns {Promise<Object>} - Monitor object
   */
  getMonitor: async (monitorId) => {
    const url = `/api/services/${monitorId}`;
    // Skip circuit breaker for health monitor calls
    const response = await apiService.get(url, {}, `fetching monitor ${monitorId}`, false, true);
    return serviceToMonitor(response);
  },

  /**
   * Create a new monitor
   * @param {Object} monitorData - Monitor configuration
   * @returns {Promise<Object>} - Created monitor object
   */
  createMonitor: async (monitorData) => {
    const url = `/api/services`;
    const serviceData = monitorToService(monitorData);
    const formData = toFormData(serviceData);
    const response = await apiService.post(url, formData, {}, 'creating monitor', true);
    return serviceToMonitor(response);
  },

  /**
   * Update an existing monitor
   * @param {string} monitorId - The monitor UUID
   * @param {Object} monitorData - Updated monitor data
   * @returns {Promise<Object>} - Updated monitor object
   */
  updateMonitor: async (monitorId, monitorData) => {
    const url = `/api/services/${monitorId}`;
    const serviceData = monitorToService(monitorData);
    // Don't include type on update to avoid changing it
    delete serviceData.type;
    const formData = toFormData(serviceData);
    const response = await apiService.patch(url, formData, {}, `updating monitor ${monitorId}`, true);
    return serviceToMonitor(response);
  },

  /**
   * Delete a monitor
   * @param {string} monitorId - The monitor UUID
   * @returns {Promise<Object>} - Deletion confirmation
   */
  deleteMonitor: async (monitorId) => {
    const url = `/api/services/${monitorId}`;
    return apiService.delete(url, {}, `deleting monitor ${monitorId}`, true);
  },

  /**
   * Get timeseries data for a monitor
   * @param {string} monitorId - The monitor UUID
   * @param {string} range - Time range ('1h', '24h', '7d', '30d')
   * @returns {Promise<Array>} - Timeseries data points
   */
  getTimeseries: async (monitorId, range = '24h') => {
    const url = `/api/services/${monitorId}/timeseries?range=${range}`;
    try {
      // Skip circuit breaker for health monitor calls
      const response = await apiService.get(url, {}, `fetching timeseries for ${monitorId}`, false, true);
      return response || [];
    } catch (error) {
      // Return empty array if timeseries endpoint doesn't exist yet
      console.warn('Timeseries endpoint not available:', error);
      return [];
    }
  },

  /**
   * Trigger an immediate check for a monitor
   * @param {string} monitorId - The monitor UUID
   * @returns {Promise<Object>} - Check result
   */
  triggerCheck: async (monitorId) => {
    const url = `/api/services/${monitorId}/check`;
    try {
      // Skip circuit breaker for health monitor calls
      return await apiService.post(url, {}, {}, `triggering check for ${monitorId}`, true, true);
    } catch (error) {
      console.warn('Check endpoint not available:', error);
      throw error;
    }
  }
};

/**
 * Calculate uptime percentage from timeseries data
 * @param {Array} timeseries - Array of { timestamp, status } objects
 * @returns {number} - Uptime percentage (0-100)
 */
export const calculateUptime = (timeseries) => {
  if (!timeseries || timeseries.length === 0) return 100;

  const upCount = timeseries.filter(point => point.status === 'up').length;
  return Math.round((upCount / timeseries.length) * 10000) / 100;
};

/**
 * Get status color based on status string
 * @param {string} status - 'up', 'down', 'pending', 'maintenance'
 * @returns {string} - Color code
 */
export const getStatusColor = (status) => {
  switch (status) {
    case 'up':
      return '#22c55e'; // Green
    case 'down':
      return '#ef4444'; // Red
    case 'pending':
      return '#f59e0b'; // Yellow/Amber
    case 'maintenance':
      return '#6b7280'; // Gray
    default:
      return '#6b7280';
  }
};

/**
 * Get overall status from array of monitors
 * @param {Array} monitors - Array of monitor objects
 * @returns {Object} - { status, upCount, totalCount }
 */
export const getOverallStatus = (monitors) => {
  if (!monitors || monitors.length === 0) {
    return { status: 'pending', upCount: 0, totalCount: 0 };
  }

  const upCount = monitors.filter(m => m.status === 'up').length;
  const totalCount = monitors.length;

  let status = 'up';
  if (upCount === 0) {
    status = 'down';
  } else if (upCount < totalCount) {
    status = 'partial';
  }

  return { status, upCount, totalCount };
};

export default monitorsApi;
