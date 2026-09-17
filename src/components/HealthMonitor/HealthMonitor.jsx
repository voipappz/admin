import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  LinearProgress,
  Alert,
  CircularProgress,
  Tooltip,
  Collapse
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Cancel as ErrorIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon
} from '@mui/icons-material';
import { useState } from 'react';
import { useHealthMonitor } from './HealthMonitor.js';
import StatusCard from './StatusCard/StatusCard.jsx';
import MonitorDialog from './MonitorDialog/MonitorDialog.jsx';
import { getStatusColor } from '../../services/api/monitorsApi';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * HealthMonitor Component
 * Main dashboard for monitoring services - Kuma Mieru style
 */
const HealthMonitor = () => {
  const { can } = usePermissions();
  const canWrite = can('monitors', 'write');
  const {
    monitors,
    timeseriesData,
    timeseriesLoading,
    overallStatus,
    loading,
    error,
    autoRefresh,
    toggleAutoRefresh,
    countdown,
    lastRefresh,
    refresh,
    dialogOpen,
    selectedMonitor,
    dialogLoading,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseDialog,
    handleSaveMonitor
  } = useHealthMonitor();

  const [eventsExpanded, setEventsExpanded] = useState(true);

  // Get overall status banner config
  const getStatusBanner = () => {
    const { status, upCount, totalCount } = overallStatus;

    if (totalCount === 0) {
      return {
        color: 'var(--mui-palette-text-primary)',
        bgColor: '#1f2937',
        icon: <WarningIcon />,
        text: 'No monitors configured'
      };
    }

    if (status === 'up') {
      return {
        color: '#22c55e',
        bgColor: 'rgba(34, 197, 94, 0.15)',
        icon: <CheckIcon />,
        text: `All systems operational (${upCount}/${totalCount})`
      };
    }

    if (status === 'partial') {
      return {
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        icon: <WarningIcon />,
        text: `Partial service degradation detected (${upCount}/${totalCount})`
      };
    }

    return {
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.15)',
      icon: <ErrorIcon />,
      text: `Major outage detected (${upCount}/${totalCount})`
    };
  };

  const statusBanner = getStatusBanner();

  // Get recent incidents (monitors that are down or were recently down)
  const getRecentIncidents = () => {
    return monitors.filter(m => m.status === 'down' || m.status === 'pending');
  };

  const incidents = getRecentIncidents();

  return (
    <Box
      sx={{
        minHeight: '100%',
        backgroundColor: '#0f172a',
        color: '#fff',
        p: { xs: 2, md: 3 }
      }}
    >
      {/* Header with refresh controls */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" fontWeight={600}>
            Health Monitor
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {canWrite && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreate}
                sx={{
                  backgroundColor: '#22c55e',
                  '&:hover': { backgroundColor: '#16a34a' }
                }}
              >
                Add Monitor
              </Button>
            )}
          </Box>
        </Box>

        {/* Auto-refresh bar */}
        <Paper
          sx={{
            backgroundColor: '#1e293b',
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={autoRefresh ? ((30 - countdown) / 30) * 100 : 0}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: '#374151',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#3b82f6',
                  borderRadius: 3
                }
              }}
            />
          </Box>

          <Typography variant="body2" sx={{ color: 'var(--mui-palette-text-secondary)', minWidth: 180 }}>
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </Typography>

          <Typography variant="body2" sx={{ color: 'var(--mui-palette-text-secondary)', minWidth: 130 }}>
            {autoRefresh ? `Refresh in ${countdown}s` : 'Auto-refresh paused'}
          </Typography>

          <Tooltip title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}>
            <Button
              variant="outlined"
              size="small"
              startIcon={autoRefresh ? <PauseIcon /> : <PlayIcon />}
              onClick={toggleAutoRefresh}
              sx={{
                color: '#fff',
                borderColor: '#374151',
                '&:hover': { borderColor: '#4b5563' }
              }}
            >
              {autoRefresh ? 'Pause' : 'Resume'}
            </Button>
          </Tooltip>

          <Tooltip title="Refresh now">
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={refresh}
              disabled={loading}
              sx={{
                color: '#fff',
                borderColor: '#374151',
                '&:hover': { borderColor: '#4b5563' }
              }}
            >
              Refresh now
            </Button>
          </Tooltip>
        </Paper>
      </Box>

      {/* Overall Status Banner */}
      <Paper
        sx={{
          backgroundColor: statusBanner.bgColor,
          border: `1px solid ${statusBanner.color}`,
          borderRadius: 2,
          p: 2,
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}
      >
        <Box sx={{ color: statusBanner.color }}>
          {statusBanner.icon}
        </Box>
        <Typography variant="h6" sx={{ color: statusBanner.color }}>
          {statusBanner.text}
        </Typography>
      </Paper>

      {/* Incidents/Events Section */}
      {incidents.length > 0 && (
        <Paper
          sx={{
            backgroundColor: '#1e293b',
            borderRadius: 2,
            mb: 3,
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#334155' }
            }}
            onClick={() => setEventsExpanded(!eventsExpanded)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon sx={{ color: '#f59e0b' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Active Incidents ({incidents.length})
              </Typography>
            </Box>
            <IconButton size="small" sx={{ color: 'var(--mui-palette-text-secondary)' }}>
              {eventsExpanded ? <CollapseIcon /> : <ExpandIcon />}
            </IconButton>
          </Box>

          <Collapse in={eventsExpanded}>
            <Box sx={{ borderTop: '1px solid #374151' }}>
              {incidents.map(incident => (
                <Box
                  key={incident.uuid}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    borderBottom: '1px solid #374151',
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { backgroundColor: '#334155' }
                  }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(incident.status)
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {incident.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--mui-palette-text-secondary)' }}>
                      {incident.notes || `Status: ${incident.status}`}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'var(--mui-palette-text-secondary)' }}>
                    {incident.last_check ? new Date(incident.last_check).toLocaleTimeString() : '--'}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3, backgroundColor: '#7f1d1d', color: '#fff' }}
          onClose={() => {}}
        >
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && monitors.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#22c55e' }} />
        </Box>
      )}

      {/* Empty State */}
      {!loading && monitors.length === 0 && (
        <Paper
          sx={{
            backgroundColor: '#1e293b',
            p: 6,
            textAlign: 'center',
            borderRadius: 2
          }}
        >
          <Typography variant="h6" sx={{ color: 'var(--mui-palette-text-secondary)', mb: 2 }}>
            No monitors configured
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--mui-palette-text-secondary)', mb: 3 }}>
            Create your first monitor to start tracking service health
          </Typography>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
              sx={{
                backgroundColor: '#22c55e',
                '&:hover': { backgroundColor: '#16a34a' }
              }}
            >
              Add Monitor
            </Button>
          )}
        </Paper>
      )}

      {/* Monitors Section */}
      {monitors.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: '#fff' }}>
            Monitors
          </Typography>

          {/* Status Cards Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)'
              },
              gap: 3
            }}
          >
            {monitors.map(monitor => (
              <StatusCard
                key={monitor.uuid}
                monitor={monitor}
                timeseries={timeseriesData[monitor.uuid] || []}
                loading={timeseriesLoading[monitor.uuid]}
                onClick={() => handleOpenEdit(monitor)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Monitor Dialog */}
      <MonitorDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveMonitor}
        monitor={selectedMonitor}
        loading={dialogLoading}
        canWrite={canWrite}
      />
    </Box>
  );
};

export default HealthMonitor;
