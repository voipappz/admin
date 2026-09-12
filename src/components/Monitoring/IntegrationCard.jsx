import { Box, Paper, Typography } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { thresholdColor } from './widgets';

// 0 ok, 1 warning, 2 critical.
// `invert` for metrics where SMALL is bad — a certificate expiring in 3 days,
// free disk running out. Without it those breach silently: the value falls
// toward zero while a >= comparison keeps reporting green.
const levelFor = (value, warn, crit, invert = false) => {
  if (typeof value !== 'number') return 0;
  const breached = (limit) => (invert ? value <= limit : value >= limit);
  if (crit != null && breached(crit)) return 2;
  if (warn != null && breached(warn)) return 1;
  return 0;
};

const LEVEL_COLORS = ['inherit', '#f59e0b', '#ef4444'];

const compact = (n) => {
  if (typeof n !== 'number') return '—';
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}G`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return Number.isInteger(n) ? n : n.toFixed(1);
};

/**
 * One integration: its fields as threshold-coloured counters, plus a sparkline of
 * the first field. Fed by useIntegrations in integrations.js — every value comes
 * from /api/monitoring/influxdb/query.
 */
const IntegrationCard = ({ config, data, loading }) => {
  const Icon = config.icon;
  const fields = data?.fields || config.fields.map(f => ({ ...f, value: null, trend: [] }));

  const worst = fields.reduce((w, f) => Math.max(w, levelFor(f.value, f.warn, f.crit, f.invert)), 0);
  const statusColor = worst === 2 ? '#ef4444' : worst === 1 ? '#f59e0b' : '#10b981';
  const spark = fields.find(f => f.trend?.length > 1);

  return (
    <Paper elevation={0} sx={{
      p: 1.5, border: '1px solid var(--theme-border)', borderRadius: '10px',
      backgroundColor: 'var(--widget-content-bg)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {Icon && <Icon sx={{ fontSize: 18, color: config.color }} />}
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1, color: 'var(--theme-text-primary)' }} noWrap>
          {config.name}
        </Typography>
        <CircleIcon sx={{ fontSize: 10, color: statusColor }} />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {fields.map(f => {
          const colored = (f.warn != null || f.crit != null) && typeof f.value === 'number';
          return (
            <Box key={f.key} sx={{ minWidth: 56 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
                <Typography sx={{
                  fontSize: '1.05rem', fontWeight: 700, lineHeight: 1,
                  // thresholdColor only knows higher-is-worse; an inverted field
                  // colours from its own level instead.
                  color: !colored ? config.color
                    : f.invert ? (LEVEL_COLORS[levelFor(f.value, f.warn, f.crit, true)] === 'inherit'
                        ? config.color : LEVEL_COLORS[levelFor(f.value, f.warn, f.crit, true)])
                    : thresholdColor(f.value, f.warn ?? 60, f.crit ?? 80),
                }}>
                  {loading && !data ? '…' : compact(f.value)}
                </Typography>
                {f.unit && <Typography sx={{ fontSize: '0.65rem', color: 'var(--theme-text-secondary)' }}>{f.unit}</Typography>}
              </Box>
              <Typography sx={{ fontSize: '0.62rem', color: 'var(--theme-text-secondary)' }} noWrap>
                {f.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {spark && (
        <Box sx={{ height: 36, mt: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark.trend} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Line type="monotone" dataKey="value" stroke={config.color}
                strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
};

export default IntegrationCard;
