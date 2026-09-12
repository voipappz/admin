import { apiService, toFormData } from '../apiService.js';

/**
 * Segments API Service
 * CRUD operations for segment management
 *
 * API Endpoints:
 * - GET    /api/segments          - List segments (paginated, filterable)
 * - GET    /api/segments/:uuid    - Get single segment
 * - POST   /api/segments          - Create segment
 * - PATCH  /api/segments/:uuid    - Update segment
 * - DELETE /api/segments/:uuid    - Delete segment
 *
 * Segment fields: time.hour, time.weekday, time.month, time.monthday, time.year,
 *   call.caller, call.destination, call.callee, call.source, call.direction, call.type,
 *   sip.user_agent, sip.from_host, sip.to_host, network.ip, etc.
 *
 * Operators: IS, IN, NOT_IN, IS_NOT, PREFIX, CONTAINS, GT, LT, GTE, LTE, BETWEEN, EQ, MATCHES
 */

/**
 * Get all segments (paginated)
 * @param {object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.perPage - Items per page
 * @param {object} options.search - Search filters (name, field, operator, type, etc.)
 * @returns {Promise<{ data: Array, total: number }>}
 */
export const getSegments = async (options = {}) => {
  const queryParts = [];
  queryParts.push(`per_page=${options.perPage || 50}`);
  queryParts.push(`page=${options.page || 1}`);

  if (options.search) {
    Object.entries(options.search).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParts.push(`search[${key}]=${encodeURIComponent(value)}`);
      }
    });
  }

  const url = `/api/segments?${queryParts.join('&')}`;

  try {
    const response = await apiService.get(url, {}, 'fetching segments', false);
    // apiService wraps array + X-Total into { data: [...], total: N }
    if (response?.data && Array.isArray(response.data)) {
      return response;
    }
    return Array.isArray(response) ? { data: response, total: response.length } : { data: [], total: 0 };
  } catch (error) {
    console.error('Error fetching segments:', error);
    return { data: [], total: 0 };
  }
};

/**
 * Get a single segment by UUID
 * @param {string} uuid - Segment UUID
 * @returns {Promise<object>} Segment object
 */
export const getSegment = async (uuid) => {
  if (!uuid) throw new Error('Segment UUID is required');
  return apiService.get(`/api/segments/${uuid}`, {}, 'fetching segment', false);
};

/**
 * Create a new segment
 * @param {object} segmentData
 * @param {string} segmentData.name - Segment name (required)
 * @param {string} segmentData.field - Condition field e.g. 'time.hour' (required)
 * @param {string} segmentData.operator - Operator e.g. 'BETWEEN' (required)
 * @param {Array<string>|string} segmentData.value - Value(s) (required)
 * @param {string} segmentData.type - Segment type (optional, e.g. 'time', 'campaign')
 * @param {string} segmentData.notes - Optional notes
 * @returns {Promise<object>} Created segment with uuid
 */
export const createSegment = async (segmentData) => {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const formData = toFormData(segmentData);
  return apiService.post('/api/segments', formData, headers, 'creating segment', true);
};

/**
 * Update an existing segment
 * @param {string} uuid - Segment UUID
 * @param {object} segmentData - Fields to update
 * @returns {Promise<object>} Updated segment
 */
export const updateSegment = async (uuid, segmentData) => {
  if (!uuid) throw new Error('Segment UUID is required');
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const formData = toFormData(segmentData);
  return apiService.patch(`/api/segments/${uuid}`, formData, headers, 'updating segment', true);
};

/**
 * Delete a segment
 * @param {string} uuid - Segment UUID
 * @returns {Promise<object>} Deletion response
 */
export const deleteSegment = async (uuid) => {
  if (!uuid) throw new Error('Segment UUID is required');
  return apiService.delete(`/api/segments/${uuid}`, {}, 'deleting segment', true);
};

export const segmentsApi = {
  getSegments,
  getSegment,
  createSegment,
  updateSegment,
  deleteSegment
};

export default segmentsApi;
