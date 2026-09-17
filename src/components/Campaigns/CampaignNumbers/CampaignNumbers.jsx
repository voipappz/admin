import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Checkbox,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { campaignsApi } from '../../../services/api/campaignsApi';
import { useNotification } from '../../../context/NotificationContext';
import { formatDate } from '../../../utils/dateUtils';

const statusColors = {
  created: 'default',
  called: 'success',
  dialing: 'info',
  in_call: 'info',
  drop: 'error',
  duplicate: 'warning',
  wrong_number: 'error',
  do_not_call: 'error',
  invalid_contact: 'error',
  unavailable: 'default',
  canceled: 'default',
  pending: 'warning',
  fetched: 'info',
  fired: 'success',
  schedule: 'info',
  dial_error: 'error',
  freeze: 'warning',
  dialed: 'success',
};

const CampaignNumbersDialog = ({ open, onClose, campaign, canWrite = true }) => {
  const { showSuccess, showError } = useNotification();
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selected, setSelected] = useState([]);

  // Add numbers state
  const [addMode, setAddMode] = useState(false);
  const [numbersInput, setNumbersInput] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchNumbers = useCallback(async () => {
    if (!campaign?.uuid) return;
    setLoading(true);
    try {
      const response = await campaignsApi.getCampaignNumbers(campaign.uuid, {
        page: page + 1,
        per_page: rowsPerPage,
      });
      const items = Array.isArray(response) ? response : (response?.data || []);
      setNumbers(items);
      setTotalCount(response?.total_records || response?.total || items.length);
    } catch (err) {
      console.error('Error fetching campaign numbers:', err);
      setNumbers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [campaign?.uuid, page, rowsPerPage]);

  useEffect(() => {
    if (open && campaign?.uuid) {
      fetchNumbers();
      setSelected([]);
      setAddMode(false);
      setNumbersInput('');
    }
  }, [open, campaign?.uuid, fetchNumbers]);

  const handleAddNumbers = async () => {
    if (!numbersInput.trim()) return;

    // Parse numbers: split by newlines, commas, spaces, semicolons
    const parsed = numbersInput
      .split(/[\n,;\s]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (parsed.length === 0) {
      showError('No valid numbers entered');
      return;
    }

    setAdding(true);
    try {
      await campaignsApi.addNumbersToCampaign(campaign.uuid, parsed);
      showSuccess(`Added ${parsed.length} number(s) to campaign`);
      setNumbersInput('');
      setAddMode(false);
      await fetchNumbers();
    } catch (err) {
      console.error('Error adding numbers:', err);
      showError(err?.message || 'Failed to add numbers');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      await campaignsApi.batchDeleteCampaignNumbers(selected);
      showSuccess(`Deleted ${selected.length} number(s)`);
      setSelected([]);
      await fetchNumbers();
    } catch (err) {
      console.error('Error deleting numbers:', err);
      showError(err?.message || 'Failed to delete numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSelected = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      await campaignsApi.resetCampaignNumbers(selected);
      showSuccess(`Reset ${selected.length} number(s)`);
      setSelected([]);
      await fetchNumbers();
    } catch (err) {
      console.error('Error resetting numbers:', err);
      showError(err?.message || 'Failed to reset numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelected(numbers.map(n => n.uuid));
    } else {
      setSelected([]);
    }
  };

  const handleSelectOne = (uuid) => {
    setSelected(prev =>
      prev.includes(uuid) ? prev.filter(id => id !== uuid) : [...prev, uuid]
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            Numbers — {campaign?.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {canWrite && selected.length > 0 && (
              <>
                <Tooltip title="Reset Selected">
                  <IconButton size="small" onClick={handleResetSelected} disabled={loading}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Selected">
                  <IconButton size="small" color="error" onClick={handleDeleteSelected} disabled={loading}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1 }}>
                  {selected.length} selected
                </Typography>
              </>
            )}
            {canWrite && (
              <Button
                size="small"
                variant={addMode ? 'outlined' : 'contained'}
                onClick={() => setAddMode(!addMode)}
              >
                {addMode ? 'Cancel' : 'Add Numbers'}
              </Button>
            )}
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Add Numbers Panel */}
        {addMode && (
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
            <TextField
              label="Enter phone numbers"
              multiline
              rows={4}
              fullWidth
              size="small"
              value={numbersInput}
              onChange={(e) => setNumbersInput(e.target.value)}
              placeholder="Enter numbers separated by newlines, commas, or spaces&#10;e.g.:&#10;1234567890&#10;0987654321, 1112223333"
              disabled={adding}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 'auto' }}>
                {numbersInput.trim()
                  ? `${numbersInput.split(/[\n,;\s]+/).filter(n => n.trim()).length} number(s)`
                  : 'Paste or type numbers'}
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={handleAddNumbers}
                disabled={adding || !numbersInput.trim()}
                startIcon={adding ? <CircularProgress size={16} /> : null}
              >
                {adding ? 'Adding...' : 'Add'}
              </Button>
            </Box>
          </Box>
        )}

        {/* Numbers Table */}
        <TableContainer>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {canWrite && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < numbers.length}
                      checked={numbers.length > 0 && selected.length === numbers.length}
                      onChange={handleSelectAll}
                      size="small"
                    />
                  </TableCell>
                )}
                <TableCell>Number</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Weight</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Dialed At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && numbers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canWrite ? 7 : 6} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : numbers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canWrite ? 7 : 6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No numbers in this campaign. Click "Add Numbers" to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                numbers.map((num) => (
                  <TableRow key={num.uuid} hover selected={selected.includes(num.uuid)}>
                    {canWrite && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected.includes(num.uuid)}
                          onChange={() => handleSelectOne(num.uuid)}
                          size="small"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {num.number?.number || num.number || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={num.status || 'created'}
                        size="small"
                        color={statusColors[num.status] || 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {num.state || '-'}
                    </TableCell>
                    <TableCell>
                      {num.weight ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.8rem">
                        {formatDate(num.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.8rem">
                        {num.dialed_at ? formatDate(num.dialed_at) : '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          sx={{ borderTop: '1px solid var(--mui-palette-divider)' }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CampaignNumbersDialog;
