import { useEffect, useState } from 'react';
import {
  Box, Typography, Badge, Chip, IconButton, Drawer, CircularProgress,
  Tooltip, List, ListItem, ListItemIcon, ListItemText, Avatar, Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import SuccessIcon from '@mui/icons-material/CheckCircle';
import ExceptionIcon from '@mui/icons-material/BugReport';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import MonitorIcon from '@mui/icons-material/MonitorHeart';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNotifications } from './useNotifications';
import NotificationPanel from './NotificationPanel/NotificationPanel';
import { useConfirm } from '../ui';

const FILTERS = ['all', 'unread', 'critical', 'error', 'warning', 'info'];

/**
 * NotificationsSidebar — a compact, self-contained notifications feed meant to
 * be docked as a right rail (e.g. on the Monitoring page). Reuses the same
 * useNotifications hook + NotificationPanel detail view as the full page.
 */
const NotificationsSidebar = () => {
  const confirm = useConfirm();
  const {
    notifications, loading, error,
    markAsRead, deleteNotification, clearAllNotifications, refreshNotifications,
    fetchNotificationDetails, totalCount,
  } = useNotifications();
  const theme = useTheme();
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The hook does not auto-fetch on mount; pull the feed when the rail renders.
  useEffect(() => { refreshNotifications(); }, [refreshNotifications]);

  const colorFor = (level) => {
    switch (level) {
      case 'critical':
      case 'error': return theme.palette.error.main;
      case 'warning': return theme.palette.warning.main;
      case 'info': return theme.palette.info.main;
      case 'success': return theme.palette.success.main;
      default: return theme.palette.grey[600];
    }
  };

  const iconFor = (type, level) => {
    const color = colorFor(level);
    switch (type) {
      case 'exception': return <ExceptionIcon sx={{ color, fontSize: 20 }} />;
      case 'error': return <ErrorIcon sx={{ color, fontSize: 20 }} />;
      case 'warning': return <WarningIcon sx={{ color, fontSize: 20 }} />;
      case 'info': return <InfoIcon sx={{ color, fontSize: 20 }} />;
      case 'success': return <SuccessIcon sx={{ color, fontSize: 20 }} />;
      case 'health':
      case 'system_monitoring': return <MonitorIcon sx={{ color, fontSize: 20 }} />;
      default: return <NotificationsIcon sx={{ color, fontSize: 20 }} />;
    }
  };

  const timeAgo = (dateString) => {
    if (!dateString) return '';
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
    if (diff < 1) return 'now';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  };

  const filtered = filter === 'all'
    ? notifications
    : filter === 'unread'
      ? notifications.filter((n) => !n.read_at)
      : notifications.filter((n) => n.level === filter);
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const openDetail = (n) => { setSelected(n); setDrawerOpen(true); };

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
      border: '1px solid var(--theme-border)', borderRadius: '12px',
      backgroundColor: 'var(--theme-bg-primary)', overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{ px: 1.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid var(--theme-border)' }}>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsActiveIcon sx={{ fontSize: 20, color: 'var(--theme-text-secondary)' }} />
        </Badge>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          Notifications
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--theme-text-secondary)' }}>{totalCount}</Typography>
        <Tooltip title="Refresh">
          <span><IconButton size="small" disabled={loading} onClick={refreshNotifications}><RefreshIcon fontSize="small" /></IconButton></span>
        </Tooltip>
        {/* Clear read first (the safe one), then clear everything. Both confirm —
            there is no undo, and unread alerts are the point of the rail. */}
        <Tooltip title="Clear read">
          <span>
            <IconButton
              size="small"
              disabled={loading || !notifications.some((n) => n.read_at)}
              onClick={() => clearAllNotifications(true)}
            >
              <PlaylistRemoveIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Clear all">
          <span>
            <IconButton
              size="small"
              color="error"
              disabled={loading || notifications.length === 0}
              onClick={async () => {
                if (await confirm({ title: 'Delete all notifications', confirmLabel: 'Delete all',
                                    message: `Delete all ${totalCount} notifications?` })) {
                  clearAllNotifications(false);
                }
              }}
            >
              <ClearAllIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Filter chips */}
      <Box sx={{ px: 1, py: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5, borderBottom: '1px solid var(--theme-border)' }}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            size="small"
            onClick={() => setFilter(f)}
            color={filter === f ? 'primary' : 'default'}
            variant={filter === f ? 'filled' : 'outlined'}
            sx={{ fontSize: '0.68rem', height: 22 }}
          />
        ))}
      </Box>

      {/* Feed */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading && notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={26} /></Box>
        ) : error ? (
          <Typography sx={{ p: 2, fontSize: '0.78rem', color: 'error.main' }}>Failed to load: {error}</Typography>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="textSecondary">
              {filter === 'unread' ? 'All caught up' : 'No notifications'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filtered.map((n, i) => (
              <Box key={n.uuid}>
                <ListItem
                  onClick={() => openDetail(n)}
                  sx={{
                    cursor: 'pointer', py: 1, alignItems: 'flex-start',
                    backgroundColor: !n.read_at ? 'action.hover' : 'transparent',
                    borderLeft: `3px solid ${colorFor(n.level)}`,
                    '&:hover': { backgroundColor: 'action.selected' },
                  }}
                  secondaryAction={
                    <IconButton size="small" edge="end" color="error"
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.uuid); }}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  }
                >
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                    <Avatar sx={{ width: 28, height: 28, backgroundColor: `${colorFor(n.level)}15` }}>
                      {iconFor(n.type, n.level)}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.subject}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ flexShrink: 0 }}>{timeAgo(n.created_at)}</Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="textSecondary" sx={{
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {n.msg}
                      </Typography>
                    }
                  />
                </ListItem>
                {i < filtered.length - 1 && <Divider component="li" />}
              </Box>
            ))}
          </List>
        )}
      </Box>

      {/* Detail drawer — reuses the full NotificationPanel */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{ '& .MuiDrawer-paper': { width: { xs: '100%', sm: 500 }, maxWidth: '90vw' } }}
      >
        <NotificationPanel
          notification={selected}
          onClose={() => setDrawerOpen(false)}
          onMarkAsRead={markAsRead}
          onDelete={(id) => { deleteNotification(id); setDrawerOpen(false); }}
          fetchNotificationDetails={fetchNotificationDetails}
        />
      </Drawer>
    </Box>
  );
};

export default NotificationsSidebar;
