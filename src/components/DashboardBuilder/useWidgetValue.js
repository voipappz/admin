import { useEffect, useState, useCallback, useRef } from 'react';
import { monitoringApi } from '../../services/api/monitoringApi';

/**
 * Live value for one Influx-backed widget — the same
 * monitoringApi.runInfluxQuery({measurement, field, aggregation, minutes})
 * call InfluxMetricExplorer makes, polled on an interval instead of run
 * on-demand. Table widgets don't use this — they read recent_calls off
 * useDashboardSnapshot instead (see Dashboard.jsx).
 */
export function useWidgetValue(widget, { refreshInterval = 30_000 } = {}) {
  const [value, setValue] = useState(null);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);

  const { measurement, field, aggregation, minutes } = widget || {};

  const load = useCallback(async () => {
    if (!measurement || !field) {
      setLoading(false);
      return;
    }
    try {
      const result = await monitoringApi.runInfluxQuery({
        measurement, field, aggregation: aggregation || 'mean', minutes: minutes || 60
      });
      if (!aliveRef.current) return;
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      setSeries(rows);
      // Latest bucket's value is the widget's headline number (counters/gauges/stats);
      // trend/line/bar/pie widgets use the full `series` instead.
      const last = rows[rows.length - 1];
      setValue(last ? Number(last.value) || 0 : 0);
      setError(result?.unavailable ? 'unavailable' : null);
    } catch (err) {
      if (aliveRef.current) setError(err?.message || 'Query failed');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [measurement, field, aggregation, minutes]);

  useEffect(() => {
    aliveRef.current = true;
    setLoading(true);
    load();
    const timer = refreshInterval > 0 ? setInterval(load, refreshInterval) : null;
    return () => { aliveRef.current = false; if (timer) clearInterval(timer); };
  }, [load, refreshInterval]);

  return { value, series, loading, error };
}

export default useWidgetValue;
