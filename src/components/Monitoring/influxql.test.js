import { describe, it, expect } from 'vitest';
import { buildChartInfluxQL } from './influxql.js';

const cpu = { key: 'cpu_chart', groupBy: 'host', series: [{ field: 'usage_percent' }],
  influx: { measurement: 'cpu', select: '100 - mean("usage_idle")', alias: 'usage_percent' } };
const mem = { key: 'mem_chart', groupBy: 'host', series: [{ field: 'mean' }],
  influx: { measurement: 'mem', field: 'used_percent', agg: 'mean', alias: 'used_percent' } };
const load = { key: 'load_chart', groupBy: 'host', series: [{ field: 'mean_load1' }, { field: 'mean_load5' }],
  influx: { measurement: 'system', select: 'mean("load1") AS load1, mean("load5") AS load5' } };
const noHint = { key: 'redis_ops', groupBy: 'host', series: [{ field: 'ops' }] };

describe('buildChartInfluxQL', () => {
  it('uses the influx.select clause and measurement verbatim (cpu)', () => {
    const q = buildChartInfluxQL(cpu, { host: 'node1', range: 'day' });
    expect(q).toContain('SELECT 100 - mean("usage_idle") AS "usage_percent"');
    expect(q).toContain('FROM "cpu"');
  });

  it('builds agg(field) from a field/agg hint (mem)', () => {
    const q = buildChartInfluxQL(mem, { range: 'day' });
    expect(q).toContain('SELECT mean("used_percent") AS "used_percent"');
    expect(q).toContain('FROM "mem"');
  });

  it('scopes to a host only when one is selected', () => {
    expect(buildChartInfluxQL(mem, { host: 'node9', range: 'day' })).toContain(`"host" = 'node9'`);
    expect(buildChartInfluxQL(mem, { range: 'day' })).not.toContain('"host" =');
  });

  it('maps the time range to minutes + bucket', () => {
    expect(buildChartInfluxQL(mem, { range: 'hour' })).toContain('time > now() - 60m');
    expect(buildChartInfluxQL(mem, { range: 'hour' })).toContain('GROUP BY time(1m)');
    expect(buildChartInfluxQL(mem, { range: 'week' })).toContain('time > now() - 10080m');
    expect(buildChartInfluxQL(mem, { range: 'week' })).toContain('GROUP BY time(30m)');
  });

  it('groups by host when the chart does', () => {
    expect(buildChartInfluxQL(cpu, { range: 'day' })).toMatch(/GROUP BY time\(5m\), "host" fill\(null\)/);
  });

  it('keeps a multi-expression select intact (load)', () => {
    const q = buildChartInfluxQL(load, { range: 'day' });
    expect(q).toContain('mean("load1") AS load1, mean("load5") AS load5');
    expect(q).toContain('FROM "system"');
  });

  it('falls back to a valid template when a chart has no influx hint', () => {
    const q = buildChartInfluxQL(noHint, { range: 'day' });
    expect(q).toContain('SELECT mean("ops") AS "ops"');
    expect(q).toContain('FROM "redis_ops"'); // measurement defaults to chart.key
    expect(q).toMatch(/^SELECT .+\nFROM .+\nWHERE .+\nGROUP BY /s);
  });
});
