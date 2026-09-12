import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../services/api/metricsApi', () => ({
  metricsApi: { getDetailedHealth: vi.fn() },
}));
vi.mock('../../services/api/monitoringApi', () => ({
  monitoringApi: { runInfluxQuery: vi.fn() },
}));
vi.mock('../../services/api/syslogsApi', () => ({
  syslogsApi: { fetchNodes: vi.fn(), fetchMetrics: vi.fn(), fetchAggregate: vi.fn() },
}));
vi.mock('../../services/api/alertsApi', () => ({
  alertsApi: { getConfig: vi.fn(), getAlerts: vi.fn(), getStats: vi.fn() },
}));

import { metricsApi } from '../../services/api/metricsApi';
import { monitoringApi } from '../../services/api/monitoringApi';
import { syslogsApi } from '../../services/api/syslogsApi';
import { alertsApi } from '../../services/api/alertsApi';
import useMonitoring, { SYSTEM_METRICS } from './Monitoring.js';

// Mocked at the api-module boundary, never the network — same as the other
// hook/service specs in this repo.
const ALERTS_YAML = {
  system: {
    cpu:    { warning: 80, critical: 95 },
    memory: { warning: 85, critical: 95 },
    load:   { warning: 5,  critical: 10 },
  },
  disk: { warning: 95, critical: 98 },
  logs: { error_rate: { window: 5, warning: 20, critical: 100 } },
};

const SYSLOG_METRICS = [
  { appname: 'kamailio', severity: 'info',    latest_value: 100 },
  { appname: 'kamailio', severity: 'err',     latest_value: 3 },
  { appname: 'freeswitch', severity: 'info',  latest_value: 50 },
  { appname: 'freeswitch', severity: 'warning', latest_value: 7 },
  { appname: 'freeswitch', severity: 'crit',  latest_value: 2 },
];

/** /api/monitoring/influxdb/query returns { rows: [{ time, value, host }], … }. */
const influxRows = (rows) => ({ rows, columns: ['time', 'value', 'host'], influxql: 'SELECT …' });

/** Arrange the api mocks; call before renderHook so a test can override one. */
const setupMocks = () => {
  syslogsApi.fetchNodes.mockResolvedValue([{ host: 'node-a' }, { name: 'node-b' }]);
  syslogsApi.fetchMetrics.mockResolvedValue(SYSLOG_METRICS);
  syslogsApi.fetchAggregate.mockResolvedValue([{ time: '2026-07-29T10:00:00Z', info: 150, err: 3 }]);
  alertsApi.getConfig.mockResolvedValue(ALERTS_YAML);
  alertsApi.getAlerts.mockResolvedValue({ alerts: [] });
  alertsApi.getStats.mockResolvedValue({ total: 0, by_level: {} });
  monitoringApi.runInfluxQuery.mockImplementation(({ measurement }) => {
    if (measurement === 'cpu') {
      // usage_idle — the hook must flip this into usage.
      return Promise.resolve(influxRows([
        { time: 't1', value: 90, host: 'node-a' },
        { time: 't2', value: 75, host: 'node-a' },
        { time: 't2', value: 55, host: 'node-b' },
      ]));
    }
    if (measurement === 'mem') {
      return Promise.resolve(influxRows([{ time: 't1', value: 40, host: 'node-a' }]));
    }
    return Promise.resolve(influxRows([]));
  });
};

const setup = () => {
  setupMocks();
  return renderHook(() => useMonitoring());
};

describe('useMonitoring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never requests detailed health during background or manual refreshes', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.fetchData();

    expect(metricsApi.getDetailedHealth).not.toHaveBeenCalled();
  });

  it('queries only measurements that have an Influxer model behind them', async () => {
    setup();
    await waitFor(() => expect(monitoringApi.runInfluxQuery).toHaveBeenCalledTimes(SYSTEM_METRICS.length));
    const asked = monitoringApi.runInfluxQuery.mock.calls.map(([a]) => a.measurement);
    // Each is a `set_series` in lib/models/influxdb/; the endpoint 404s anything else.
    expect(asked.sort()).toEqual(['cpu', 'disk', 'mem', 'system']);
  });

  describe('log aggregations', () => {
    it('sums the per-(app, severity) counts', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.logSummary.total).not.toBeNull());
      expect(result.current.logSummary.total).toBe(162);
      expect(result.current.logSummary.errors).toBe(5);      // err 3 + crit 2
      expect(result.current.logSummary.warnings).toBe(7);
      expect(result.current.logSummary.apps).toBe(2);
    });

    // A zero would read as "nothing is wrong"; there is a difference between no
    // errors and no data, and the cards render "—" for the latter.
    it('reports null, not zero, when nothing came back', async () => {
      setupMocks();
      syslogsApi.fetchMetrics.mockResolvedValue([]);
      const { result } = renderHook(() => useMonitoring());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.logSummary.errors).toBeNull();
      expect(result.current.logSummary.total).toBeNull();
    });

    it('pivots severities into one row per app, busiest first', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.appBreakdown.length).toBe(2));
      const [first, second] = result.current.appBreakdown;
      expect(first.appname).toBe('kamailio');
      expect(first).toMatchObject({ info: 100, err: 3, total: 103 });
      expect(second).toMatchObject({ appname: 'freeswitch', info: 50, warning: 7, err: 2, total: 59 });
    });
  });

  describe('system metrics', () => {
    it("turns cpu's usage_idle into usage", async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.currentValue('cpu')).not.toBeNull());
      // Last bucket per host: node-a 75 idle → 25 used, node-b 55 → 45. Mean 35.
      expect(result.current.currentValue('cpu')).toBe(35);
      expect(result.current.chartRows('cpu')).toContainEqual({ time: 't2', value: 25, host: 'node-a' });
    });

    it('leaves a non-inverted measurement alone', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.currentValue('mem')).not.toBeNull());
      expect(result.current.currentValue('mem')).toBe(40);
    });

    it('is null when the measurement returned no rows', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.currentValue('disk')).toBeNull();
      expect(result.current.chartRows('disk')).toEqual([]);
    });
  });

  describe('thresholds', () => {
    // The server alerts on alerts.yaml's numbers. A card colouring itself
    // against a hardcoded copy would say a box is fine while the backend pages.
    it('come from config/alerts.yaml, not the client', async () => {
      const { result } = setup();
      await waitFor(() => expect(result.current.thresholds('cpu').warn).toBe(80));
      expect(result.current.thresholds('cpu')).toEqual({ warn: 80, crit: 95 });
      expect(result.current.thresholds('disk')).toEqual({ warn: 95, crit: 98 });
      expect(result.current.thresholds('load')).toEqual({ warn: 5, crit: 10 });
    });

    it('are empty when the config could not be loaded', async () => {
      setupMocks();
      alertsApi.getConfig.mockRejectedValue(new Error('401'));
      const { result } = renderHook(() => useMonitoring());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.thresholds('cpu')).toEqual({});
    });
  });
});
