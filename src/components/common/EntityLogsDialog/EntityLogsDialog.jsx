import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Paper,
  TextField,
  Chip,
  Typography,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Switch,
  Tooltip,
  Button,
  Divider,
  ButtonGroup,
  FormControl,
  Select,
  MenuItem,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Terminal as TerminalIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import TablePagination from '@mui/material/TablePagination';
import TimeHistogram from '../../../views/syslogs/TimeHistogram';
import RawLogViewer from '../../../views/syslogs/RawLogViewer';
import { apiService } from '../../../services/apiService';

/**
 * EntityLogsDialog Component
 *
 * A reusable, full-featured logs viewer that works with any entity type.
 * Uses syslog-style design with time histogram, search, filters, and live refresh.
 *
 * Fetches from /api/logs/ endpoint with subject and subject_uuid parameters.
 *
 * @param {boolean} open - Whether the dialog is open
 * @param {Function} onClose - Handler to close the dialog
 * @param {Object} entity - The entity object (must have uuid/id and optionally name)
 * @param {string} entityType - Type of entity: 'subscription', 'call', 'message', 'user', etc.
 * @param {string} title - Optional custom title (defaults to "{EntityType} Logs: {entity.name}")
 */
const EntityLogsDialog = ({
  open,
  onClose,
  entity,
  entityType = 'entity',
  title: customTitle
}) => {
  // State management
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 25,
  });

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [timeInterval, setTimeInterval] = useState('minute');
  const [clientFilters, setClientFilters] = useState({
    facility: '',
    severity: '',
    host: '',  // actor
    app: '',   // type
    session: '',
    tag: ''
  });

  // Local date range for UI (with period tracking)
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      start: new Date(now.getTime() - (1 * 60 * 60 * 1000)), // 1 hour ago
      end: new Date(now),
      period: '1h'
    };
  });

  // Compute dialog title
  const dialogTitle = useMemo(() => {
    if (customTitle) return customTitle;
    const entityName = entity?.name || entity?.caller_number || entity?.destination_number || entity?.uuid || '';
    const typeName = entityType.charAt(0).toUpperCase() + entityType.slice(1);
    return `${typeName} Logs: ${entityName}`;
  }, [customTitle, entity, entityType]);

  // Load logs function
  const loadLogs = async () => {
    const entityId = entity?.uuid || entity?.id;
    if (!entityId) return;

    try {
      setLoading(true);

      // Build query string using the logs API pattern
      const queryString = new URLSearchParams();

      // Add basic params
      queryString.append('page', pagination.page + 1);
      queryString.append('per_page', pagination.limit);

      // Filter by entity type as subject
      queryString.append('subject', entityType);
      queryString.append('subject_uuid', entityId);
      queryString.append('alert', ''); // Required parameter

      // Add date range
      if (dateRange.start && dateRange.end) {
        const fromTimestamp = Math.floor(dateRange.start.getTime() / 1000);
        const toTimestamp = Math.floor(dateRange.end.getTime() / 1000);
        queryString.append('from', fromTimestamp);
        queryString.append('to', toTimestamp);
      }

      // Add search query
      if (clientSearch) {
        queryString.append('search', clientSearch);
      }

      const url = `/api/logs/?${queryString.toString()}`;
      const response = await apiService.get(url, {}, `fetching ${entityType} logs`, false);

      // Handle logs API response format and adapt to syslog format
      let logsData = [];
      let total = 0;

      if (Array.isArray(response)) {
        logsData = response;
        total = response.length;
      } else if (response?.data) {
        logsData = Array.isArray(response.data) ? response.data : response.data.data || response.data.logs || [];
        total = response.data.total || response.total || response.total_records || logsData.length;
      } else if (response && typeof response === 'object') {
        logsData = response.logs || response.items || response.data || [];
        total = response.total_records || response.total || response.count || logsData.length;
      }

      // Adapt logs API format to viewer format
      // API fields: msg, type, time, actor, level, tags, session
      const adaptedLogs = logsData.map(log => ({
        ...log,
        // Map level to severity
        severity: log.level || log.severity || 'info',
        // Map msg to message
        message: log.msg || log.message || log.description || '',
        // Time field
        time: log.time || log.timestamp || log.created_at,
        // Map actor to host (who performed the action)
        host: log.actor || log.host || log.subject || '-',
        // Map type to app
        app: log.type || log.app || log.action || '-',
        // Facility defaults to entity type
        facility: log.facility || entityType,
        // Keep tags and session for filtering
        tags: log.tags || [],
        session: log.session || '-',
      }));

      setLogs(adaptedLogs);
      setTotalCount(total);
    } catch (error) {
      console.error(`Failed to load ${entityType} logs:`, error);
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Load logs when dialog opens or filters change
  useEffect(() => {
    if (open && entity) {
      loadLogs();
    }
  }, [open, entity, pagination, dateRange, clientSearch]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && open) {
      const interval = setInterval(() => {
        loadLogs();
      }, 5000);
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh, open]);

  // Clean ANSI escape codes from messages
  const cleanAnsiCodes = (text) => {
    if (!text) return '';
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  };

  // Client-side filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search filter
      if (clientSearch) {
        const searchLower = clientSearch.toLowerCase();
        const cleanMessage = cleanAnsiCodes(log.message || '').toLowerCase();
        const searchFields = [
          cleanMessage,
          log.host || '',
          log.app || '',
          log.facility || '',
          log.severity || '',
          log.session || '',
          Array.isArray(log.tags) ? log.tags.join(' ') : ''
        ].join(' ').toLowerCase();

        if (!searchFields.includes(searchLower)) {
          return false;
        }
      }

      // Field filters
      if (clientFilters.facility && log.facility !== clientFilters.facility) {
        return false;
      }
      if (clientFilters.severity && log.severity !== clientFilters.severity) {
        return false;
      }
      if (clientFilters.host && log.host !== clientFilters.host) {
        return false;
      }
      if (clientFilters.app && log.app !== clientFilters.app) {
        return false;
      }
      if (clientFilters.session && log.session !== clientFilters.session) {
        return false;
      }
      if (clientFilters.tag) {
        const tags = Array.isArray(log.tags) ? log.tags : [];
        if (!tags.includes(clientFilters.tag)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, clientSearch, clientFilters]);

  // Get unique values for filter dropdowns
  const uniqueValues = useMemo(() => {
    // Collect all unique tags from all logs
    const allTags = new Set();
    logs.forEach(log => {
      if (Array.isArray(log.tags)) {
        log.tags.forEach(tag => allTags.add(tag));
      }
    });

    return {
      facilities: [...new Set(logs.map(log => log.facility).filter(Boolean))].sort(),
      severities: [...new Set(logs.map(log => log.severity).filter(Boolean))].sort(),
      hosts: [...new Set(logs.map(log => log.host).filter(Boolean))].sort(),
      apps: [...new Set(logs.map(log => log.app).filter(Boolean))].sort(),
      sessions: [...new Set(logs.map(log => log.session).filter(s => s && s !== '-'))].sort(),
      tags: [...allTags].filter(Boolean).sort()
    };
  }, [logs]);

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleChangeRowsPerPage = (event) => {
    setPagination({ page: 0, limit: parseInt(event.target.value, 10) });
  };

  // Period quick select handler
  const handlePeriodSelect = (period) => {
    const now = new Date();
    let start;
    switch(period) {
      case '15m':
        start = new Date(now.getTime() - (15 * 60 * 1000));
        break;
      case '1h':
        start = new Date(now.getTime() - (60 * 60 * 1000));
        break;
      case '3h':
        start = new Date(now.getTime() - (3 * 60 * 60 * 1000));
        break;
      case '6h':
        start = new Date(now.getTime() - (6 * 60 * 60 * 1000));
        break;
      case '24h':
        start = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        break;
      case '7d':
        start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      default:
        start = new Date(now.getTime() - (60 * 60 * 1000));
    }
    setDateRange({ start, end: now, period });
  };

  // Reset state when dialog closes
  const handleClose = () => {
    setAutoRefresh(false);
    setClientSearch('');
    setClientFilters({ facility: '', severity: '', host: '', app: '', session: '', tag: '' });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { height: '90vh', display: 'flex', flexDirection: 'column' }
      }}
    >
      <DialogTitle sx={{
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pb: 1.5
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TerminalIcon color="primary" />
          <Typography variant="h6">
            {dialogTitle}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1, overflow: 'hidden' }}>
        {/* Top Toolbar - Filters */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            bgcolor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 1,
            flexShrink: 0
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {/* Date Range Quick Select */}
            <ButtonGroup size="small" variant="outlined">
              {[
                { label: '15m', value: '15m' },
                { label: '1h', value: '1h' },
                { label: '3h', value: '3h' },
                { label: '6h', value: '6h' },
                { label: '24h', value: '24h' },
                { label: '7d', value: '7d' }
              ].map((opt) => (
                <Button
                  key={opt.value}
                  onClick={() => handlePeriodSelect(opt.value)}
                  variant={dateRange?.period === opt.value ? 'contained' : 'outlined'}
                  sx={{ minWidth: 40, px: 1, fontSize: '12px' }}
                >
                  {opt.label}
                </Button>
              ))}
            </ButtonGroup>

            {/* Custom Date Range */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DatePicker
                  value={dateRange?.start || new Date()}
                  onChange={(date) => setDateRange(prev => ({ ...prev, start: date, period: 'custom' }))}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { width: 140, '& input': { fontSize: '12px', py: 0.75 } }
                    }
                  }}
                />
                <Typography variant="caption" color="text.secondary">to</Typography>
                <DatePicker
                  value={dateRange?.end || new Date()}
                  onChange={(date) => setDateRange(prev => ({ ...prev, end: date, period: 'custom' }))}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { width: 140, '& input': { fontSize: '12px', py: 0.75 } }
                    }
                  }}
                />
              </Box>
            </LocalizationProvider>

            {/* Divider */}
            <Divider orientation="vertical" flexItem />

            {/* Search */}
            <TextField
              size="small"
              placeholder="Search logs..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: clientSearch && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setClientSearch('')}>
                      <ClearIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ width: 250, '& input': { fontSize: '13px' } }}
            />

            {/* Filter Dropdowns */}
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={clientFilters.severity}
                onChange={(e) => setClientFilters(prev => ({ ...prev, severity: e.target.value }))}
                displayEmpty
                sx={{ fontSize: '12px' }}
              >
                <MenuItem value=""><em>All Levels</em></MenuItem>
                {uniqueValues.severities.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 90 }}>
              <Select
                value={clientFilters.app}
                onChange={(e) => setClientFilters(prev => ({ ...prev, app: e.target.value }))}
                displayEmpty
                sx={{ fontSize: '12px' }}
              >
                <MenuItem value=""><em>All Types</em></MenuItem>
                {uniqueValues.apps.map((a) => (
                  <MenuItem key={a} value={a}>{a}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {uniqueValues.sessions.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={clientFilters.session}
                  onChange={(e) => setClientFilters(prev => ({ ...prev, session: e.target.value }))}
                  displayEmpty
                  sx={{ fontSize: '12px' }}
                >
                  <MenuItem value=""><em>All Sessions</em></MenuItem>
                  {uniqueValues.sessions.map((s) => (
                    <MenuItem key={s} value={s}>{s.length > 12 ? `${s.slice(0, 12)}...` : s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {uniqueValues.tags.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 90 }}>
                <Select
                  value={clientFilters.tag}
                  onChange={(e) => setClientFilters(prev => ({ ...prev, tag: e.target.value }))}
                  displayEmpty
                  sx={{ fontSize: '12px' }}
                >
                  <MenuItem value=""><em>All Tags</em></MenuItem>
                  {uniqueValues.tags.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Spacer */}
            <Box sx={{ flexGrow: 1 }} />

            {/* Live Toggle & Refresh */}
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {autoRefresh ? (
                    <PlayIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  ) : (
                    <PauseIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  )}
                  <Typography variant="caption">Live</Typography>
                </Box>
              }
              sx={{ m: 0 }}
            />

            <Tooltip title="Refresh">
              <IconButton onClick={loadLogs} disabled={loading} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Log Count */}
            <Chip
              label={`${filteredLogs.length} / ${totalCount}`}
              size="small"
              sx={{ fontFamily: 'monospace', fontSize: '11px' }}
            />
          </Box>
        </Paper>

        {/* Time Histogram */}
        <Box sx={{ flexShrink: 0 }}>
          <TimeHistogram
            logs={filteredLogs}
            height={100}
            timeInterval={timeInterval}
          />
        </Box>

        {/* Main Log Viewer */}
        <Paper
          elevation={0}
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            border: '1px solid #e5e7eb',
            borderRadius: 1,
            overflow: 'hidden'
          }}
        >
          {/* Compact Header */}
          <Box sx={{
            px: 2,
            py: 0.5,
            bgcolor: '#f8fafc',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TerminalIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontFamily: 'monospace' }}>
                Log Output
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={timeInterval}
                onChange={(e) => setTimeInterval(e.target.value)}
                sx={{ fontSize: '11px', '& .MuiSelect-select': { py: 0.25, px: 1 } }}
              >
                <MenuItem value="minute">/ min</MenuItem>
                <MenuItem value="hour">/ hour</MenuItem>
                <MenuItem value="day">/ day</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Raw Log Viewer */}
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            {loading && logs.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
              </Box>
            ) : (
              <RawLogViewer
                logs={filteredLogs}
                autoScroll={autoRefresh}
                showLineNumbers={true}
              />
            )}
          </Box>

          {/* Pagination Controls */}
          <Box sx={{
            borderTop: '1px solid #e5e7eb',
            bgcolor: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}>
            <TablePagination
              component="div"
              count={totalCount}
              page={pagination.page}
              onPageChange={handleChangePage}
              rowsPerPage={pagination.limit}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[25, 50, 100, 200, 500]}
              labelRowsPerPage="Logs per page:"
              sx={{
                '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                  fontSize: '12px',
                  fontFamily: 'monospace'
                },
                '.MuiTablePagination-select': {
                  fontSize: '12px'
                }
              }}
            />
          </Box>
        </Paper>
      </DialogContent>
    </Dialog>
  );
};

EntityLogsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  entity: PropTypes.shape({
    uuid: PropTypes.string,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    caller_number: PropTypes.string,
    destination_number: PropTypes.string,
  }),
  entityType: PropTypes.string,
  title: PropTypes.string,
};

export default EntityLogsDialog;
