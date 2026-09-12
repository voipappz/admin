import { useEffect, useMemo, useState } from 'react';
import SpeedIcon from '@mui/icons-material/Speed';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import DnsIcon from '@mui/icons-material/Dns';
import LanIcon from '@mui/icons-material/Lan';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HttpIcon from '@mui/icons-material/Http';
import ArticleIcon from '@mui/icons-material/Article';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import LockIcon from '@mui/icons-material/Lock';
import HubIcon from '@mui/icons-material/Hub';
import WorkIcon from '@mui/icons-material/Work';
import ScheduleIcon from '@mui/icons-material/Schedule';
import HealthIcon from '@mui/icons-material/MonitorHeart';
import PhoneIcon from '@mui/icons-material/PhoneInTalk';
import { monitoringApi } from '../../services/api/monitoringApi';

/**
 * One row per integration card. `series` must match a `set_series` in
 * lib/models/influxdb/ and `fields` must be that model's `attributes` — the
 * /api/monitoring/influxdb/query endpoint resolves the series to its model and
 * 404s on anything else, so a wrong name here shows as an empty card.
 *
 * This replaces a 20-file config directory. Those files described the old
 * /api/dashboard response shapes with per-metric extract() closures; that mount
 * is gone, every one of them 404'd, and the descriptions went with it. Three
 * facts per integration is all the card needs.
 *
 * A model is no longer required. Telegraf writes ~107 measurements and only 16
 * have one in lib/models/influxdb/, which is why cert/dns/nats/sidekiq/docker
 * health were dropped — the query endpoint 404'd them. It now falls back to a
 * generic series for any measurement InfluxDB actually reports, so a row here
 * is enough. A real model still adds tags, scopes and thresholds.
 *
 * Field names below are the measurements' real field keys, taken from
 * /api/monitoring/influxdb/schema — not guessed. A wrong one shows an empty card.
 *
 * Still absent because nothing writes them: kong (telegraf declares the inputs
 * but no kong_* measurement arrives), kamailio, freeswitch, minio. Those need
 * the collector fixed, not a row here.
 */
