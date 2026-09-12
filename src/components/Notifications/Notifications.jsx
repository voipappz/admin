import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Badge,
  Chip,
  IconButton,
  Drawer,
  CircularProgress,
  Divider,
  Button,
  TablePagination
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  BugReport as ExceptionIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  Delete as DeleteIcon,
  MarkEmailRead as MarkReadIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Tune as TuneIcon,
  MonitorHeart as MonitorIcon
} from '@mui/icons-material';
import { useNotifications } from './useNotifications';
import NotificationPanel from './NotificationPanel/NotificationPanel';
import './Notifications.css';

const AlertConfigPanel = ({ config, loading }) => {
  if (loading) return <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={30} /></Box>;
  if (!config) return <Typography sx={{ p: 3 }} color="textSecondary">No alert configuration loaded</Typography>;

  const renderSection = (name, data) => {
    if (!data || typeof data !== 'object') return null;
    return (
      <Paper key={name} sx={{ p: 2, mb: 1 }} variant="outlined">
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textTransform: 'capitalize', mb: 1 }}>
          {name.replace(/_/g, ' ')}
        </Typography>
        <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
          {JSON.stringify(data, null, 2)}
        </Typography>
      </Paper>
    );
  };

  return (
    <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
      {Object.entries(config).map(([key, value]) => renderSection(key, value))}
    </Box>
  );
};

