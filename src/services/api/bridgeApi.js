import { apiService, toFormData } from '../apiService';

/**
 * Bridge API Service
 * Centralized service for all bridge-related operations
 * Consolidates duplicate code from voipResourcesApi, callConditionsApi, and didsApi
 */

// Bridge type mappings
// Bridge types are fetched from server via /api/assets/bridge_types
// This mapping provides endpoints for each type
const BRIDGE_TYPE_ENDPOINTS = {
  'user': '/api/users',  // Users for queue agents (user.uuid = agent.uuid)
  'extension': '/api/extensions',
  'queue': '/api/queues',
  'que': '/api/queues',  // Legacy alias for queue
  'ivr': '/api/ivrs',
  'number': '/api/dids',  // Number bridge type maps to DIDs
  'call_condition': '/api/call_conditions',
  'vml': '/api/vmls',
  'conference': '/api/conferences',
  'bot': '/api/bots',
  'announcement': '/api/announcements',
  'user_login': '/api/user_logins'  // Feature: user login bridge type
};

const BRIDGE_TYPE_PLURAL = {
  'user': 'users',
  'extension': 'extensions',
  'queue': 'queues',
  'que': 'queues',  // Legacy alias for queue
  'ivr': 'ivrs',
  'number': 'dids',
  'call_condition': 'call_conditions',
  'vml': 'vmls',
  'conference': 'conferences',
  'bot': 'bots',
  'announcement': 'announcements',
  'user_login': 'user_logins'
};

/**
 * Get available bridge types from API
 * @returns {Promise<Array<string>>} Array of bridge type strings
 */
export const getBridgeTypes = async () => {
  // Fallback types if API fails - includes all known types
  const FALLBACK_BRIDGE_TYPES = [
    'extension', 'queue', 'ivr', 'number', 'call_condition',
    'vml', 'conference', 'bot', 'user_login', 'announcement'
  ];

  try {
    const response = await apiService.get(
      '/api/assets/bridge_types',
      {},
      'fetching bridge types',
      false
    );

    // Return all types from API without filtering
    if (Array.isArray(response)) {
      return response;
    }

    return FALLBACK_BRIDGE_TYPES;
  } catch (error) {
    console.error('Error fetching bridge types:', error);
    return FALLBACK_BRIDGE_TYPES;
  }
};

/**
 * Get bridge resources by type
 * @param {string} bridgeType - Bridge type (extension, queue, ivr, etc.)
 * @param {string} environmentUuid - Optional environment UUID for filtering
 * @param {object} options - Additional options
 * @param {boolean} options.enabled - Filter by enabled status (default: true)
 * @param {number} options.perPage - Results per page (default: 9999)
 * @returns {Promise<Array>} Array of bridge resources
 */
export const getBridgeResources = async (bridgeType, environmentUuid = null, options = {}) => {
  if (!bridgeType) {
    console.warn('Bridge type is required');
    return [];
  }

  const endpoint = BRIDGE_TYPE_ENDPOINTS[bridgeType];

  if (!endpoint) {
    console.warn(`Unknown bridge type: ${bridgeType}`);
    return [];
  }

  // Build query string manually to keep brackets unencoded: search[key]=value
  const queryParts = [];
  queryParts.push(`per_page=${options.perPage || 9999}`);
  queryParts.push(`page=${options.page || 1}`);

  if (environmentUuid) {
    queryParts.push(`search[environment_uuid]=${encodeURIComponent(environmentUuid)}`);
  }

  // Only add enabled filter if explicitly specified (true or false)
  // Don't filter by enabled by default - show all resources
  if (options.enabled === true) {
    queryParts.push(`search[enabled]=true`);
  } else if (options.enabled === false) {
    queryParts.push(`search[enabled]=false`);
  }
  // If options.enabled is undefined, don't add the filter - show all

  const url = `${endpoint}?${queryParts.join('&')}`;
  console.log(`Bridge API Request: ${url}`);

  try {
    const response = await apiService.get(url, {}, `fetching ${bridgeType} resources`, false);

    // Handle both wrapped and direct array responses
    // API may return {data: [...], total_records: X} or just [...]
    if (Array.isArray(response)) {
      return response;
    } else if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  } catch (error) {
    console.error(`Error fetching ${bridgeType} resources:`, error);
    return [];
  }
};

/**
 * Get all bridge resources for an environment (batch fetch)
 * @param {string} environmentUuid - Environment UUID
 * @returns {Promise<object>} Object with arrays for each bridge type
 */
