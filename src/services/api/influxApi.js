/**
 * InfluxDB API Service - Routes queries through backend reports system
 * Replaces direct @influxdata/influxdb3-client usage with API calls
 *
 * The backend uses Influxer gem with adapter: 'influxdb' reports defined in queries.yml
 * Available InfluxDB series: queue_identity, cdr, syslog
 */

import { apiService } from '../apiService';

// Predefined InfluxDB report names from queries.yml
export const INFLUX_REPORTS = {
  QUEUE_CALL_VOLUME: 'QueueCallVolume',
  QUEUE_SERVICE_LEVEL: 'QueueServiceLevel',
  QUEUE_AGENT_ACTIVITY: 'QueueAgentActivity'
};

// Series to fields mapping (from backend Influxer models)
export const SERIES_FIELDS = {
  queue_identity: [
    'call_count', 'answer_count', 'no_answer_count', 'abandoned_count',
    'timeout_count', 'wrap_count', 'callback_count', 'call_current',
    'answer_current', 'pending_current', 'ringing_current'
  ],
  cdr: ['duration', 'billsec', 'direction', 'status'],
  syslog: ['message', 'facility', 'appname', 'host', 'severity']
};

/**
 * InfluxDB API Service - Routes queries through backend Influxer
 */
export const influxApi = {
  /**
   * Run a predefined InfluxDB report by name
   * @param {string} reportName - Report name from queries.yml (e.g., 'QueueCallVolume')
   * @param {Object} options - Query options
   * @param {Date|string} options.startDate - Start time
   * @param {Date|string} options.endDate - End time
   * @param {number} options.limit - Result limit
   * @returns {Promise<Object>} Report results with columns and rows
   */
  runReport: async (reportName, options = {}) => {
    const params = new URLSearchParams({ action: 'run' });

    // Convert dates to Unix timestamps (as expected by backend)
    if (options.startDate) {
      const startTime = options.startDate instanceof Date
        ? Math.floor(options.startDate.getTime() / 1000)
        : Math.floor(new Date(options.startDate).getTime() / 1000);
      params.append('start_date', startTime);
    }

    if (options.endDate) {
      const endTime = options.endDate instanceof Date
        ? Math.floor(options.endDate.getTime() / 1000)
        : Math.floor(new Date(options.endDate).getTime() / 1000);
      params.append('end_date', endTime);
    }

    if (options.limit) {
      params.append('limit', options.limit);
    }

    if (options.interval) {
      params.append('interval', options.interval);
    }

    if (options.queueUuid) {
      params.append('queue_uuid', options.queueUuid);
    }

    // First, we need to find the report by name
    const reportsResponse = await apiService.get(
      `/api/reports?search=${encodeURIComponent(reportName)}`,
      {},
      'searching for influx report',
      false
    );

    // Find the exact report match
    const reports = Array.isArray(reportsResponse) ? reportsResponse : reportsResponse.data || [];
    const report = reports.find(r => r.name === reportName || r.query === reportName);

    if (!report) {
      console.warn(`InfluxDB report "${reportName}" not found. Available reports:`, reports.map(r => r.name));
      return { columns: [], rows: [], count: 0, error: `Report "${reportName}" not found` };
    }

    // Run the report
    const result = await apiService.get(
      `/api/reports/${report.uuid}?${params.toString()}`,
      {},
      `running influx report: ${reportName}`,
      false
    );

    return influxApi.parseResponse(result);
  },

  /**
   * Get queue metrics using the predefined QueueCallVolume report
   * @param {string} queueUuid - Queue UUID filter (optional)
   * @param {Date} from - Start time
   * @param {Date} to - End time
   * @param {string} interval - Time bucket (minute, hour, day)
   * @returns {Promise<Object>} Queue metrics with columns and rows
   */
  getQueueMetrics: async (queueUuid, from, to, interval = 'hour') => {
    return influxApi.runReport(INFLUX_REPORTS.QUEUE_CALL_VOLUME, {
      startDate: from,
      endDate: to,
      interval,
      queueUuid
    });
  },

  /**
   * Get queue service level metrics
   * @param {string} queueUuid - Queue UUID filter (optional)
   * @param {Date} from - Start time
   * @param {Date} to - End time
   * @param {string} interval - Time bucket
   * @returns {Promise<Object>} Service level metrics
   */
  getQueueServiceLevel: async (queueUuid, from, to, interval = 'hour') => {
    return influxApi.runReport(INFLUX_REPORTS.QUEUE_SERVICE_LEVEL, {
      startDate: from,
      endDate: to,
      interval,
      queueUuid
    });
  },

  /**
   * Get queue agent activity metrics
   * @param {string} queueUuid - Queue UUID filter (optional)
   * @param {Date} from - Start time
   * @param {Date} to - End time
   * @param {string} interval - Time bucket
   * @returns {Promise<Object>} Agent activity metrics
   */
  getQueueAgentActivity: async (queueUuid, from, to, interval = '15m') => {
    return influxApi.runReport(INFLUX_REPORTS.QUEUE_AGENT_ACTIVITY, {
      startDate: from,
      endDate: to,
      interval,
      queueUuid
    });
  },

  /**
   * Execute a custom SQL query via backend
   * Creates a temporary report or uses existing InfluxDB report
   * @param {string} sql - SQL query (used for field extraction)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query results
   */
  query: async (sql, options = {}) => {
    // For custom SQL queries, we try to find a matching report
    // or fall back to QueueCallVolume as default
    const series = options.series || 'queue_identity';

    // Map series to default report
    const defaultReportMap = {
      'queue_identity': INFLUX_REPORTS.QUEUE_CALL_VOLUME,
      'cdr': 'Cdr',
      'syslog': null // No default syslog report defined
    };

    const reportName = defaultReportMap[series];

    if (!reportName) {
      console.warn(`No default report for series: ${series}`);
      return { columns: [], rows: [], count: 0, error: `No report for series: ${series}` };
    }

    return influxApi.runReport(reportName, {
      startDate: options.start_time || options.startTime,
      endDate: options.end_time || options.endTime,
      interval: options.interval || 'hour',
      limit: options.limit
    });
  },

  /**
   * Test connection via simple report query
   * @returns {Promise<boolean>} Connection status
   */
  testConnection: async () => {
    try {
      // Try to fetch report list to verify API connectivity
      const response = await apiService.get(
        '/api/reports?limit=1',
        {},
        'testing influx connection',
        false
      );
      return !response.error;
    } catch {
      return false;
    }
  },

  /**
   * Get available InfluxDB report types
   * @returns {Promise<Array>} List of available InfluxDB reports
   */
  getAvailableReports: async () => {
    try {
      const response = await apiService.get(
        '/api/reports',
        {},
        'fetching available reports',
        false
      );

      const reports = Array.isArray(response) ? response : response.data || [];

      // Filter to only InfluxDB adapter reports
      return reports.filter(r =>
        r.adapter === 'influxdb' ||
        Object.values(INFLUX_REPORTS).includes(r.name) ||
        Object.values(INFLUX_REPORTS).includes(r.query)
      );
    } catch (error) {
      console.error('Failed to fetch available reports:', error);
      return [];
    }
  },

  /**
   * Get InfluxDB configuration status
   * @returns {Object} Configuration status (API-based, always configured)
   */
  getConfig: () => {
    return {
      mode: 'api',
      isConfigured: true,
      description: 'InfluxDB queries routed through backend reports API'
    };
  },

  /**
   * Parse response to columns/rows format (compatibility layer)
   * @param {Array|Object} result - Raw API response
   * @returns {Object} Parsed data with columns and rows
   */
  parseResponse: (result) => {
    // Handle error responses
    if (!result || result.error) {
      return { columns: [], rows: [], count: 0, error: result?.error };
    }

    // If result is already in { columns, rows } format
    if (result.columns && result.rows) {
      return {
        columns: result.columns,
        rows: result.rows.map((row, index) => ({ id: index, ...row })),
        count: result.count || result.rows.length
      };
    }

    // If result is an array (typical report response)
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return { columns: [], rows: [], count: 0 };
      }

      const columns = Object.keys(result[0]);
      const rows = result.map((row, index) => ({ id: index, ...row }));

      return {
        columns,
        rows,
        count: result.length
      };
    }

    // If result is wrapped in data property
    if (result.data && Array.isArray(result.data)) {
      return influxApi.parseResponse(result.data);
    }

    // Single object result
    if (typeof result === 'object') {
      const columns = Object.keys(result);
      return {
        columns,
        rows: [{ id: 0, ...result }],
        count: 1
      };
    }

    return { columns: [], rows: [], count: 0 };
  }
};

