import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Tooltip,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cancel as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Build as MaintenanceIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip
} from 'recharts';
import { getStatusColor } from '../../../services/api/monitorsApi';

/**
 * StatusCard Component
 * Displays a single monitor status in Kuma-Mieru style
 */
const StatusCard = ({
  monitor,
  timeseries = [],
  loading = false,
  onClick
}) => {
  const [timeRange, setTimeRange] = useState('50');

  // Filter timeseries based on selected range
  const getFilteredTimeseries = () => {
    const count = parseInt(timeRange, 10);
    if (!timeseries || timeseries.length === 0) return [];
    return timeseries.slice(-count);
  };

  const filteredData = getFilteredTimeseries();

  // Calculate uptime from timeseries
  const calculateUptime = () => {
    if (!filteredData || filteredData.length === 0) return 100;
    const upCount = filteredData.filter(p => p.status === 'up').length;
    return Math.round((upCount / filteredData.length) * 10000) / 100;
  };

  // Calculate stats
  const calculateStats = () => {
    if (!filteredData || filteredData.length === 0) {
      return { lt: '--', avg: '--', ta: '--' };
    }

    const responseTimes = filteredData
      .filter(p => p.response_time !== undefined && p.response_time !== null)
      .map(p => p.response_time);

    if (responseTimes.length === 0) {
      return { lt: '--', avg: '--', ta: '--' };
    }

    const lt = responseTimes[responseTimes.length - 1]; // Latest
    const avg = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
    const ta = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length); // Total average

    return {
      lt: `${lt} ms`,
      avg: `${avg} ms`,
      ta: `${ta} ms`
    };
  };

  const uptime = calculateUptime();
  const stats = calculateStats();
  const statusColor = getStatusColor(monitor?.status);

  // Get status icon
  const getStatusIcon = () => {
    switch (monitor?.status) {
      case 'up':
        return <CheckIcon sx={{ color: statusColor, fontSize: 20 }} />;
      case 'down':
        return <ErrorIcon sx={{ color: statusColor, fontSize: 20 }} />;
      case 'pending':
        return <PendingIcon sx={{ color: statusColor, fontSize: 20 }} />;
      case 'maintenance':
        return <MaintenanceIcon sx={{ color: statusColor, fontSize: 20 }} />;
      default:
        return <PendingIcon sx={{ color: statusColor, fontSize: 20 }} />;
    }
  };

  // Generate uptime bar segments
  const renderUptimeBar = () => {
    const segments = filteredData.slice(-90); // Last 90 points max
    if (segments.length === 0) {
      return (
        <Box sx={{ display: 'flex', gap: '1px', height: 20, alignItems: 'center' }}>
          {Array(30).fill(null).map((_, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: 16,
                backgroundColor: '#374151',
                borderRadius: '2px'
              }}
            />
          ))}
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', gap: '1px', height: 20, alignItems: 'center' }}>
        {segments.map((point, i) => (
          <Tooltip
            key={i}
            title={`${point.timestamp}: ${point.status}`}
            arrow
            placement="top"
          >
            <Box
              sx={{
                flex: 1,
                height: 16,
                backgroundColor: getStatusColor(point.status),
                borderRadius: '2px',
                minWidth: 3,
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8
                }
              }}
            />
          </Tooltip>
        ))}
      </Box>
    );
  };

  // Format chart data
  const chartData = filteredData.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    value: point.response_time || 0,
    status: point.status
  }));

  return (
    <Paper
      elevation={2}
      onClick={onClick}
      sx={{
        p: 2,
        backgroundColor: '#1e293b',
        color: '#fff',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4
        }
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getStatusIcon()}
          <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ maxWidth: 180 }}>
            {monitor?.name || 'Unnamed Monitor'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Uptime Circle */}
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress
              variant="determinate"
              value={uptime}
              size={40}
              thickness={4}
              sx={{
                color: statusColor,
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round'
                }
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>
                {uptime}%
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Tags */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Chip
          label={monitor?.query_type || 'sql'}
          size="small"
          sx={{
            backgroundColor: '#0891b2',
            color: '#fff',
            fontSize: '0.65rem',
            height: 20
          }}
        />
        {monitor?.interval && (
          <Chip
            label={`Every ${monitor.interval}s`}
            size="small"
            sx={{
              backgroundColor: '#0891b2',
              color: '#fff',
              fontSize: '0.65rem',
              height: 20
            }}
          />
        )}
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: 'var(--mui-palette-text-secondary)' }}>
          LT: <span style={{ color: '#fff' }}>{stats.lt}</span>
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--mui-palette-text-secondary)' }}>
          AVG: <span style={{ color: '#fff' }}>{stats.avg}</span>
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e' }} />
          <Typography variant="caption" sx={{ color: 'var(--mui-palette-text-secondary)', fontSize: '0.6rem' }}>Online</Typography>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b', ml: 0.5 }} />
          <Typography variant="caption" sx={{ color: 'var(--mui-palette-text-secondary)', fontSize: '0.6rem' }}>Maint.</Typography>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444', ml: 0.5 }} />
          <Typography variant="caption" sx={{ color: 'var(--mui-palette-text-secondary)', fontSize: '0.6rem' }}>Offline</Typography>
        </Box>
      </Box>

      {/* Uptime Bar */}
      <Box sx={{ mb: 1.5 }}>
        {renderUptimeBar()}
      </Box>

      {/* Time Range Toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={(e, val) => val && setTimeRange(val)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              color: 'var(--mui-palette-text-secondary)',
              borderColor: '#374151',
              fontSize: '0.65rem',
              py: 0.25,
              px: 1,
              '&.Mui-selected': {
                backgroundColor: '#374151',
                color: '#fff'
              }
            }
          }}
        >
          <ToggleButton value="50">Last 50</ToggleButton>
          <ToggleButton value="25">Last 25</ToggleButton>
          <ToggleButton value="10">Last 10</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Response Time Chart */}
      <Box sx={{ height: 80, mt: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={20} sx={{ color: '#22c55e' }} />
          </Box>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="time"
                tick={{ fill: '#64748b', fontSize: 9 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 9 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                width={35}
                tickFormatter={(val) => `${val}ms`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #374151',
                  borderRadius: 4,
                  fontSize: 11
                }}
                labelStyle={{ color: 'var(--mui-palette-text-secondary)' }}
                formatter={(value) => [`${value} ms`, 'Response']}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: '#22c55e' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography variant="caption" sx={{ color: 'var(--mui-palette-text-secondary)' }}>
              No data available
            </Typography>
          </Box>
        )}
      </Box>

      {/* Current Value */}
      {monitor?.last_value !== undefined && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #374151' }}>
          <Typography variant="caption" sx={{ color: 'var(--mui-palette-text-secondary)' }}>
            Current: <span style={{ color: '#fff', fontWeight: 600 }}>{monitor.last_value}</span>
            {monitor?.threshold && (
              <span style={{ color: 'var(--mui-palette-text-secondary)' }}>
                {' '}(threshold: {monitor.operator === 'lt' ? '<' : monitor.operator === 'gt' ? '>' : '='} {monitor.threshold})
              </span>
            )}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default StatusCard;
