import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
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
  Alert,
  Button,
  Divider,
  ButtonGroup,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  FilterAltOff as FilterAltOffIcon,
  FiberManualRecord as DotIcon,
  Download as DownloadIcon,
  ContentCopy as ContentCopyIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useSystemLogs } from './SystemLogs';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import { stripedDataGridSx } from '../../components/shared/tableTheme.jsx';
import TimeHistogram from './TimeHistogram';
import CustomFooter from '../../components/Calls/CustomFooter/CustomFooter.jsx';
import {
  LEVEL_CONFIG,
  AUTO_REFRESH_OPTIONS,
  convertAggregateToHistogramFormat,
  normalizeSeverityKey,
  getSeverityChipColors,
  formatRelative,
  formatAbsolute,
  PERIOD_OPTIONS,
  SEVERITY_ORDER,
} from '../../utils/logFormatting';

const TOTAL_PILL = { color: '#0f172a', bg: '#f1f5f9' };

const METRICS_PILLS = [
  { key: 'total', label: 'TOTAL' },
  { key: 'crit',  label: 'CRIT' },
  { key: 'error', label: 'ERROR' },
  { key: 'warn',  label: 'WARN' },
  { key: 'info',  label: 'INFO' },
  { key: 'debug', label: 'DEBUG' },
  { key: 'trace', label: 'TRACE' },
];

const parseLogFields = (message = '') => {
  const fields = {};
  String(message).replace(/(?:^|\s)([a-zA-Z_][\w.-]*)=([^\s]*)/g, (_match, key, value) => {
    fields[key] = value;
    return _match;
  });
  return fields;
};

