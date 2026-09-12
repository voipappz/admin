import { Box, Paper, Typography, CircularProgress, Badge } from '@mui/material';

/** Threshold-based color */
export const thresholdColor = (value, warn = 60, crit = 80) => {
  if (value >= crit) return '#ef4444';
  if (value >= warn) return '#f59e0b';
  return '#10b981';
};

/**
 * MetricCard — summary stat card with optional sparkline-style coloring
 */
const MetricCard = ({ title, value, unit, icon, color, loading, alertCount, warn, crit, footnote }) => {
  const displayColor = (warn != null || crit != null) && typeof value === 'number'
    ? thresholdColor(value, warn ?? 60, crit ?? 80)
    : color;

  return (
    <Paper
      className="monitoring-metric-card"
      elevation={0}
      sx={{
        flex: 1, minWidth: 160, p: 2.5,
        border: '1px solid var(--theme-border)', borderRadius: '12px',
        backgroundColor: 'var(--theme-bg-primary)',
        display: 'flex', flexDirection: 'column', gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" sx={{ color: 'var(--theme-text-secondary)', fontWeight: 500, fontSize: '0.8rem' }}>
            {title}
          </Typography>
          {alertCount > 0 && (
            <Badge badgeContent={alertCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 16, height: 16 } }} />
          )}
        </Box>
        <Box sx={{
          width: 36, height: 36, borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: `${displayColor}15`,
        }}>
          {icon}
        </Box>
      </Box>
      <Typography variant="h4" sx={{
        fontWeight: 700, color: 'var(--theme-text-primary)',
        fontFamily: 'Rubik, sans-serif', fontSize: '2rem', lineHeight: 1.1,
      }}>
        {loading ? <CircularProgress size={28} /> : (
          <>
            {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : (value ?? '-')}
            {unit && <Typography component="span" sx={{ fontSize: '1rem', ml: 0.5, fontWeight: 400 }}>{unit}</Typography>}
          </>
        )}
      </Typography>
      {/* Where this card turns amber and red — read from config/alerts.yaml, so
          the operator sees the same limits the backend alerts on. */}
      {footnote && (
        <Typography variant="caption" sx={{ color: 'var(--theme-text-secondary)', fontSize: '0.68rem' }}>
          {footnote}
        </Typography>
      )}
    </Paper>
  );
};

export default MetricCard;
