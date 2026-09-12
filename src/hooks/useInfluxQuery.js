import { useState, useEffect, useCallback, useRef } from 'react';
import { influxApi } from '../services/api/influxApi';

/**
 * React hook for executing InfluxDB queries via backend API
 * Drop-in replacement for direct client version - queries now route through
 * the backend reports system with Influxer gem
 *
 * @param {string} sql - SQL query string (used for field extraction, or report name)
 * @param {Object} options - Query options
 * @param {number} options.refreshInterval - Auto-refresh interval in ms (default: 30000, 0 to disable)
 * @param {boolean} options.enabled - Whether query is enabled (default: true)
 * @param {boolean} options.parseResponse - Whether to parse response (default: true)
 * @param {string} options.series - InfluxDB series (queue_identity, cdr, syslog)
 * @param {string|Date} options.startTime - Start time for query
 * @param {string|Date} options.endTime - End time for query
 * @param {string} options.interval - Time bucket (minute, hour, day)
 * @param {string} options.reportName - Specific report name to run (overrides sql)
 * @returns {Object} Query state with data, loading, error, lastUpdated, and refetch function
 */
export function useInfluxQuery(sql, options = {}) {
  const {
    refreshInterval = 30000,
    enabled = true,
    parseResponse = true,
    series = 'queue_identity',
    startTime,
    endTime,
    interval = 'hour',
    reportName,
    queueUuid
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Need either sql, reportName, or we'll use series default
    if (!sql && !reportName && !series) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      let result;

      // If a specific report name is provided, use it directly
      if (reportName) {
        result = await influxApi.runReport(reportName, {
          startDate: startTime,
          endDate: endTime,
          interval,
          queueUuid
        });
      } else {
        // Use the query method which maps series to default reports
        result = await influxApi.query(sql, {
          series,
          start_time: startTime,
          end_time: endTime,
          interval,
          queueUuid
        });
      }

      // Handle error in result
      if (result.error) {
        setError(result.error);
        setData(parseResponse ? { columns: [], rows: [] } : []);
      } else {
        // Parse response if needed
        const processedData = parseResponse
          ? result
          : { rows: result.rows || [], columns: result.columns || [] };

        setData(processedData);
        setLastUpdated(new Date());
      }
    } catch (err) {
      const errorMessage = err.message || 'Query failed';
      setError(errorMessage);
      console.error('InfluxDB query error:', err);
    } finally {
      setLoading(false);
    }
  }, [sql, enabled, parseResponse, series, startTime, endTime, interval, reportName, queueUuid]);

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchData();

    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchData, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [sql, refreshInterval, enabled, fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch
  };
}

/**
 * Hook for managing multiple InfluxDB queries (via backend API)
 * @param {Object} queries - Object mapping names to query configs
 * @param {Object} options - Common options for all queries
 * @returns {Object} Results state with results, loading, errors, and refetch function
 */
export function useInfluxQueries(queries, options = {}) {
  const { refreshInterval = 30000, enabled = true } = options;

  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const intervalRef = useRef(null);

  const fetchAllData = useCallback(async () => {
    if (!enabled || Object.keys(queries).length === 0) {
      setLoading(false);
      return;
    }

    const newResults = {};
    const newErrors = {};

    await Promise.all(
      Object.entries(queries).map(async ([name, queryConfig]) => {
        try {
          // queryConfig can be a string (SQL) or object with reportName
          if (typeof queryConfig === 'string') {
            const result = await influxApi.query(queryConfig, options);
            newResults[name] = result;
          } else {
            const result = await influxApi.runReport(
              queryConfig.reportName,
              queryConfig.options || options
            );
            newResults[name] = result;
          }
        } catch (err) {
          newErrors[name] = err.message || 'Query failed';
        }
      })
    );

    setResults(newResults);
    setErrors(newErrors);
    setLoading(false);
  }, [queries, enabled, options]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchAllData();

    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchAllData, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [queries, refreshInterval, enabled, fetchAllData]);

  return {
    results,
    loading,
    errors,
    refetch: fetchAllData
  };
}

/**
 * Hook specifically for queue metrics (convenience wrapper)
 * @param {string} queueUuid - Queue UUID to filter (optional)
 * @param {Object} options - Query options
 * @returns {Object} Queue metrics data and state
 */
export function useQueueMetrics(queueUuid = null, options = {}) {
  const {
    refreshInterval = 30000,
    enabled = true,
    startTime = new Date(Date.now() - 24 * 60 * 60 * 1000), // Default: last 24 hours
    endTime = new Date(),
    interval = 'hour'
  } = options;

  return useInfluxQuery(null, {
    reportName: 'QueueCallVolume',
    queueUuid,
    startTime,
    endTime,
    interval,
    refreshInterval,
    enabled
  });
}

export default useInfluxQuery;
