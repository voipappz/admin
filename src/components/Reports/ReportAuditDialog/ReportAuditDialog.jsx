import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { reportsApi } from '../../../services/api/reportsApi';

const formatTimestamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

/** Tenant-scoped EventAudit history for one report. */
const ReportAuditDialog = ({ open, onClose, reportName }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError('');
    try {
      const result = await reportsApi.getAudits(reportName, 100);
      setEvents(Array.isArray(result) ? result : []);
    } catch (err) {
      setEvents([]);
      setError(err.message || 'Failed to load report history');
    } finally {
      setLoading(false);
    }
  }, [open, reportName]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        Report run history
        {reportName && <Typography component="span" color="text.secondary"> — {reportName}</Typography>}
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={30} /></Box>
        ) : events.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No recorded runs for this report yet.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell align="right">Rows</TableCell>
                  <TableCell align="right">Duration</TableCell>
                  <TableCell>Parameters</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.event_id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTimestamp(event.created_at)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={event.level === 'error' ? 'Failed' : 'Completed'}
                        color={event.level === 'error' ? 'error' : 'success'} variant="outlined" />
                    </TableCell>
                    <TableCell>{event.actor || '—'}</TableCell>
                    <TableCell align="right">{event.rows ?? 0}</TableCell>
                    <TableCell align="right">{event.duration_ms ?? 0} ms</TableCell>
                    <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={event.params || ''}>
                      {event.params || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button startIcon={<RefreshIcon />} onClick={loadEvents} disabled={loading}>Refresh</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportAuditDialog;
