/**
 * Identities API Service - Exposes live identity data from Redis
 *
 * Identity types available:
 * - user: Agent/user live status (33+ fields: status, state, talking_to, call_duration, etc.)
 * - queue: Queue metrics (12 fields: call_count, pending_current, drop_rate, etc.)
 * - campaign: Campaign metrics (17 fields: numbers.*, originate_rate, drop_rate, etc.)
 * - extension: Extension status (5 fields: username, domain, call_state, user_agent)
 * - conference, workflow, notification, switch, node, account, sip_provider
 */

import { apiService } from '../apiService';

/**
 * Identity types with their descriptions
 */
export const IDENTITY_TYPES = {
  user: {
    label: 'User/Agent',
    description: 'Live agent status, call metrics, and state',
    icon: 'person'
  },
  queue: {
    label: 'Queue',
    description: 'Queue call counts, drop rates, and pending calls',
    icon: 'queue'
  },
  campaign: {
    label: 'Campaign',
    description: 'Dialer campaign metrics and number processing',
    icon: 'campaign'
  },
  call: {
    label: 'Call',
    description: 'Live call state, duration, direction, and participants',
    icon: 'phone_in_talk'
  },
  extension: {
    label: 'Device',
    description: 'SIP device registration and call state',
    icon: 'phone'
  },
  conference: {
    label: 'Conference',
    description: 'Conference room status and participants',
    icon: 'groups'
  },
  workflow: {
    label: 'Workflow',
    description: 'Workflow execution state',
    icon: 'account_tree'
  },
  notification: {
    label: 'Notification',
    description: 'Notification delivery status',
    icon: 'notifications'
  },
  switch: {
    label: 'Switch',
    description: 'PBX switch health and metrics',
    icon: 'router'
  },
  node: {
    label: 'Node',
    description: 'Infrastructure node status',
    icon: 'dns'
  },
  account: {
    label: 'Account',
    description: 'Account-level metrics',
    icon: 'business'
  },
  sip_provider: {
    label: 'SIP Provider',
    description: 'SIP trunk provider status',
    icon: 'cloud'
  }
};

/**
 * Identities API Service
 */
export const identitiesApi = {
  /**
   * Get all identity types with their FIELDS definitions
   * @returns {Promise<Object>} Map of identity type to fields definition
   */
  getTypes: async () => {
    const response = await apiService.get(
      '/api/dashboard/identities',
      {},
      'fetching identity types',
      false
    );
    return response;
  },

  /**
   * Get FIELDS definition for a specific identity type
   * @param {string} type - Identity type (user, queue, campaign, etc.)
   * @returns {Promise<Object>} Fields definition with field_names array
   */
  getFields: async (type) => {
    const response = await apiService.get(
      `/api/dashboard/identities/${type}/fields`,
      {},
      `fetching ${type} identity fields`,
      false
    );
    return response;
  },

  /**
   * Get current values for a specific identity
   * @param {string} type - Identity type
   * @param {string} uuid - Entity UUID
   * @returns {Promise<Object>} Current field values { uuid, type, values }
   */
  getIdentity: async (type, uuid) => {
    const response = await apiService.get(
      `/api/dashboard/identities/${type}/${uuid}`,
      {},
      `fetching ${type} identity ${uuid}`,
      false
    );
    return response;
  },

  /**
   * Get time series data for an identity field
   * @param {string} type - Identity type
   * @param {string} uuid - Entity UUID
   * @param {string} field - Field name to query
   * @param {number} from - Minutes ago (default: 60)
   * @returns {Promise<Object>} Time series data { uuid, type, field, from_minutes, series }
   */
  getTimeSeries: async (type, uuid, field, from = 60) => {
    const params = new URLSearchParams({ field, from: from.toString() });
    const response = await apiService.get(
      `/api/dashboard/identities/${type}/${uuid}/timeseries?${params}`,
      {},
      `fetching ${type} timeseries for ${field}`,
      false
    );
    return response;
  },

  /**
   * Get multiple identities of the same type (bulk fetch)
   * @param {string} type - Identity type
   * @param {Array<string>} uuids - Array of UUIDs to fetch
   * @returns {Promise<Object>} Bulk identity data { type, identities: [...] }
   */
  getIdentities: async (type, uuids) => {
    const params = new URLSearchParams({ uuids: uuids.join(',') });
    const response = await apiService.get(
      `/api/dashboard/identities/${type}?${params}`,
      {},
      `fetching ${type} identities bulk`,
      false
    );
    return response;
  },

  /**
   * Get raw Redis keys and values for a specific identity
   * @param {string} type - Identity type (user, queue, etc.)
   * @param {string} uuid - Entity UUID
   * @returns {Promise<Object>} Redis key data { uuid, type, redis_prefix, fields }
   */
  getRedisKeys: async (type, uuid) => {
    const response = await apiService.get(
      `/api/dashboard/identities/${type}/${uuid}/redis`,
      {},
      `fetching ${type} Redis keys for ${uuid}`,
      false
    );
    return response;
  },

  /**
   * Preview dashboard widget rendering (replicates Crystal broadcaster)
   * @param {string} query - Identity type (user, queue, etc.)
   * @param {Array<string>} fields - Fields to include
   * @param {Array<string>} uuids - UUIDs to query
   * @returns {Promise<Object>} Preview data { table: [...] }
   */
  previewDashboard: async (query, fields, uuids) => {
    const params = new URLSearchParams({
      query,
      fields: fields.join(','),
      uuids: uuids.join(',')
    });
    const response = await apiService.get(
      `/tasks/dashboard/preview?${params}`,
      {},
      'previewing dashboard widget',
      false
    );
    return response;
  },

  /**
   * Parse field value with color coding based on FIELDS definition
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @param {Object} fieldDef - Field definition from FIELDS
   * @returns {Object} Parsed value with display properties
   */
  parseFieldValue: (field, value, fieldDef = {}) => {
    return {
      field,
      value,
      displayValue: value?.toString() || '-',
      backgroundColor: fieldDef.background_color || '#f5f5f5',
      textColor: fieldDef.text_color || '#333',
      icon: fieldDef.icon || null,
      type: fieldDef.type || 'string'
    };
  },

  /**
   * Transform identity values for table display
   * @param {Object} identityData - Raw identity response { uuid, type, values }
   * @param {Object} fieldsConfig - FIELDS configuration for the type
   * @param {Array<string>} selectedFields - Fields to include (optional, all if not provided)
   * @returns {Array<Object>} Array of field objects ready for table/widget display
   */
  transformForDisplay: (identityData, fieldsConfig = {}, selectedFields = null) => {
    const { uuid, type, values = {} } = identityData;
    const fields = selectedFields || Object.keys(values);

    return fields.map(field => {
      const value = values[field];
      const fieldDef = fieldsConfig[field] || {};

      return {
        field,
        label: field.replace(/_/g, ' ').replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value,
        displayValue: value?.toString() || '-',
        backgroundColor: fieldDef.background_color || '#f5f5f5',
        textColor: fieldDef.text_color || '#333',
        icon: fieldDef.icon,
        method: fieldDef.method,
        type: fieldDef.type || 'string',
        uuid,
        identityType: type
      };
    });
  },

  /**
   * Get identity type metadata
   * @param {string} type - Identity type
   * @returns {Object} Type metadata { label, description, icon }
   */
  getTypeMetadata: (type) => {
    return IDENTITY_TYPES[type] || {
      label: type.charAt(0).toUpperCase() + type.slice(1),
      description: `${type} identity data`,
      icon: 'help_outline'
    };
  }
};

export default identitiesApi;