// Main SystemLogs component
const SystemLogs = ({ initialParams }) => {
  const { selectedCustomer } = useCustomerEnvironment();
  const {
    logs,
    loading,
    totalCount,
    pagination,
    setPagination,

    apps,
    nodes,

    searchQuery,
    setSearchQuery,
    selectedApp,
    setSelectedApp,
    selectedHost,
    setSelectedHost,
    selectedSeverity,
    setSelectedSeverity,
    selectedAction,
    setSelectedAction,
    groupBy,
    setGroupBy,

    dateRange,
    setDateRange,
    handlePeriodSelect,

    chartAggregation,
    chartInterval,

    autoRefreshInterval,
    setAutoRefreshInterval,

    refreshLogs,
    clearFilters,
    hasActiveFilters,

    enableTrace,
    disableTrace,
    getTraceStatus,
    enableConsole,
    disableConsole,
    getConsoleStatus,
    alerts,
  } = useSystemLogs({ customerUuid: selectedCustomer?.uuid, initialParams });

  const [traceEnabled, setTraceEnabled] = useState(false);
  const [consoleEnabled, setConsoleEnabled] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const selectedFields = useMemo(
    () => selectedLog?.fields || parseLogFields(selectedLog?.message || selectedLog?.msg),
    [selectedLog]
  );

  // Check trace + console status on mount
  useEffect(() => {
    const checkTraceStatus = async () => {
      const isEnabled = await getTraceStatus();
      setTraceEnabled(isEnabled);
    };
    checkTraceStatus();
  }, [getTraceStatus]);

  useEffect(() => {
    const checkConsoleStatus = async () => {
      const isEnabled = await getConsoleStatus();
      setConsoleEnabled(isEnabled);
    };
    checkConsoleStatus();
  }, [getConsoleStatus]);

  // Debounced search
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const searchTimerRef = useRef(null);

  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalSearch(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        setSearchQuery(value);
      }, 300);
    },
    [setSearchQuery]
  );

  const handleClearSearch = useCallback(() => {
    setLocalSearch('');
    setSearchQuery('');
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, [setSearchQuery]);

  useEffect(() => () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  // Export handler
  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syslogs-export-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  // Clear-all handler — keeps the TextField in sync
  const handleClearFilters = useCallback(() => {
    clearFilters();
    setLocalSearch('');
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, [clearFilters]);

  // Trace toggle handler
  const handleTraceToggle = useCallback(
    async (e) => {
      const enabled = e.target.checked;
      if (enabled) {
        await enableTrace();
      } else {
        await disableTrace();
      }
      setTraceEnabled(enabled);
    },
    [enableTrace, disableTrace]
  );

  // Console mode toggle handler (console! — errors also captured to syslog)
  const handleConsoleToggle = useCallback(
    async (e) => {
      const enabled = e.target.checked;
      if (enabled) {
        await enableConsole();
      } else {
        await disableConsole();
      }
      setConsoleEnabled(enabled);
    },
    [enableConsole, disableConsole]
  );

  // Transform server aggregate shape to TimeHistogram's expected format
  const histogramBuckets = useMemo(
    () => convertAggregateToHistogramFormat(chartAggregation),
    [chartAggregation]
  );

  // Metrics derived from the full time-range aggregation (not just visible page)
  const metrics = useMemo(() => {
    const tally = { total: 0, crit: 0, error: 0, warn: 0, info: 0, debug: 0, trace: 0 };
    histogramBuckets.forEach((b) => {
      tally.total += b.total;
      Object.entries(b.severities).forEach(([sev, n]) => {
        const k = normalizeSeverityKey(sev);
        if (tally[k] !== undefined) tally[k] += n;
      });
    });
    return tally;
  }, [histogramBuckets]);

  const handleMetricClick = useCallback(
    (key) => {
      if (key === 'total') {
        setSelectedSeverity('');
        return;
      }
      setSelectedSeverity((prev) => (prev === key ? '' : key));
    },
    [setSelectedSeverity]
  );

  // DataGrid rows — `id` is required by DataGrid
  const gridRows = useMemo(
    () => logs.map((log, index) => ({ ...log, id: log.uuid || log.id || index })),
    [logs]
  );

  // DataGrid columns use only the stable Syslog fields. Values embedded in the
  // message are shown in the details dialog instead of pretending to be columns.
  // the Events grid so the two log screens look identical.
  const gridColumns = useMemo(() => [
    {
      field: 'time',
      headerName: 'TIME',
      width: 110,
      sortable: false,
      renderCell: (params) => {
        const t = params.row.time || params.row.timestamp || params.row.isodate;
        return (
          <Tooltip title={formatAbsolute(t)} placement="top">
            <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
              {formatRelative(t)}
            </Typography>
          </Tooltip>
        );
      },
    },
    {
      field: 'severity',
      headerName: 'LEVEL',
      width: 84,
      sortable: false,
      renderCell: (params) => {
        const level = (params.value || params.row.level || 'info').toLowerCase();
        const sev = getSeverityChipColors(level);
        return (
          <Chip
            label={level.toUpperCase()}
            size="small"
            sx={{ fontWeight: 700, fontSize: '0.6rem', height: 20, minWidth: 52, color: sev.text, bgcolor: sev.bg, border: `1px solid ${sev.text}30` }}
          />
        );
      },
    },
    {
      field: 'host',
      headerName: 'SERVER',
      width: 150,
      sortable: false,
      renderCell: (params) => {
        const host = params.value;
        if (!host || host === '-') return <Typography variant="caption" sx={{ color: '#cbd5e1' }}>—</Typography>;
        const isFiltered = selectedHost === host;
        return (
          <Tooltip title={`Filter by ${host}`}>
            <Typography
              variant="body2"
              onClick={(e) => { e.stopPropagation(); setSelectedHost((prev) => (prev === host ? '' : host)); }}
              sx={{ fontSize: '0.72rem', color: isFiltered ? '#0f766e' : '#0f766e', fontWeight: isFiltered ? 700 : 500, cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
            >
              {host}
            </Typography>
          </Tooltip>
        );
      },
    },
    {
      field: 'app',
      headerName: 'SOURCE',
      width: 140,
      sortable: false,
      renderCell: (params) => {
        const app = params.value || params.row.type;
        if (!app || app === '-') return null;
        const isFiltered = selectedApp === app;
        return (
          <Chip
            label={app}
            size="small"
            variant={isFiltered ? 'filled' : 'outlined'}
            onClick={(e) => { e.stopPropagation(); setSelectedApp((prev) => (prev === app ? '' : app)); }}
            sx={{ fontSize: '0.6rem', height: 20, cursor: 'pointer', bgcolor: isFiltered ? '#3b82f6' : undefined, color: isFiltered ? '#fff' : undefined, borderColor: isFiltered ? '#3b82f6' : undefined, '&:hover': { bgcolor: isFiltered ? '#2563eb' : '#f0f9ff' } }}
          />
        );
      },
    },
    {
      field: 'facility',
      headerName: 'FACILITY',
      width: 100,
      sortable: false,
      renderCell: (params) =>
        params.value && params.value !== '-' ? (
          <Typography variant="body2" sx={{ fontSize: '0.72rem', color: '#6d28d9', fontWeight: 600, fontFamily: '"JetBrains Mono", monospace' }}>
            {params.value}
          </Typography>
        ) : null,
    },
    {
      field: 'action',
      headerName: 'EVENT TYPE',
      width: 145,
      sortable: false,
      renderCell: (params) => params.value ? <Chip label={params.value} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.62rem' }} /> : null,
    },
    {
      field: 'message',
      headerName: 'MESSAGE',
      flex: 1,
      sortable: false,
      renderCell: (params) => (
        <Typography variant="body2" noWrap sx={{ fontSize: '0.78rem', color: '#1f2937', fontFamily: '"JetBrains Mono", monospace' }}>
          {params.value || params.row.msg || ''}
        </Typography>
      ),
    },
    {
      field: 'copy',
      headerName: '',
      width: 36,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="Copy message">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(String(params.row.message || params.row.msg || '')); }} sx={{ p: 0.25 }}>
            <ContentCopyIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
          </IconButton>
        </Tooltip>
      ),
    },
  ], [selectedHost, selectedApp, setSelectedHost, setSelectedApp]);

  if (!selectedCustomer) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Please select a customer to view system logs.
        </Alert>
      </Box>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.limit));

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        gap: 1,
        // See Events.jsx — no 64px top bar exists to subtract; the shell's
        // content row is already footer-aware.
        height: '100%',
        minHeight: 0,
        width: '100%',
        bgcolor: '#f8fafc',
      }}
    >
      {/* App error-rate alerts (/api/logs/alerts). Click to see that app's errors. */}
      {alerts.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {alerts.map((a) => (
            <Alert
              key={a.app}
              severity={a.level === 'critical' ? 'error' : 'warning'}
              sx={{ py: 0, cursor: 'pointer' }}
              onClick={() => { setSelectedApp(a.app); setSelectedSeverity('err'); }}
            >
              {`${a.app}: ${a.count} error lines in the last ${a.window}m (threshold ${a.threshold})`}
            </Alert>
          ))}
        </Box>
      )}

      {/* Row 1: Time Range, Search, Actions */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          bgcolor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 1,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {/* Period Quick Select */}
          <ButtonGroup size="small" variant="outlined">
            {PERIOD_OPTIONS.map((period) => (
              <Button
                key={period}
                onClick={() => handlePeriodSelect(period)}
                variant={dateRange?.period === period ? 'contained' : 'outlined'}
                sx={{ minWidth: 36, px: 0.75, fontSize: '11px' }}
              >
                {period}
              </Button>
            ))}
          </ButtonGroup>

          {/* Custom Date/Time Pickers */}
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <DateTimePicker
                value={dateRange?.start || new Date()}
                onChange={(date) =>
                  setDateRange((prev) => ({ ...prev, start: date, period: 'custom' }))
                }
                ampm={false}
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: { width: 180, '& input': { fontSize: '12px', py: 0.75 } },
                  },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>to</Typography>
              <DateTimePicker
                value={dateRange?.end || new Date()}
                onChange={(date) =>
                  setDateRange((prev) => ({ ...prev, end: date, period: 'custom' }))
                }
                ampm={false}
                slotProps={{
                  textField: {
                    size: 'small',
                    sx: { width: 180, '& input': { fontSize: '12px', py: 0.75 } },
                  },
                }}
              />
            </Box>
          </LocalizationProvider>

          <Divider orientation="vertical" flexItem />

          {/* Search */}
          <TextField
            size="small"
            label="Search"
            placeholder="Email, ID, IP, or message"
            value={localSearch}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: localSearch && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch}>
                    <ClearIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ width: 220, '& input': { fontSize: '13px' } }}
          />

          <Box sx={{ flexGrow: 1 }} />

          {/* Refresh */}
          <Tooltip title="Refresh">
            <IconButton onClick={refreshLogs} disabled={loading} size="small">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Auto-refresh dropdown */}
          <FormControl size="small" sx={{ minWidth: 70 }}>
            <Select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(e.target.value)}
              sx={{ fontSize: '11px', '& .MuiSelect-select': { py: 0.5, px: 1 } }}
              renderValue={(val) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {val > 0 && (
                    <DotIcon
                      sx={{
                        fontSize: 10,
                        color: '#22c55e',
                        animation: 'pulse 1.5s infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.3 },
                        },
                      }}
                    />
                  )}
                  {val === 0 ? 'Auto' : `${val}s`}
                </Box>
              )}
            >
              {AUTO_REFRESH_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Trace toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={traceEnabled}
                onChange={handleTraceToggle}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {traceEnabled ? (
                  <PlayIcon sx={{ fontSize: 14, color: 'success.main' }} />
                ) : (
                  <PauseIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                )}
                <Typography variant="caption">Trace</Typography>
              </Box>
            }
            sx={{ m: 0 }}
          />

          {/* Console mode toggle — while on, error logs are captured to syslog */}
          <FormControlLabel
            control={
              <Switch
                checked={consoleEnabled}
                onChange={handleConsoleToggle}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {consoleEnabled ? (
                  <PlayIcon sx={{ fontSize: 14, color: 'success.main' }} />
                ) : (
                  <PauseIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                )}
                <Typography variant="caption">Console</Typography>
              </Box>
            }
            sx={{ m: 0 }}
          />

          {/* Export */}
          <Tooltip title="Export as JSON">
            <IconButton onClick={handleExport} disabled={logs.length === 0} size="small">
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Count */}
          <Chip
            label={`${logs.length} / ${totalCount}`}
            size="small"
            sx={{ fontFamily: 'monospace', fontSize: '11px' }}
          />
          <FormControl size="small" sx={{ minWidth: 92 }}>
            <Select
              value={pagination.limit}
              onChange={(e) => setPagination({ page: 0, limit: Number(e.target.value) })}
              inputProps={{ 'aria-label': 'Logs per page' }}
              sx={{ fontSize: '11px', '& .MuiSelect-select': { py: 0.5 } }}
            >
              {[25, 50, 100, 200].map((size) => <MenuItem key={size} value={size}>{size} / page</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Row 2: Filters */}
      <Paper
        elevation={0}
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 1,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, fontWeight: 600 }}>
            Level:
          </Typography>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={selectedSeverity || ''}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              displayEmpty
              inputProps={{ 'aria-label': 'Filter logs by level' }}
              sx={{ fontSize: '12px' }}
            >
              <MenuItem value=""><em>All levels</em></MenuItem>
              {SEVERITY_ORDER.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField size="small" label="Event type" value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)} sx={{ width: 150 }} />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={selectedHost || ''}
              onChange={(e) => setSelectedHost(e.target.value)}
              displayEmpty
              inputProps={{ 'aria-label': 'Filter logs by server' }}
              sx={{ fontSize: '12px' }}
            >
              <MenuItem value=""><em>All servers</em></MenuItem>
              {nodes.map((node) => {
                const name = typeof node === 'string' ? node : node.name;
                const type = typeof node === 'string' ? null : node.type;
                const key = typeof node === 'string' ? node : node.uuid || node.name;
                return (
                  <MenuItem key={key} value={name}>
                    {name} {type && `(${type})`}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={selectedApp || ''}
              onChange={(e) => setSelectedApp(e.target.value)}
              displayEmpty
              inputProps={{ 'aria-label': 'Filter logs by source' }}
              sx={{ fontSize: '12px' }}
            >
              <MenuItem value=""><em>All sources</em></MenuItem>
              {apps.map((app) => {
                const name = typeof app === 'string' ? app : app.name;
                const key = typeof app === 'string' ? app : app.uuid || app.name;
                return (
                  <MenuItem key={key} value={name}>{name}</MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Group by:
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              inputProps={{ 'aria-label': 'Group log timeline by' }}
              sx={{ fontSize: '12px' }}
            >
              <MenuItem value="severity">Level</MenuItem>
              <MenuItem value="app">Source</MenuItem>
              <MenuItem value="host">Server</MenuItem>
              <MenuItem value="facility">Facility</MenuItem>
              <MenuItem value="action">Event type</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          {hasActiveFilters && (
            <Button
              size="small"
              startIcon={<FilterAltOffIcon sx={{ fontSize: 16 }} />}
              onClick={handleClearFilters}
              sx={{ fontSize: '11px', textTransform: 'none', color: 'text.secondary' }}
            >
              Clear filters
            </Button>
          )}
        </Box>
      </Paper>

      {/* Metrics summary bar — derived from the full time-range server aggregation */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
        {METRICS_PILLS.map((pill) => {
          const cfg = pill.key === 'total' ? TOTAL_PILL : LEVEL_CONFIG[pill.key];
          const value = metrics[pill.key] || 0;
          const isActive = pill.key !== 'total' && selectedSeverity === pill.key;
          return (
            <Paper
              key={pill.key}
              elevation={0}
              onClick={() => handleMetricClick(pill.key)}
              sx={{
                px: 1.25,
                py: 0.5,
                bgcolor: cfg.bg,
                border: '1px solid #e5e7eb',
                borderRadius: 1,
                cursor: 'pointer',
                minWidth: 72,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                transition: 'border-color 0.15s',
                '&:hover': { borderColor: cfg.color },
                ...(isActive && {
                  borderColor: cfg.color,
                  boxShadow: `0 0 0 1px ${cfg.color}`,
                }),
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', color: cfg.color }}
              >
                {pill.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '14px',
                  fontWeight: 700,
                  fontFamily: '"JetBrains Mono", monospace',
                  color: cfg.color,
                }}
              >
                {value.toLocaleString()}
              </Typography>
            </Paper>
          );
        })}
      </Box>

      {/* Time Histogram — server-aggregated data for the full time range */}
      <Box sx={{ flexShrink: 0 }}>
        <TimeHistogram
          logs={logs}
          aggregateData={histogramBuckets}
          height={100}
          timeInterval={chartInterval}
        />
      </Box>

      {/* Main Content: DataGrid — styled identically to the Events grid */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <DataGrid
              aria-label="System log entries"
              rows={gridRows}
              columns={gridColumns}
              loading={loading}
              disableRowSelectionOnClick
              disableColumnMenu
              autoHeight={false}
              rowHeight={44}
              onRowClick={(params) => setSelectedLog(params.row)}
              slots={{
                footer: () => (
                  <CustomFooter
                    loadingMore={loading}
                    currentPage={pagination.page + 1}
                    totalPages={totalPages}
                    totalRecords={totalCount}
                    hasNextPage={pagination.page + 1 < totalPages}
                    onGoToPage={(page) => setPagination((current) => ({
                      ...current,
                      page: Math.min(Math.max(page - 1, 0), totalPages - 1),
                    }))}
                  />
                ),
              }}
              getRowClassName={(params) => {
                const lvl = normalizeSeverityKey(params.row.severity || params.row.level || '');
                if (lvl === 'crit' || lvl === 'error') return 'severity-row-error';
                if (lvl === 'warn') return 'severity-row-warn';
                return '';
              }}
              sx={{
                ...stripedDataGridSx,
                height: '100%',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                fontFamily: 'Rubik, sans-serif',
                fontSize: '0.85rem',
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e5e7eb',
                },
                '& .MuiDataGrid-columnHeader': { backgroundColor: '#f8fafc' },
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  color: '#6b7280',
                  letterSpacing: '0.05em',
                },
                '& .MuiDataGrid-cell': { borderBottom: '1px solid #f1f5f9', py: 0.5 },
                '& .MuiDataGrid-row': {
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: '#f0f9ff' },
                  '&:focus-visible': { outline: '2px solid #2563eb', outlineOffset: -2 },
                },
                '& .MuiDataGrid-virtualScroller': { backgroundColor: '#ffffff' },
                '& .severity-row-error': { bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } },
                '& .severity-row-warn': { bgcolor: '#fffbeb', '&:hover': { bgcolor: '#fef3c7' } },
              }}
            />
          </Box>

        </Box>
      </Box>

      <Dialog
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        fullWidth
        maxWidth="md"
        aria-labelledby="syslog-detail-title"
      >
        <DialogTitle id="syslog-detail-title" sx={{ display: 'flex', alignItems: 'center' }}>
          Log details
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Close details">
            <IconButton aria-label="Close log details" onClick={() => setSelectedLog(null)}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </DialogTitle>
        <DialogContent dividers>
          <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: 1, m: 0 }}>
            {Object.entries({
              time: selectedLog?.time || selectedLog?.timestamp,
              level: selectedLog?.severity || selectedLog?.level,
              server: selectedLog?.host,
              source: selectedLog?.app,
              event_type: selectedLog?.action || selectedFields.action,
              ...selectedFields,
            }).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => (
              <React.Fragment key={key}>
                <Typography component="dt" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{key.replaceAll('_', ' ')}</Typography>
                <Typography component="dd" sx={{ m: 0, fontFamily: 'monospace', fontSize: '0.78rem', overflowWrap: 'anywhere' }}>{String(value)}</Typography>
              </React.Fragment>
            ))}
          </Box>
          <Typography component="h3" sx={{ mt: 2, mb: 0.5, fontWeight: 700, fontSize: '0.85rem' }}>Raw message</Typography>
          <Box component="pre" tabIndex={0} sx={{ m: 0, p: 1.5, bgcolor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '0.78rem' }}>
            {selectedLog?.message || selectedLog?.msg || ''}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default SystemLogs;
