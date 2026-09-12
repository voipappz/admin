import { apiService, toFormData } from '../apiService.js';

/**
 * Numbers API Service
 * API methods for number/DID management
 *
 * Based on legacy AngularJS patterns from:
 * - /opt/src/va-voipbox-admin/src/scripts/services/dids/resource.js
 * - /opt/src/va-voipbox-admin/src/scripts/directives/directives.js (select2ajax directive)
 *
 * API Endpoints:
 * - GET /api/numbers?search[environment_uuid]=X&search[number]=Y
 * - POST /api/numbers
 * - GET /api/numbers/:uuid
 */

/**
 * Search numbers with environment and query filtering
 * @param {string} query - Search query for number
 * @param {string} environmentUuid - Environment UUID filter
 * @param {number} perPage - Results per page (default: 50)
 * @returns {Promise<Array>} Array of number objects
 */
export const searchNumbers = async (query, environmentUuid, perPage = 50) => {
  if (!environmentUuid) {
    console.warn('searchNumbers: environmentUuid is required');
    return [];
  }

  // Build query string manually to keep brackets unencoded: search[key]=value
  const queryParts = [];
  queryParts.push(`per_page=${perPage}`);
  queryParts.push(`search[environment_uuid]=${encodeURIComponent(environmentUuid)}`);

  if (query && query.trim()) {
    queryParts.push(`search[number]=${encodeURIComponent(query.trim())}`);
  }

  const url = `/api/numbers?${queryParts.join('&')}`;

  try {
    const response = await apiService.get(url, {}, 'searching numbers', false);
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Error searching numbers:', error);
    return [];
  }
};

/**
 * Get number by UUID
 * @param {string} uuid - Number UUID
 * @returns {Promise<object>} Number object
 */
export const getNumber = async (uuid) => {
  if (!uuid) {
    throw new Error('Number UUID is required');
  }

  return apiService.get(
    `/api/numbers/${uuid}`,
    {},
    'fetching number',
    false
  );
};

/**
 * Create new number
 * @param {object} numberData - Number data
 * @param {string} numberData.number - Phone number (E.164 format)
 * @param {string} numberData.environment_uuid - Environment UUID
 * @param {boolean} numberData.enabled - Enabled status (default: true)
 * @param {boolean} numberData.blocked - Blocked status (default: false)
 * @returns {Promise<object>} Created number object
 */
export const createNumber = async (numberData) => {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  const data = {
    enabled: true,
    blocked: false,
    ...numberData
  };

  // Use centralized toFormData helper for proper nested object encoding
  const formData = toFormData(data);

  return apiService.post(
    '/api/numbers',
    formData,
    headers,
    'creating number',
    true
  );
};

/**
 * Update existing number
 * @param {string} uuid - Number UUID
 * @param {object} numberData - Updated number data
 * @returns {Promise<object>} Updated number object
 */
export const updateNumber = async (uuid, numberData) => {
  if (!uuid) {
    throw new Error('Number UUID is required');
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  // Use centralized toFormData helper for proper nested object encoding
  const formData = toFormData(numberData);

  return apiService.patch(
    `/api/numbers/${uuid}`,
    formData,
    headers,
    'updating number',
    true
  );
};

/**
 * Delete number
 * @param {string} uuid - Number UUID
 * @returns {Promise<object>} Deletion response
 */
export const deleteNumber = async (uuid) => {
  if (!uuid) {
    throw new Error('Number UUID is required');
  }

  return apiService.delete(
    `/api/numbers/${uuid}`,
    {},
    'deleting number',
    true
  );
};

/**
 * Get all numbers for an environment
 * @param {string} environmentUuid - Environment UUID
 * @param {object} options - Additional query options
 * @returns {Promise<Array>} Array of number objects
 */
export const getAllNumbers = async (environmentUuid, options = {}) => {
  // Build query string manually to keep brackets unencoded: search[key]=value
  const queryParts = [];
  queryParts.push(`per_page=${options.perPage || 9999}`);
  queryParts.push(`page=${options.page || 1}`);

  if (environmentUuid) {
    queryParts.push(`search[environment_uuid]=${encodeURIComponent(environmentUuid)}`);
  }

  if (options.enabled !== undefined) {
    queryParts.push(`search[enabled]=${options.enabled}`);
  }

  const url = `/api/numbers?${queryParts.join('&')}`;

  try {
    const response = await apiService.get(url, {}, 'fetching numbers', false);
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Error fetching numbers:', error);
    return [];
  }
};

export const numbersApi = {
  searchNumbers,
  getNumber,
  createNumber,
  updateNumber,
  deleteNumber,
  getAllNumbers
};

export default numbersApi;
