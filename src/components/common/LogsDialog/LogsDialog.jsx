import React from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Chip,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

/**
 * LogsDialog Component
 *
 * Reusable dialog for displaying activity logs.
 * Works with Users, Subscriptions, Calls, and other entities.
 *
 * @param {boolean} open - Whether the dialog is open
 * @param {Function} onClose - Handler to close the dialog
 * @param {string} title - Dialog title (e.g., "User Logs: John Doe")
 * @param {Array} logs - Array of log entries
 * @param {boolean} loading - Loading state
 */
const LogsDialog = ({ open, onClose, title, logs = [], loading = false }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getActionColor = (action) => {
    const actionLower = (action || '').toLowerCase();
    if (actionLower.includes('create') || actionLower.includes('add')) return 'success';
    if (actionLower.includes('delete') || actionLower.includes('remove')) return 'error';
    if (actionLower.includes('cancel') || actionLower.includes('warn')) return 'warning';
    if (actionLower.includes('update') || actionLower.includes('edit')) return 'info';
    return 'default';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={onClose} size="small" aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : logs && logs.length > 0 ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log, index) => (
                <TableRow key={log.id || log.uuid || index}>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(log.created_at || log.timestamp)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.action || log.event || 'update'}
                      size="small"
                      color={getActionColor(log.action || log.event)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {log.user?.name || log.user_name || log.user_email || log.account_name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {log.details || log.message || log.description || log.notes || '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No logs available
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

LogsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      uuid: PropTypes.string,
      created_at: PropTypes.string,
      timestamp: PropTypes.string,
      action: PropTypes.string,
      event: PropTypes.string,
      user: PropTypes.shape({
        name: PropTypes.string,
      }),
      user_name: PropTypes.string,
      user_email: PropTypes.string,
      account_name: PropTypes.string,
      details: PropTypes.string,
      message: PropTypes.string,
      description: PropTypes.string,
      notes: PropTypes.string,
    })
  ),
  loading: PropTypes.bool,
};

export default LogsDialog;
