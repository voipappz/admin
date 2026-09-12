import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { formatDate } from '../../utils/dateUtils';

/**
 * The Monitoring right rail: active alerts, full height.
 *
 * An alert says something crossed a threshold in config/alerts.yaml, so it
 * belongs next to the charts rather than a click away. The log tail that used to
 * sit underneath is gone — the Logs screen is where you read logs, and here it
 * only stole half the rail from the alerts.
 */

const LEVEL_COLOR = { critical: '#dc2626', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

const SectionHeader = ({ icon, title, right }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
    {icon}
    <Typography variant="caption" sx={{
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
      fontSize: '0.68rem', color: 'var(--theme-text-secondary)', flex: 1,
    }}>
      {title}
    </Typography>
    {right}
  </Box>
);

const Empty = ({ children }) => (
  <Typography variant="caption" sx={{ color: 'var(--theme-text-secondary)', fontStyle: 'italic', fontSize: '0.72rem' }}>
    {children}
  </Typography>
);

const MonitoringSidebar = ({ alerts = [], alertStats, loading }) => {
  const counts = alertStats?.by_level || {};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <SectionHeader
        icon={<NotificationsActiveIcon sx={{ fontSize: 16, color: alerts.length ? '#ef4444' : 'var(--theme-text-secondary)' }} />}
        title={`Alerts (${alertStats?.total ?? alerts.length})`}
        right={
          <Box sx={{ display: 'flex', gap: 0.4 }}>
            {['critical', 'warning', 'info'].map(lvl => (
              counts[lvl] > 0 && (
                <Chip key={lvl} label={counts[lvl]} size="small"
                  sx={{ height: 18, fontSize: '0.62rem', bgcolor: `${LEVEL_COLOR[lvl]}20`, color: LEVEL_COLOR[lvl] }} />
              )
            ))}
          </Box>
        }
      />
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading && !alerts.length ? <CircularProgress size={16} />
          : !alerts.length ? <Empty>Nothing above threshold.</Empty>
          : alerts.map(a => (
            <Box key={a.id} sx={{
              py: 0.75, borderBottom: '1px solid var(--theme-border)',
              borderLeft: `3px solid ${LEVEL_COLOR[a.level] || '#9ca3af'}`, pl: 1,
            }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--theme-text-primary)' }}>
                {a.subject || a.level}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--theme-text-secondary)' }}>
                {a.message}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'var(--theme-text-secondary)' }}>
                {a.meta?.host ? `${a.meta.host} · ` : ''}{formatDate(a.timestamp)}
              </Typography>
            </Box>
          ))}
      </Box>
    </Box>
  );
};

export default MonitoringSidebar;
