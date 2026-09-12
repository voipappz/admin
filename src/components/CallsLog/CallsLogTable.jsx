import React, { useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const LOG_LEVEL_STYLES = {
  fatal: { color: '#F08080', label: 'Fatal' },
  error: { color: '#FFA07A', label: 'Error' },
  warn: { color: '#F0E68C', label: 'Warn' },
  info: { color: '#00FA9A', label: 'Info' },
  debug: { color: '#ADD8E6', label: 'Debug' },
  trace: { color: '#D3D3D3', label: 'Trace' },
};

// Generate a consistent color from a string (for session coloring)
const stringToColor = (str) => {
  if (!str) return '#ffffff';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '000000'.substring(0, 6 - color.length) + color;
};

const CallsLogTable = ({
  logs,
  loading,
  pagination,
  totalCount,
  onPageChange,
  onRowsPerPageChange,
  onRefresh,
  onTagClick,
  onLevelClick,
}) => {
  // Format timestamp
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Get row background color based on session
  const getRowStyle = (session) => {
    if (!session) return {};
    const color = stringToColor(session);
    return {
      backgroundColor: `${color}15`, // 15% opacity
    };
  };

  // Memoized log entries for performance
  const logEntries = useMemo(() => {
    return logs.map((log, index) => ({
      ...log,
      _key: `${log.uuid || index}-${log.time}`,
      _rowStyle: getRowStyle(log.session),
    }));
  }, [logs]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6">
          Calls Log ({totalCount.toLocaleString()} records)
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={onRefresh} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Table */}
      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: 80 }}>Level</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 150 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }}>App</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Message</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 120 }}>Author</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 200 }}>Tags</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Loading logs...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : logEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No logs found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              logEntries.map((log) => (
                <TableRow
                  key={log._key}
                  sx={{
                    ...log._rowStyle,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  {/* Level */}
                  <TableCell>
                    <Chip
                      label={LOG_LEVEL_STYLES[log.action]?.label || log.action}
                      size="small"
                      onClick={() => onLevelClick && onLevelClick(log.action)}
                      sx={{
                        backgroundColor: LOG_LEVEL_STYLES[log.action]?.color || '#ccc',
                        color: 'black',
                        fontWeight: 500,
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.8 },
                      }}
                    />
                  </TableCell>

                  {/* Time */}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {formatDate(log.time)}
                    </Typography>
                  </TableCell>

                  {/* App */}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {log.app}
                    </Typography>
                  </TableCell>

                  {/* Message */}
                  <TableCell>
                    <Tooltip title={log.msg} placement="top-start">
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.msg}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  {/* Author */}
                  <TableCell>
                    <Typography variant="body2">
                      {log.author?.name || 'N/A'}
                    </Typography>
                  </TableCell>

                  {/* Tags */}
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {log.tags && Object.entries(log.tags).map(([key, value]) => (
                        <Chip
                          key={`${key}-${value}`}
                          label={`${key}: ${value}`}
                          size="small"
                          variant="outlined"
                          onClick={() => onTagClick && onTagClick(key, value)}
                          sx={{
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            height: 20,
                            '&:hover': { backgroundColor: 'action.hover' },
                          }}
                        />
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={totalCount}
        page={pagination.page}
        onPageChange={(e, newPage) => onPageChange(newPage)}
        rowsPerPage={pagination.limit}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[25, 50, 100, 200]}
        sx={{ borderTop: '1px solid', borderColor: 'divider' }}
      />
    </Box>
  );
};

export default CallsLogTable;