export const getAllBridgeResources = async (environmentUuid) => {
  if (!environmentUuid) {
    return {
      extensions: [],
      queues: [],
      ivrs: [],
      conferences: [],
      announcements: [],
      vmls: [],
      call_conditions: [],
      bots: []
    };
  }

  try {
    const [extensions, queues, ivrs, conferences, announcements, vmls, callConditions, bots] = await Promise.all([
      getBridgeResources('extension', environmentUuid),
      getBridgeResources('queue', environmentUuid),
      getBridgeResources('ivr', environmentUuid),
      getBridgeResources('conference', environmentUuid),
      getBridgeResources('announcement', environmentUuid),
      getBridgeResources('vml', environmentUuid),
      getBridgeResources('call_condition', environmentUuid),
      getBridgeResources('bot', environmentUuid)
    ]);

    return {
      extensions,
      queues,
      ivrs,
      conferences,
      announcements,
      vmls,
      call_conditions: callConditions,
      bots
    };
  } catch (error) {
    console.error('Error fetching all bridge resources:', error);
    return {
      extensions: [],
      queues: [],
      ivrs: [],
      conferences: [],
      announcements: [],
      vmls: [],
      call_conditions: [],
      bots: []
    };
  }
};

/**
 * Create a new bridge resource inline
 * @param {string} bridgeType - Bridge type to create
 * @param {object} data - Resource data
 * @returns {Promise<object>} Created resource
 */
export const createBridgeResource = async (bridgeType, data) => {
  const endpoint = BRIDGE_TYPE_ENDPOINTS[bridgeType];

  if (!endpoint) {
    throw new Error(`Unknown bridge type: ${bridgeType}`);
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  // Use centralized toFormData helper for proper nested object encoding
  const formData = toFormData(data);

  return apiService.post(
    endpoint,
    formData,
    headers,
    `creating ${bridgeType}`,
    true
  );
};

/**
 * Get a single bridge resource by UUID
 * @param {string} bridgeType - Bridge type
 * @param {string} uuid - Resource UUID
 * @returns {Promise<object>} Bridge resource
 */
export const getBridgeResource = async (bridgeType, uuid) => {
  if (!bridgeType || !uuid) {
    throw new Error('Bridge type and UUID are required');
  }

  const endpoint = BRIDGE_TYPE_ENDPOINTS[bridgeType];

  if (!endpoint) {
    throw new Error(`Unknown bridge type: ${bridgeType}`);
  }

  return apiService.get(
    `${endpoint}/${uuid}`,
    {},
    `fetching ${bridgeType}`,
    false
  );
};

/**
 * Update a bridge resource
 * @param {string} bridgeType - Bridge type
 * @param {string} uuid - Resource UUID
 * @param {object} data - Updated data
 * @returns {Promise<object>} Updated resource
 */
export const updateBridgeResource = async (bridgeType, uuid, data) => {
  if (!bridgeType || !uuid) {
    throw new Error('Bridge type and UUID are required');
  }

  const endpoint = BRIDGE_TYPE_ENDPOINTS[bridgeType];

  if (!endpoint) {
    throw new Error(`Unknown bridge type: ${bridgeType}`);
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  // Use centralized toFormData helper for proper nested object encoding
  const formData = toFormData(data);

  return apiService.patch(
    `${endpoint}/${uuid}`,
    formData,
    headers,
    `updating ${bridgeType}`,
    true
  );
};

/**
 * Delete a bridge resource
 * @param {string} bridgeType - Bridge type
 * @param {string} uuid - Resource UUID
 * @returns {Promise<object>} Deletion response
 */
export const deleteBridgeResource = async (bridgeType, uuid) => {
  if (!bridgeType || !uuid) {
    throw new Error('Bridge type and UUID are required');
  }

  const endpoint = BRIDGE_TYPE_ENDPOINTS[bridgeType];

  if (!endpoint) {
    throw new Error(`Unknown bridge type: ${bridgeType}`);
  }

  return apiService.delete(
    `${endpoint}/${uuid}`,
    {},
    `deleting ${bridgeType}`,
    true
  );
};

/**
 * Get the plural form of a bridge type for API endpoints
 * @param {string} bridgeType - Bridge type
 * @returns {string} Plural form
 */
export const getBridgeTypePlural = (bridgeType) => {
  return BRIDGE_TYPE_PLURAL[bridgeType] || `${bridgeType}s`;
};

// Export as object for convenient importing
export const bridgeApi = {
  getBridgeTypes,
  getBridgeResources,
  getAllBridgeResources,
  createBridgeResource,
  getBridgeResource,
  updateBridgeResource,
  deleteBridgeResource,
  getBridgeTypePlural,
  BRIDGE_TYPE_ENDPOINTS,
  BRIDGE_TYPE_PLURAL
};

export default bridgeApi;
