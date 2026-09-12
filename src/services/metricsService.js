import { config } from '../config';

/**
 * MetricsService - Provides access to Redis keys and InfluxDB time series data
 *
 * Architecture:
 * - Redis: Current/live values via State classes (State::Queue, State::User)
 * - InfluxDB: Historical time series via Identity classes (ts_avg, ts_last, ts_aggregate)
 *
 * Identity Types:
 * - queue_identity: Queue metrics (call_count, answer_count, etc.)
 * - user_identity: User/Agent metrics (status, state, call_counts, etc.)
 * - environment_identity: Environment-wide metrics
 * - campaign_identity: Campaign metrics
 */
class MetricsService {
  constructor() {
    this.baseUrl = config.apiBaseUrl;
    // Remove /api suffix for tasks endpoints which are at root
    this.tasksUrl = this.baseUrl.replace(/\/?api\/?$/, '');
  }

  // ============================================
  // REDIS KEY EXPLORATION
  // ============================================

  /**
   * Get list of Redis keys matching a pattern
   * @param {string} pattern - Redis key pattern (e.g., 'live:*', 'queue:*')
   * @param {string} token - Auth token
   * @returns {Promise<{keys: string[], total: number}>}
   */
  async getRedisKeys(pattern = '*', token) {
    try {
      const response = await fetch(`${this.tasksUrl}/api/dashboard/redis/keys?pattern=${encodeURIComponent(pattern)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': token } : {})
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching Redis keys:', error);
      throw error;
    }
  }

  /**
   * Get value of a specific Redis key
   * @param {string} key - Redis key
   * @param {string} token - Auth token
   * @returns {Promise<{type: string, value: any, ttl: number}>}
   */
  async getRedisValue(key, token) {
    try {
      const response = await fetch(`${this.tasksUrl}/api/dashboard/redis/get/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': token } : {})
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching Redis value:', error);
      throw error;
    }
  }

  /**
   * Execute Redis command (for advanced exploration)
   * @param {string} command - Redis command
   * @param {string} token - Auth token
   */
  async executeRedisCommand(command, token) {
    try {
      const response = await fetch(`${this.tasksUrl}/api/dashboard/redis/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': token } : {})
        },
        body: JSON.stringify({ command })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error executing Redis command:', error);
      throw error;
    }
  }

  // ============================================
  // IDENTITY PATTERNS (Redis + InfluxDB)
  // ============================================

  /**
   * Known identity types with their Redis patterns and InfluxDB series
   */
  static IDENTITY_TYPES = {
    queue: {
      name: 'Queue',
      redisPattern: 'state:queue:*',
      influxSeries: 'queue_identity',
      uuidField: 'queue_uuid',
      fields: [
        { name: 'call_count', type: 'counter', description: 'Total calls' },
        { name: 'call_current', type: 'gauge', description: 'Current active calls' },
        { name: 'answer_count', type: 'counter', description: 'Answered calls' },
        { name: 'answer_current', type: 'gauge', description: 'Currently answered' },
        { name: 'pending_current', type: 'gauge', description: 'Pending calls' },
        { name: 'ringing_current', type: 'gauge', description: 'Ringing calls' },
        { name: 'no_answer_count', type: 'counter', description: 'Unanswered calls' },
        { name: 'abandoned_count', type: 'counter', description: 'Abandoned calls' },
        { name: 'timeout_count', type: 'counter', description: 'Timeout calls' },
        { name: 'wrap_count', type: 'counter', description: 'Wrap-up count' },
        { name: 'callback_count', type: 'counter', description: 'Callbacks' },
      ]
    },
    user: {
      name: 'User/Agent',
      redisPattern: 'state:user:*',
      influxSeries: 'user_identity',
      uuidField: 'user_uuid',
      fields: [
        { name: 'status', type: 'string', description: 'Agent status' },
        { name: 'state', type: 'string', description: 'Agent state' },
        { name: 'call_incoming_count', type: 'counter', description: 'Incoming calls' },
        { name: 'call_outgoing_count', type: 'counter', description: 'Outgoing calls' },
        { name: 'call_incoming_answered', type: 'counter', description: 'Incoming answered' },
        { name: 'call_outgoing_answered', type: 'counter', description: 'Outgoing answered' },
        { name: 'call_current', type: 'gauge', description: 'Current call' },
        { name: 'call_secs_total', type: 'counter', description: 'Total call seconds' },
        { name: 'call_wait_total', type: 'counter', description: 'Total wait time' },
        { name: 'wrap_count', type: 'counter', description: 'Wrap-up count' },
        { name: 'break_count', type: 'counter', description: 'Break count' },
        { name: 'break_total', type: 'counter', description: 'Total break time' },
        { name: 'login_count', type: 'counter', description: 'Login count' },
        { name: 'logged_in_total', type: 'counter', description: 'Total logged in time' },
      ]
    },
    environment: {
      name: 'Environment',
      redisPattern: 'state:environment:*',
      influxSeries: 'environment_identity',
      uuidField: 'environment_uuid',
      fields: [
        { name: 'call_count', type: 'counter', description: 'Total calls' },
        { name: 'call_current', type: 'gauge', description: 'Current calls' },
        { name: 'user_count', type: 'gauge', description: 'Active users' },
      ]
    },
    campaign: {
      name: 'Campaign',
      redisPattern: 'state:campaign:*',
      influxSeries: 'campaign_identity',
      uuidField: 'campaign_uuid',
      fields: [
        { name: 'call_count', type: 'counter', description: 'Total calls' },
        { name: 'answer_count', type: 'counter', description: 'Answered calls' },
        { name: 'complete_count', type: 'counter', description: 'Completed' },
      ]
    }
  };

  /**
   * Get available identity types for exploration
   */
  getIdentityTypes() {
    return Object.entries(MetricsService.IDENTITY_TYPES).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }

  /**
   * Get fields available for an identity type
   */
  getIdentityFields(identityType) {
    return MetricsService.IDENTITY_TYPES[identityType]?.fields || [];
  }

  // ============================================
  // INFLUXDB TIME SERIES QUERIES
  // ============================================

  /**
   * Query InfluxDB time series data
   * @param {Object} params - Query parameters
   * @param {string} params.series - InfluxDB series name (e.g., 'queue_identity')
   * @param {string} params.field - Field to query (e.g., 'call_count')
   * @param {string} params.uuid - Entity UUID for filtering
   * @param {string} params.uuidField - UUID field name (e.g., 'queue_uuid')
   * @param {string} params.aggregation - Aggregation function (mean, sum, count, etc.)
   * @param {number} params.from - Time range in minutes (default 60)
   * @param {string} params.groupBy - Group by interval (e.g., '1m', '5m', '1h')
   * @param {string} token - Auth token
   */
  async queryTimeSeries(params, token) {
    try {
      const { series, field, uuid, uuidField, aggregation = 'mean', from = 60, groupBy = '1m' } = params;

      const queryParams = new URLSearchParams({
        series,
        field,
        aggregation,
        from: from.toString(),
        group_by: groupBy,
        ...(uuid && uuidField ? { [uuidField]: uuid } : {})
      });

      const response = await fetch(`${this.tasksUrl}/tasks/influx/query?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': token } : {})
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error querying time series:', error);
      throw error;
    }
  }

  /**
   * Get identity time series average
   * Maps to Identity::Base.ts_avg()
   */
  async getIdentityAverage(identityType, uuid, field, fromMinutes = 60, token) {
    const identity = MetricsService.IDENTITY_TYPES[identityType];
    if (!identity) throw new Error(`Unknown identity type: ${identityType}`);

    return this.queryTimeSeries({
      series: identity.influxSeries,
      field,
      uuid,
      uuidField: identity.uuidField,
      aggregation: 'mean',
      from: fromMinutes,
      groupBy: '1m'
    }, token);
  }

  /**
   * Get identity time series last value
   * Maps to Identity::Base.ts_last()
   */
  async getIdentityLast(identityType, uuid, field, token) {
    const identity = MetricsService.IDENTITY_TYPES[identityType];
    if (!identity) throw new Error(`Unknown identity type: ${identityType}`);

    return this.queryTimeSeries({
      series: identity.influxSeries,
      field,
      uuid,
      uuidField: identity.uuidField,
      aggregation: 'last',
      from: 5,
      groupBy: '1m'
    }, token);
  }

  /**
   * Get identity time series aggregate
   * Maps to Identity::Base.ts_aggregate()
   */
  async getIdentityAggregate(identityType, uuid, field, aggregation = 'mean', fromMinutes = 60, token) {
    const identity = MetricsService.IDENTITY_TYPES[identityType];
    if (!identity) throw new Error(`Unknown identity type: ${identityType}`);

    return this.queryTimeSeries({
      series: identity.influxSeries,
      field,
      uuid,
      uuidField: identity.uuidField,
      aggregation,
      from: fromMinutes,
      groupBy: '1m'
    }, token);
  }

  // ============================================
  // LIVE DATA (WebSocket/ActionCable)
  // ============================================

  /**
   * Get live identity data via Redis state
   * This fetches current values from Redis State classes
   */
  async getLiveIdentity(identityType, uuid, token) {
    const identity = MetricsService.IDENTITY_TYPES[identityType];
    if (!identity) throw new Error(`Unknown identity type: ${identityType}`);

    // Use the appropriate API endpoint for live data
    // This maps to the ActionCable channels that broadcast state updates
    const endpoint = identityType === 'queue'
      ? `${this.baseUrl}/queues/${uuid}/identity`
      : identityType === 'user'
      ? `${this.baseUrl}/users/${uuid}/identity`
      : `${this.baseUrl}/identities/${identityType}/${uuid}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': token } : {})
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching live identity:', error);
      throw error;
    }
  }

  // ============================================
  // QUERY BUILDER HELPERS
  // ============================================

  /**
   * Build a widget query configuration
   */
  buildWidgetQuery(params) {
    const { identityType, field, aggregation, timeRange, groupBy, uuid } = params;
    const identity = MetricsService.IDENTITY_TYPES[identityType];

    return {
      type: 'influx',
      series: identity.influxSeries,
      field,
      aggregation: aggregation || 'mean',
      timeRange: timeRange || '1h',
      groupBy: groupBy || '1m',
      filters: uuid ? { [identity.uuidField]: uuid } : {},
      identityType
    };
  }

  /**
   * Parse time range string to minutes
   */
  parseTimeRange(range) {
    const match = range.match(/^(\d+)([mhdw])$/);
    if (!match) return 60;

    const [, value, unit] = match;
    const multipliers = { m: 1, h: 60, d: 1440, w: 10080 };
    return parseInt(value) * (multipliers[unit] || 1);
  }

  /**
   * Available aggregation functions
   */
  static AGGREGATIONS = [
    { id: 'mean', name: 'Mean', description: 'Average value' },
    { id: 'sum', name: 'Sum', description: 'Total sum' },
    { id: 'count', name: 'Count', description: 'Number of points' },
    { id: 'min', name: 'Min', description: 'Minimum value' },
    { id: 'max', name: 'Max', description: 'Maximum value' },
    { id: 'last', name: 'Last', description: 'Most recent value' },
    { id: 'first', name: 'First', description: 'First value' },
  ];

  /**
   * Available time ranges
   */
  static TIME_RANGES = [
    { id: '5m', name: 'Last 5 minutes' },
    { id: '15m', name: 'Last 15 minutes' },
    { id: '30m', name: 'Last 30 minutes' },
    { id: '1h', name: 'Last 1 hour' },
    { id: '3h', name: 'Last 3 hours' },
    { id: '6h', name: 'Last 6 hours' },
    { id: '12h', name: 'Last 12 hours' },
    { id: '24h', name: 'Last 24 hours' },
    { id: '7d', name: 'Last 7 days' },
    { id: '30d', name: 'Last 30 days' },
  ];

  /**
   * Available group by intervals
   */
  static GROUP_BY_INTERVALS = [
    { id: '10s', name: '10 seconds' },
    { id: '30s', name: '30 seconds' },
    { id: '1m', name: '1 minute' },
    { id: '5m', name: '5 minutes' },
    { id: '15m', name: '15 minutes' },
    { id: '30m', name: '30 minutes' },
    { id: '1h', name: '1 hour' },
    { id: '6h', name: '6 hours' },
    { id: '1d', name: '1 day' },
  ];
}

export const metricsService = new MetricsService();
export default metricsService;
