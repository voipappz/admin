import { useState, useEffect, useRef, useCallback } from 'react';
import { monitoringApi } from '../../services/api/monitoringApi';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';

const TIME_WINDOWS = [
  { label: '30m', minutes: 30, bucket: '1m' },
  { label: '1h', minutes: 60, bucket: '1m' },
  { label: '4h', minutes: 240, bucket: '5m' },
  { label: '24h', minutes: 1440, bucket: '1h' },
];

// CDR data is less frequent — use wider buckets
const CDR_TIME_WINDOWS = [
  { label: '1h', minutes: 60, bucket: '5m' },
  { label: '4h', minutes: 240, bucket: '15m' },
  { label: '24h', minutes: 1440, bucket: '1h' },
  { label: '7d', minutes: 10080, bucket: '1d' },
];

// Only the chart types the mothership actually serves. `/api/monitoring/charts`
// implements exactly two (live_calls, live_registrations).
//
// cdr, cdr_by_disposition, cdr_by_cause, cdr_by_sip_status, queue_stats,
// campaign_stats, user_stats and environment_stats were served by
// `/api/dashboard/metrics/*`, a mount that was deleted from the mothership — so
// they had been 404ing and rendering as flat zero lines. They are omitted rather
// than left pointing at a dead URL: the hook raises "Unknown chart type", which
// says the data source is missing instead of drawing a chart that claims zero.
// Restoring one means adding its case to Endpoints::Monitoring#charts first.
const FETCHERS = {
  live_calls: (env, min, bkt, _uuid, cust) => monitoringApi.getLiveCallsChart(env, min, bkt, cust),
  live_registrations: (env, min, bkt, _uuid, cust) => monitoringApi.getLiveRegistrationsChart(env, min, bkt, cust),
};

// CDR breakdown chart types share the CDR time windows
const CDR_CHART_TYPES = new Set(['cdr', 'cdr_by_disposition', 'cdr_by_cause', 'cdr_by_sip_status']);

/**
 * Hook for fetching live chart data (calls, registrations, CDR, queue/campaign/user/environment stats)
 * @param {'live_calls'|'live_registrations'|'cdr'|'queue_stats'|'campaign_stats'|'user_stats'|'environment_stats'} chartType
 * @param {string|null} uuid - Optional entity UUID filter
 * @returns {{ chartData, loading, error, timeWindow, setTimeWindow, TIME_WINDOWS, refresh }}
 */
export function useLiveCharts(chartType, uuid = null) {
  const windows = CDR_CHART_TYPES.has(chartType) ? CDR_TIME_WINDOWS : TIME_WINDOWS;
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeWindow, setTimeWindow] = useState(windows[1]); // default second option
  const intervalRef = useRef(null);

  // Backend now reads customer_uuid as a direct InfluxDB tag filter (see
  // 20e7eddad — Yabeda :live/:cdr groups + LogPublisher tag with customer_uuid).
  // When no customer is selected, send nothing → unfiltered customer-wide view.
  const { selectedCustomer } = useCustomerEnvironment();
  const customerUuid = selectedCustomer?.uuid || null;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetcher = FETCHERS[chartType];
      if (!fetcher) throw new Error(`Unknown chart type: ${chartType}`);

      const data = await fetcher(null, timeWindow.minutes, timeWindow.bucket, uuid, customerUuid);
      setChartData(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch chart data');
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [chartType, timeWindow, uuid, customerUuid]);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30s
    intervalRef.current = setInterval(fetchData, 30000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  return {
    chartData,
    loading,
    error,
    timeWindow,
    setTimeWindow,
    TIME_WINDOWS: windows,
    refresh: fetchData,
  };
}

export { TIME_WINDOWS, CDR_TIME_WINDOWS };