// Predefined call center queries (backward compatible SQL strings)
// These are templates that can be used with influxApi.query()
export const CALL_CENTER_QUERIES = {
  agentStatus: `
    SELECT
      status,
      COUNT(*) as count,
      AVG(talk_time) as avg_talk_time
    FROM agents
    WHERE time > now() - INTERVAL '5 minutes'
    GROUP BY status
  `,

  callMetrics: `
    SELECT
      direction,
      COUNT(*) as total,
      AVG(duration) as avg_duration,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
    FROM calls
    WHERE time > now() - INTERVAL '1 hour'
    GROUP BY direction
  `,

  queueMetrics: `
    SELECT
      queue_name,
      COUNT(*) as depth,
      AVG(wait_time) as avg_wait,
      MAX(wait_time) as max_wait
    FROM queue_entries
    WHERE time > now() - INTERVAL '5 minutes'
    GROUP BY queue_name
  `,

  activeCalls: `
    SELECT
      COUNT(*) as active_calls,
      AVG(duration) as avg_duration
    FROM calls
    WHERE status = 'active'
  `,

  callVolume: `
    SELECT
      time_bucket('5 minutes', time) as bucket,
      COUNT(*) as call_count
    FROM calls
    WHERE time > now() - INTERVAL '1 hour'
    GROUP BY bucket
    ORDER BY bucket
  `
};

// Report name mappings for backend InfluxDB reports
export const INFLUX_REPORT_MAPPINGS = {
  queueMetrics: INFLUX_REPORTS.QUEUE_CALL_VOLUME,
  queueServiceLevel: INFLUX_REPORTS.QUEUE_SERVICE_LEVEL,
  agentActivity: INFLUX_REPORTS.QUEUE_AGENT_ACTIVITY
};

export default influxApi;
