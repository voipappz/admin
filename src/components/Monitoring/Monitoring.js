import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { monitoringApi } from '../../services/api/monitoringApi';
import { syslogsApi } from '../../services/api/syslogsApi';
import { alertsApi } from '../../services/api/alertsApi';

/**
 * Monitoring reads from the live aggregation endpoints below. The API's basic
 * `/health` state is supplied by the shared useApiHealth poll in the view;
 * `/health/detailed` is intentionally reserved for the on-demand health dialog.
 *
 *   /api/logs/{metrics,aggregate}
 *                                 aggregations — per-app/severity counts and
 *                                 the severity-over-time series
 *   /api/monitoring/influxdb/query
 *                                 system metrics — the server builds the query
 *                                 with the Influxer models in
 *                                 lib/models/influxdb/ (cpu, mem, disk, system);
 *                                 the client only names measurement + field.
 *
 * It previously fanned out over 20 "integration" configs against
 * `/api/dashboard/metrics/*`, a mount deleted from the mothership. Every one of
 * those 404'd, so every card read 0 and every chart drew a flat line. Those
 * configs are gone; what is left is what has data behind it.
 */

/** Time presets → the window each backend wants. */
const TIME_RANGES = {
  hour:  { label: '1h',  seconds: 3600,    minutes: 60,    interval: 'minute', bucket: 'minute' },
  day:   { label: '24h', seconds: 86400,   minutes: 1440,  interval: 'hour',   bucket: 'hour' },
  week:  { label: '7d',  seconds: 604800,  minutes: 10080, interval: 'hour',   bucket: 'hour' },
  month: { label: '30d', seconds: 2592000, minutes: 43200, interval: 'day',    bucket: 'day' },
};

/**
 * Host metrics, one entry per Influxer model. `measurement` must match a
 * `set_series` in lib/models/influxdb/ — the endpoint resolves the series name
 * to its model and refuses anything it cannot resolve.
 *
 * cpu reports idle, not usage: Telegraf's `cpu` measurement has usage_idle, so
 * the card shows 100 - idle.
 *
 * `thresholdPath` is a dotted path into config/alerts.yaml. Thresholds are NOT
 * hardcoded here — the server alerts on the yaml's numbers, so a card that
 * coloured itself against its own copy would tell the operator a box is fine
 * while the backend is paging about it.
 */
export const SYSTEM_METRICS = [
  { key: 'cpu',  label: 'CPU',     unit: '%', measurement: 'cpu',    field: 'usage_idle',   aggregation: 'mean', invert: true, thresholdPath: 'system.cpu' },
  { key: 'mem',  label: 'Memory',  unit: '%', measurement: 'mem',    field: 'used_percent', aggregation: 'mean', thresholdPath: 'system.memory' },
  { key: 'disk', label: 'Disk',    unit: '%', measurement: 'disk',   field: 'used_percent', aggregation: 'mean', thresholdPath: 'disk' },
  { key: 'load', label: 'Load 1m', unit: '',  measurement: 'system', field: 'load1',        aggregation: 'mean', thresholdPath: 'system.load' },
];

/** Resolve "system.cpu" against the parsed alerts.yaml. */
const digPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

/** Severities that count as an error, matching InfluxDB::Syslog.normalize_severity. */
export const ERROR_SEVERITIES = ['err', 'crit', 'alert', 'emerg'];

