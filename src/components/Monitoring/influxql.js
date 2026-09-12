// Reconstruct an editable InfluxQL query that reproduces a Monitoring chart,
// so selecting a chart drops its query into the InfluxDB editor for tweaking.
//
// A chart may carry an `influx` hint for an exact query:
//   influx: { measurement: 'cpu', select: '100 - mean("usage_idle")', alias: 'usage_percent' }
//   influx: { measurement: 'mem', field: 'used_percent', agg: 'mean' }
// Without a hint we emit a best-effort template from the chart's first series
// (correct shape, editable) so every chart still yields a starting query.

const RANGE_TO_MINUTES = { hour: 60, day: 1440, week: 10080, month: 43200 };
const RANGE_TO_BUCKET = { hour: '1m', day: '5m', week: '30m', month: '1h' };

export function buildChartInfluxQL(chart, { host, range = 'day' } = {}) {
  const minutes = RANGE_TO_MINUTES[range] || 1440;
  const bucket = RANGE_TO_BUCKET[range] || '5m';
  const inf = chart?.influx || {};
  const firstSeries = chart?.series?.[0] || {};

  const measurement = inf.measurement || chart?.key || 'measurement';
  const agg = inf.agg || 'mean';
  const field = inf.field || firstSeries.field || 'value';
  const alias = inf.alias || firstSeries.field || field;

  // `select` (full clause) wins; else agg(field); else map every series.
  let select = inf.select;
  if (!select) {
    if (chart?.series?.length > 1 && !inf.field) {
      select = chart.series.map((s) => `${agg}("${s.field}") AS "${s.field}"`).join(', ');
    } else {
      select = `${agg}("${field}") AS "${alias}"`;
    }
  } else if (alias && !/\bAS\b/i.test(select)) {
    select = `${select} AS "${alias}"`;
  }

  const where = [`time > now() - ${minutes}m`];
  if (host) where.push(`"host" = '${host}'`);
  const groupHost = chart?.groupBy === 'host' ? ', "host"' : '';

  return [
    `SELECT ${select}`,
    `FROM "${measurement}"`,
    `WHERE ${where.join(' AND ')}`,
    `GROUP BY time(${bucket})${groupHost} fill(null)`,
  ].join('\n');
}

export default buildChartInfluxQL;
