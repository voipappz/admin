import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Chip, CircularProgress, IconButton, Tooltip, TextField,
  Select, MenuItem, Button, InputAdornment,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SearchIcon from '@mui/icons-material/Search';
import { formatDate } from '../../utils/dateUtils';
import { alertsApi } from '../../services/api/alertsApi';
import { refreshNavBadges } from '../../hooks/useNavBadges';

/**
 * The Monitoring right rail: active alerts, full height.
 *
 * An alert says something crossed a threshold in config/alerts.yaml, so it
 * belongs next to the charts rather than a click away. The log tail that used to
 * sit underneath is gone — the Logs screen is where you read logs, and here it
 * only stole half the rail from the alerts.
 *
 * An alert is a Notification row (type 'alert'); the list is the unread ones
 * from the last 7 days. "Mark as read" is PUT /api/monitoring/alerts/:id/
 * acknowledge, which marks that notification read, so it leaves this list and
 * the Monitoring nav badge (useNavBadges) — re-polled at once.
 */

const LEVEL_COLOR = { critical: '#dc2626', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
const LEVELS = ['critical', 'error', 'warning', 'info'];
const SEVERITY = { critical: 0, error: 1, warning: 2, info: 3 };
const time = (a) => new Date(a.timestamp).getTime() || 0;
const SORTS = {
  newest: (a, b) => time(b) - time(a),
  oldest: (a, b) => time(a) - time(b),
  severity: (a, b) => (SEVERITY[a.level] ?? 9) - (SEVERITY[b.level] ?? 9) || time(b) - time(a),
};

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

const MonitoringSidebar = ({ alerts = [], loading, onChanged }) => {
  const [level, setLevel] = useState('');        // '' = every level
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [read, setRead] = useState(() => new Set()); // marked read here, until the next fetch drops them
  const [busy, setBusy] = useState(false);

  const open = useMemo(() => alerts.filter(a => !read.has(a.id)), [alerts, read]);
  const counts = useMemo(() => open.reduce((acc, a) => ({ ...acc, [a.level]: (acc[a.level] || 0) + 1 }), {}), [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return open
      .filter(a => !level || a.level === level)
      .filter(a => !q || [a.subject, a.message, a.meta?.host].some(v => String(v || '').toLowerCase().includes(q)))
      .sort(SORTS[sort]);
  }, [open, level, query, sort]);

  const markRead = async (ids) => {
    if (!ids.length) return;
    setBusy(true);
    const done = await Promise.allSettled(ids.map(id => alertsApi.acknowledge(id)));
    const ok = ids.filter((_, i) => done[i].status === 'fulfilled');
    setRead(prev => new Set([...prev, ...ok]));
    setBusy(false);
    refreshNavBadges();
    onChanged?.();
  };

  const filtered = !!(level || query.trim());

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <SectionHeader
        icon={<NotificationsActiveIcon sx={{ fontSize: 16, color: open.length ? '#ef4444' : 'var(--theme-text-secondary)' }} />}
        title={`Alerts (${open.length})`}
        right={shown.length > 0 && (
          <Tooltip title={filtered ? 'Mark the alerts shown as read' : 'Mark every alert as read'}>
            <span>
              <Button size="small" startIcon={<DoneAllIcon sx={{ fontSize: 14 }} />} disabled={busy}
                onClick={() => markRead(shown.map(a => a.id))} data-testid="alerts-mark-all"
                sx={{ textTransform: 'none', fontSize: '0.68rem', minWidth: 0, py: 0 }}>
                {filtered ? `Mark ${shown.length} read` : 'Mark all read'}
              </Button>
            </span>
          </Tooltip>
        )}
      />

      {/* Filter by level (each chip is its count), search, order */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
        <Chip label={`All ${open.length}`} size="small" onClick={() => setLevel('')} data-testid="alerts-level-all"
          variant={level ? 'outlined' : 'filled'} sx={{ height: 20, fontSize: '0.64rem' }} />
        {LEVELS.filter(l => counts[l] > 0).map(l => (
          <Chip key={l} label={`${l} ${counts[l]}`} size="small" onClick={() => setLevel(level === l ? '' : l)}
            data-testid={`alerts-level-${l}`}
            sx={{
              height: 20, fontSize: '0.64rem', textTransform: 'capitalize',
              color: level === l ? '#fff' : LEVEL_COLOR[l],
              bgcolor: level === l ? LEVEL_COLOR[l] : `${LEVEL_COLOR[l]}20`,
              '&:hover': { bgcolor: level === l ? LEVEL_COLOR[l] : `${LEVEL_COLOR[l]}35` },
            }} />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
        <TextField size="small" placeholder="Search alerts" value={query} onChange={e => setQuery(e.target.value)}
          inputProps={{ 'aria-label': 'Search alerts', style: { fontSize: '0.72rem', padding: '4px 6px' } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14 }} /></InputAdornment> }}
          sx={{ flex: 1 }} />
        <Select size="small" value={sort} onChange={e => setSort(e.target.value)}
          inputProps={{ 'aria-label': 'Order alerts' }} sx={{ fontSize: '0.7rem', '& .MuiSelect-select': { py: '4px' } }}>
          <MenuItem value="newest">Newest</MenuItem>
          <MenuItem value="oldest">Oldest</MenuItem>
          <MenuItem value="severity">Severity</MenuItem>
        </Select>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading && !alerts.length ? <CircularProgress size={16} />
          : !open.length ? <Empty>Nothing above threshold.</Empty>
          : !shown.length ? <Empty>No alerts match.</Empty>
          : shown.map(a => (
            <Box key={a.id} data-testid="alert-row" sx={{
              py: 0.75, borderBottom: '1px solid var(--theme-border)',
              borderLeft: `3px solid ${LEVEL_COLOR[a.level] || '#9ca3af'}`, pl: 1,
              display: 'flex', alignItems: 'flex-start', gap: 0.5,
            }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
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
              <Tooltip title="Mark as read">
                <span>
                  <IconButton size="small" disabled={busy} onClick={() => markRead([a.id])}
                    aria-label={`Mark "${a.subject || a.level}" as read`}>
                    <DoneIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          ))}
      </Box>
    </Box>
  );
};

export default MonitoringSidebar;