const useMonitoring = () => {
  const [timeRange, setTimeRange] = useState('day');
  const [selectedHost, setSelectedHost] = useState(null); // null = all hosts
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hosts, setHosts] = useState([]);
  const [syslogMetrics, setSyslogMetrics] = useState([]);   // [{ app, severity, latest_value }]
  const [syslogSeries, setSyslogSeries] = useState([]);     // [{ time, info, err, … }]
  const [systemMetrics, setSystemMetrics] = useState({});   // { cpu: { rows, influxql }, … }
  const [alertConfig, setAlertConfig] = useState(null);     // parsed config/alerts.yaml
  const [alerts, setAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState(null);

  const timerRef = useRef(null);

  // Host list and thresholds are static for the session — fetch once, not on
  // every 30s refresh.
  useEffect(() => {
    syslogsApi.fetchNodes()
      .then(list => setHosts((Array.isArray(list) ? list : []).map(n => n.host || n.name).filter(Boolean)))
      .catch(() => setHosts([]));
    alertsApi.getConfig()
      .then(cfg => setAlertConfig(cfg || null))
      .catch(() => setAlertConfig(null));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const cfg = TIME_RANGES[timeRange] || TIME_RANGES.day;
    const to = Math.floor(Date.now() / 1000);
    const from = to - cfg.seconds;
    const host = selectedHost || undefined;

    const logCalls = [
      syslogsApi.fetchMetrics({ from, to, host })
        .then(r => setSyslogMetrics(Array.isArray(r) ? r : []))
        .catch(() => setSyslogMetrics([])),
      syslogsApi.fetchAggregate({ from, to, host, interval: cfg.interval, group_by: 'severity' })
        .then(r => setSyslogSeries(Array.isArray(r) ? r : []))
        .catch(() => setSyslogSeries([])),
    ];

    // Each system metric commits on its own so one missing measurement does not
    // blank the other three.
    const metricCalls = SYSTEM_METRICS.map(m =>
      monitoringApi.runInfluxQuery({
        measurement: m.measurement, field: m.field, aggregation: m.aggregation,
        host: host || '', minutes: cfg.minutes, bucket: cfg.bucket,
      })
        .then(r => setSystemMetrics(prev => ({ ...prev, [m.key]: r || null })))
        .catch(() => setSystemMetrics(prev => ({ ...prev, [m.key]: null })))
    );

    const alertCalls = [
      alertsApi.getAlerts()
        .then(res => {
          const list = res?.alerts || (Array.isArray(res) ? res : []);
          setAlerts(list.map((a, i) => ({ id: a.id ?? i, ...a })));
        })
        .catch(() => setAlerts([])),
      alertsApi.getStats().then(r => setAlertStats(r || null)).catch(() => setAlertStats(null)),
    ];

    await Promise.allSettled([...logCalls, ...metricCalls, ...alertCalls]);
    setLoading(false);
  }, [timeRange, selectedHost]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    timerRef.current = setInterval(fetchData, 30000);
    return () => clearInterval(timerRef.current);
  }, [autoRefresh, fetchData]);

  /**
   * Log aggregations — summed from the per-(app, severity) counts, which is the
   * only place these numbers come from. `null` (not 0) when nothing came back,
   * so the cards can show "—" rather than claim a healthy zero.
   */
  const logSummary = useMemo(() => {
    if (!syslogMetrics.length) return { total: null, errors: null, warnings: null, apps: null };
    const sum = (pred) => syslogMetrics
      .filter(pred)
      .reduce((acc, m) => acc + (Number(m.latest_value) || 0), 0);
    return {
      total: sum(() => true),
      errors: sum(m => ERROR_SEVERITIES.includes(m.severity)),
      warnings: sum(m => m.severity === 'warning'),
      apps: new Set(syslogMetrics.map(m => m.app).filter(Boolean)).size,
    };
  }, [syslogMetrics]);

  /** One row per app, severities pivoted into columns — the breakdown table. */
  const appBreakdown = useMemo(() => {
    const byApp = {};
    syslogMetrics.forEach(m => {
      const app = m.app || 'unknown';
      byApp[app] ||= { id: app, app, err: 0, warning: 0, info: 0, debug: 0, total: 0 };
      const val = Number(m.latest_value) || 0;
      const sev = m.severity || 'info';
      if (ERROR_SEVERITIES.includes(sev)) byApp[app].err += val;
      else if (sev === 'warning') byApp[app].warning += val;
      else if (sev === 'debug') byApp[app].debug += val;
      else byApp[app].info += val;
      byApp[app].total += val;
    });
    return Object.values(byApp).sort((a, b) => b.total - a.total);
  }, [syslogMetrics]);

  /**
   * Current value per host for a system metric, from the last bucket of its
   * series. Returns [] when the measurement produced nothing — an empty list
   * reads as "no data", which is the truth, unlike a zero.
   */
  const currentByHost = useCallback((key) => {
    const cfg = SYSTEM_METRICS.find(m => m.key === key);
    const rows = systemMetrics[key]?.rows || [];
    const latest = {};
    rows.forEach(row => {
      const h = row.host || 'unknown';
      const v = row.value;
      if (v == null) return;
      // Rows come back time-ordered per host; keep overwriting to land on the last.
      latest[h] = cfg?.invert ? 100 - Number(v) : Number(v);
    });
    return Object.entries(latest).map(([h, value]) => ({ host: h, value: +value.toFixed(2) }));
  }, [systemMetrics]);

  /**
   * Chart rows for a system metric: [{ time, value, host }], with cpu's idle
   * already flipped to usage so the chart and its card show the same number.
   */
  const chartRows = useCallback((key) => {
    const cfg = SYSTEM_METRICS.find(m => m.key === key);
    const rows = systemMetrics[key]?.rows || [];
    if (!cfg?.invert) return rows;
    return rows.map(r => ({ ...r, value: r.value == null ? null : 100 - Number(r.value) }));
  }, [systemMetrics]);

  /** Mean across hosts — the headline number on the card. null when no data. */
  const currentValue = useCallback((key) => {
    const per = currentByHost(key);
    if (!per.length) return null;
    return +(per.reduce((s, p) => s + p.value, 0) / per.length).toFixed(1);
  }, [currentByHost]);

  /**
   * warn/crit for a system metric, straight out of config/alerts.yaml. Returns
   * {} until the config lands (and if it never does) — a card with no
   * thresholds renders uncoloured rather than inventing a limit.
   */
  const thresholds = useCallback((key) => {
    const cfg = SYSTEM_METRICS.find(m => m.key === key);
    const node = cfg && alertConfig ? digPath(alertConfig, cfg.thresholdPath) : null;
    if (!node) return {};
    return { warn: node.warning, crit: node.critical };
  }, [alertConfig]);

  return {
    timeRange, setTimeRange, TIME_RANGES,
    hosts, selectedHost, setSelectedHost,
    autoRefresh, toggleAutoRefresh: () => setAutoRefresh(v => !v),
    loading,
    logSummary, appBreakdown, syslogSeries,
    systemMetrics, currentValue, currentByHost, chartRows,
    alertConfig, thresholds,
    alerts, alertStats,
    fetchData,
  };
};

export default useMonitoring;