const Notifications = () => {
  const {
    notifications,
    loading,
    error,
    markAsRead,
    deleteNotification,
    refreshNotifications,
    fetchNotificationDetails,
    totalCount,
    currentPage,
    perPage,
    changePage,
    alertConfig,
    alertConfigLoading,
    fetchAlertConfig
  } = useNotifications();
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  const theme = useTheme();

  const getNotificationIcon = (type, level) => {
    const iconColor = getNotificationColor(level);
    
    switch (type) {
      case 'exception':
        return <ExceptionIcon sx={{ color: iconColor }} />;
      case 'error':
        return <ErrorIcon sx={{ color: iconColor }} />;
      case 'warning':
        return <WarningIcon sx={{ color: iconColor }} />;
      case 'info':
        return <InfoIcon sx={{ color: iconColor }} />;
      case 'success':
        return <SuccessIcon sx={{ color: iconColor }} />;
      case 'health':
      case 'system_monitoring':
        return <MonitorIcon sx={{ color: iconColor }} />;
      default:
        return <NotificationsIcon sx={{ color: iconColor }} />;
    }
  };

  const getNotificationColor = (level) => {
    switch (level) {
      case 'critical':
        return theme.palette.error.main;
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'info':
        return theme.palette.info.main;
      case 'success':
        return theme.palette.success.main;
      default:
        return theme.palette.grey[600];
    }
  };

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification);
    setDrawerOpen(true);
    // Note: fetchNotificationDetails in NotificationPanel will auto-mark as read
  };

  const handlePageChange = (event, newPage) => {
    changePage(newPage + 1); // API uses 1-based pages
  };

  const handleMarkAsRead = (notificationId, event) => {
    event.stopPropagation();
    markAsRead(notificationId);
  };

  const handleDelete = (notificationId, event) => {
    event.stopPropagation();
    deleteNotification(notificationId);
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getFilteredNotifications = () => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read_at);
    return notifications.filter(n => n.level === filter);
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  if (loading) {
    return (
      <Box className="notifications-container" sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        p: 3
      }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box className="notifications-container" sx={{
      p: { xs: 1, sm: 2, md: 3 },
      backgroundColor: '#f4f6f8',
      minHeight: '100%',
      position: 'relative'
    }}>
      {/* Header */}
      <Box className="notifications-header" sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 3,
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2, sm: 0 }
      }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsActiveIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          </Badge>
          <Box>
            <Typography variant="h4" component="h1" className="notifications-title">
              Notifications
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {totalCount} total {totalCount !== 1 ? 'notifications' : 'notification'}
            </Typography>
          </Box>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton onClick={refreshNotifications} color="primary" title="Refresh">
            <RefreshIcon />
          </IconButton>
          <Button
            startIcon={<TuneIcon />}
            variant={showAlertConfig ? 'contained' : 'outlined'}
            onClick={() => {
              if (!alertConfig && !alertConfigLoading) fetchAlertConfig();
              setShowAlertConfig(prev => !prev);
            }}
            size="small"
          >
            Alert Config
          </Button>
          <Button
            startIcon={<FilterIcon />}
            variant="outlined"
            onClick={() => {/* Filter logic */}}
            size="small"
          >
            Filter
          </Button>
        </Box>
      </Box>

      {/* Filter Chips */}
      <Box className="filter-chips" sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {['all', 'unread', 'critical', 'error', 'warning', 'info'].map((filterType) => (
          <Chip
            key={filterType}
            label={filterType === 'all' ? 'All' : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            onClick={() => setFilter(filterType)}
            color={filter === filterType ? 'primary' : 'default'}
            variant={filter === filterType ? 'filled' : 'outlined'}
            sx={{ textTransform: 'capitalize' }}
          />
        ))}
      </Box>

      {/* Alert Config Panel */}
      {showAlertConfig && (
        <Paper sx={{ mb: 3, p: 2 }} elevation={2}>
          <Typography variant="h6" sx={{ mb: 2 }}>Alert Thresholds Configuration</Typography>
          <AlertConfigPanel config={alertConfig} loading={alertConfigLoading} />
        </Paper>
      )}

      {error && (
        <Paper sx={{ p: 2, mb: 2, backgroundColor: 'error.lighter', color: 'error.dark' }}>
          <Typography color="inherit">
            Error loading notifications: {error}
          </Typography>
        </Paper>
      )}

      {/* Notifications List */}
      <Paper className="notifications-list" elevation={2}>
        {getFilteredNotifications().length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <NotificationsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No notifications found
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {filter === 'unread' ? 'All notifications have been read' : 'You\'re all caught up!'}
            </Typography>
          </Box>
        ) : (
          <>
            <List className="notifications-list-items">
              {getFilteredNotifications().map((notification, index) => (
                <React.Fragment key={notification.uuid}>
                  <ListItem
                    className={`notification-item ${!notification.read_at ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      cursor: 'pointer',
                      backgroundColor: !notification.read_at ? 'action.hover' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'action.selected',
                      },
                      borderLeft: `4px solid ${getNotificationColor(notification.level)}`,
                      position: 'relative',
                      py: 2
                    }}
                  >
                    <ListItemIcon>
                      <Avatar sx={{
                        backgroundColor: `${getNotificationColor(notification.level)}15`,
                        color: getNotificationColor(notification.level)
                      }}>
                        {getNotificationIcon(notification.type, notification.level)}
                      </Avatar>
                    </ListItemIcon>

                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                          <Typography variant="subtitle1" component="div" fontWeight="medium">
                            {notification.subject}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {formatTimeAgo(notification.created_at)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                            {notification.msg?.length > 100
                              ? `${notification.msg.substring(0, 100)}...`
                              : notification.msg}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                            <Chip
                              label={notification.type}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                            <Chip
                              label={notification.level}
                              size="small"
                              sx={{
                                backgroundColor: `${getNotificationColor(notification.level)}15`,
                                color: getNotificationColor(notification.level),
                                borderColor: getNotificationColor(notification.level)
                              }}
                            />
                            <Chip
                              label={notification.status || 'pending'}
                              size="small"
                              variant="outlined"
                              sx={{
                                textTransform: 'capitalize',
                                borderColor: notification.status === 'resolved' ? 'success.main' : 'warning.main',
                                color: notification.status === 'resolved' ? 'success.main' : 'warning.main'
                              }}
                            />
                            <Chip
                              label={`x${notification.count || 1}`}
                              size="small"
                              color="secondary"
                              title="Occurrence count"
                            />
                          </Box>
                        </Box>
                      }
                    />

                    <Box className="notification-actions" sx={{ ml: 1 }}>
                      {!notification.read_at && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleMarkAsRead(notification.uuid, e)}
                          color="primary"
                        >
                          <MarkReadIcon />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={(e) => handleDelete(notification.uuid, e)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </ListItem>

                  {index < getFilteredNotifications().length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>

            {/* Pagination */}
            {totalCount > perPage && (
              <TablePagination
                component="div"
                count={totalCount}
                page={currentPage - 1}
                onPageChange={handlePageChange}
                rowsPerPage={perPage}
                rowsPerPageOptions={[100]}
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}-${to} of ${count}`
                }
              />
            )}
          </>
        )}
      </Paper>

      {/* Side Panel */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 500 },
            maxWidth: '90vw'
          }
        }}
      >
        <NotificationPanel
          notification={selectedNotification}
          onClose={() => setDrawerOpen(false)}
          onMarkAsRead={markAsRead}
          onDelete={deleteNotification}
          fetchNotificationDetails={fetchNotificationDetails}
        />
      </Drawer>
    </Box>
  );
};

export default Notifications;