export const INTEGRATIONS = [
  { id: 'system', name: 'System', series: 'system', icon: SpeedIcon, color: '#6366f1',
    fields: [
      { key: 'load1', label: 'Load 1m', thresholdPath: 'system.load' },
      { key: 'n_cpus', label: 'CPUs' },
    ] },

  { id: 'postgresql', name: 'PostgreSQL', series: 'postgresql', icon: StorageIcon, color: '#336791',
    fields: [
      { key: 'numbackends', label: 'Connections' },
      { key: 'deadlocks', label: 'Deadlocks', warn: 1, crit: 5 },
      { key: 'xact_commit', label: 'Commits' },
    ] },

  { id: 'redis', name: 'Redis', series: 'redis', icon: MemoryIcon, color: '#dc382d',
    fields: [
      { key: 'connected_clients', label: 'Clients' },
      { key: 'blocked_clients', label: 'Blocked', warn: 1, crit: 10 },
      { key: 'used_memory', label: 'Memory', unit: 'B' },
    ] },

  { id: 'docker', name: 'Docker', series: 'docker_container_cpu', icon: ViewInArIcon, color: '#2496ed',
    fields: [
      { key: 'usage_percent', label: 'CPU', unit: '%', warn: 80, crit: 95 },
      { key: 'throttling_throttled_periods', label: 'Throttled', warn: 1 },
    ] },

  { id: 'ping', name: 'Ping', series: 'ping', icon: DnsIcon, color: '#10b981',
    fields: [
      { key: 'average_response_ms', label: 'Avg', unit: 'ms' },
      { key: 'percent_packet_loss', label: 'Loss', unit: '%', warn: 1, crit: 10 },
    ] },

  { id: 'network', name: 'Network', series: 'net', icon: LanIcon, color: '#0ea5e9',
    fields: [
      { key: 'bytes_recv', label: 'In', unit: 'B' },
      { key: 'bytes_sent', label: 'Out', unit: 'B' },
    ] },

  { id: 'errors', name: 'Log errors', series: 'log_volume', icon: ErrorOutlineIcon, color: '#ef4444',
    fields: [
      { key: 'severity_code_count', label: 'Lines', thresholdPath: 'logs.error_rate' },
    ] },

  { id: 'http', name: 'HTTP', series: 'http', icon: HttpIcon, color: '#f59e0b',
    fields: [
      { key: 'timing_total_elapsed', label: 'Elapsed', unit: 'ms' },
      { key: 'response_length', label: 'Size', unit: 'B' },
    ] },

  { id: 'syslog', name: 'Syslog', series: 'syslog', icon: ArticleIcon, color: '#8b5cf6',
    // syslog's only attribute is the message itself, so the card counts rows.
    fields: [{ key: 'message', label: 'Lines', aggregation: 'count' }] },

  // ── Restored now that the query endpoint no longer requires a model ──

  { id: 'ssl', name: 'SSL certificates', series: 'x509_cert', icon: LockIcon, color: '#16a34a',
    fields: [
      // Seconds until expiry, so SMALL is the emergency — hence invert.
      // 30d warning / 7d critical, the usual renewal window.
      { key: 'expiry', label: 'Expires in', unit: 's', invert: true, warn: 2592000, crit: 604800,
        aggregation: 'min' },
      // 0 means the chain verified; anything else is a broken cert.
      { key: 'verification_code', label: 'Verify', warn: 1, crit: 1, aggregation: 'max' },
    ] },

  { id: 'dns', name: 'DNS', series: 'dns_query', icon: DnsIcon, color: '#7c3aed',
    fields: [
      { key: 'query_time_ms', label: 'Query', unit: 'ms', warn: 200, crit: 1000 },
      { key: 'rcode_value', label: 'RCODE', warn: 1, crit: 1, aggregation: 'max' },
    ] },

  { id: 'nats', name: 'NATS', series: 'nats', icon: HubIcon, color: '#27aae1',
    fields: [
      { key: 'connections', label: 'Conns' },
      { key: 'in_msgs', label: 'In' },
      { key: 'out_msgs', label: 'Out' },
    ] },

  { id: 'sidekiq', name: 'Sidekiq', series: 'sidekiq_jobs_executed_total', icon: WorkIcon, color: '#b91c1c',
    fields: [{ key: 'counter', label: 'Executed', aggregation: 'last' }] },

  { id: 'scheduler', name: 'Scheduler', series: 'scheduler_jobs_executed_total', icon: ScheduleIcon, color: '#0891b2',
    fields: [{ key: 'counter', label: 'Executed', aggregation: 'last' }] },

  { id: 'container_health', name: 'Container health', series: 'docker_container_health', icon: HealthIcon, color: '#059669',
    // failing_streak counts consecutive failed healthchecks — any streak is bad.
    fields: [{ key: 'failing_streak', label: 'Failing', warn: 1, crit: 3, aggregation: 'max' }] },

  { id: 'endpoints', name: 'Endpoint checks', series: 'http_response', icon: HttpIcon, color: '#ea580c',
    // result_code 0 = success; non-zero means the probe failed.
    fields: [{ key: 'result_code', label: 'Result', warn: 1, crit: 1, aggregation: 'max' }] },

  { id: 'sip', name: 'SIP capture', series: 'hep', icon: PhoneIcon, color: '#4f46e5',
    fields: [{ key: 'payload_len', label: 'Packets', aggregation: 'count' }] },

  { id: 'swap', name: 'Swap', series: 'swap', icon: MemoryIcon, color: '#a16207',
    fields: [{ key: 'used_percent', label: 'Used', unit: '%', warn: 25, crit: 50 }] },

  { id: 'processes', name: 'Processes', series: 'processes', icon: SpeedIcon, color: '#475569',
    fields: [
      { key: 'total', label: 'Total' },
      { key: 'blocked', label: 'Blocked', warn: 1, crit: 5 },
      { key: 'zombies', label: 'Zombie', warn: 1, crit: 5 },
    ] },
];

/** Resolve "system.load" against the parsed alerts.yaml. */
const digPath = (obj, path) => path?.split('.').reduce((o, k) => o?.[k], obj);

/**
 * Latest value and trend per field, straight off the query endpoint. One request
 * per (integration, field) — the endpoint takes a single field at a time.
 */
export const useIntegrations = ({ minutes, bucket, host, alertConfig }) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all(INTEGRATIONS.map(async (integ) => {
      const fields = await Promise.all(integ.fields.map(async (f) => {
        const res = await monitoringApi.runInfluxQuery({
          measurement: integ.series, field: f.key,
          aggregation: f.aggregation || 'mean', minutes, bucket, host,
        }).catch(() => null);

        const rows = res?.rows || [];
        const trend = rows.map(r => ({ time: r.time, value: Number(r.value) || 0 }));
        return {
          ...f,
          value: trend.length ? trend[trend.length - 1].value : null,
          trend,
        };
      }));

      return [integ.id, { fields }];
    })).then(entries => {
      if (cancelled) return;
      setData(Object.fromEntries(entries));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [minutes, bucket, host]);

  // Applying alert thresholds is presentation work. Keep it out of the fetch
  // effect so alerts.yaml arriving after first render does not repeat every
  // integration query.
  const configuredData = useMemo(() => Object.fromEntries(
    Object.entries(data).map(([id, integration]) => [id, {
      ...integration,
      fields: integration.fields.map((field) => {
        const yaml = field.thresholdPath ? digPath(alertConfig, field.thresholdPath) : null;
        return {
          ...field,
          warn: yaml?.warning ?? field.warn,
          crit: yaml?.critical ?? field.crit,
        };
      }),
    }]),
  ), [data, alertConfig]);

  return { data: configuredData, loading };
};
