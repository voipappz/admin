import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import StatusDialog from './StatusDialog';
import { useStatus } from './useStatus';

/**
 * StatusSelect Component
 * Reusable status selector with inline create/edit functionality
 *
 * Props:
 * - value: String - Selected status UUID
 * - onChange: Function - Handler for selection change
 * - statuses: Array - List of statuses (optional, will fetch if not provided)
 * - loading: Boolean - External loading state
 * - disabled: Boolean - Disable interactions
 * - error: Boolean - Show error state
 * - helperText: String - Helper text to display
 * - label: String - Label text (default: "Status")
 * - required: Boolean - Mark as required
 * - onStatusCreated: Function - Callback after status is created
 * - onStatusUpdated: Function - Callback after status is updated
 * - fullWidth: Boolean - Full width (default: true)
 */
const StatusSelect = ({
  value,
  onChange,
  statuses: externalStatuses,
  loading: externalLoading,
  disabled = false,
  error = false,
  helperText = '',
  label = 'Status',
  required = false,
  onStatusCreated,
  onStatusUpdated,
  fullWidth = true
}) => {
  // Use internal status management if no external statuses provided
  const {
    statuses: internalStatuses,
    statusesLoading,
    fetchStatuses,
    selectedStatusLoading,
    fetchStatus,
    saving,
    saveError,
    createStatus,
    updateStatus
  } = useStatus();

  // Determine which statuses list to use
  const statuses = externalStatuses || internalStatuses;
  const loading = externalLoading || statusesLoading;

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [editingStatus, setEditingStatus] = useState(null);

  // Fetch statuses on mount if not provided externally
  useEffect(() => {
    if (!externalStatuses) {
      fetchStatuses();
    }
  }, [externalStatuses, fetchStatuses]);

  // Get selected status object from value
  const selectedValue = statuses.find(status => status.uuid === value) || null;

  // Handle status selection change
  const handleChange = useCallback((event, newValue) => {
    onChange?.(newValue?.uuid || '');
  }, [onChange]);

  // Open create dialog
  const handleCreate = useCallback(() => {
    setDialogMode('create');
    setEditingStatus(null);
    setDialogOpen(true);
  }, []);

  // Open edit dialog
  const handleEdit = useCallback(async () => {
    if (!value) return;

    setDialogMode('edit');

    // Fetch status data
    const statusData = await fetchStatus(value);
    setEditingStatus(statusData);
    setDialogOpen(true);
  }, [value, fetchStatus]);

  // Handle save
  const handleSave = useCallback(async (statusData) => {
    try {
      if (dialogMode === 'create') {
        const newStatus = await createStatus(statusData);
        // Select the newly created status
        if (newStatus?.uuid) {
          onChange?.(newStatus.uuid);
        }
        onStatusCreated?.(newStatus);
      } else {
        await updateStatus(editingStatus.uuid, statusData);
        onStatusUpdated?.(editingStatus.uuid);
      }
      setDialogOpen(false);
    } catch {
      // Error is handled by useStatus
    }
  }, [dialogMode, editingStatus, createStatus, updateStatus, onChange, onStatusCreated, onStatusUpdated]);

  // Close dialog
  const handleCloseDialog = useCallback(() => {
    if (!saving) {
      setDialogOpen(false);
      setEditingStatus(null);
    }
  }, [saving]);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Autocomplete
          value={selectedValue}
          onChange={handleChange}
          options={statuses}
          getOptionLabel={(option) => option?.name || ''}
          isOptionEqualToValue={(option, value) => option?.uuid === value?.uuid}
          loading={loading}
          disabled={disabled}
          fullWidth={fullWidth}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              required={required}
              error={error}
              helperText={helperText}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                )
              }}
            />
          )}
          renderOption={(props, option) => (
            <li {...props} key={option.uuid}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {option.color && (
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: option.color,
                      flexShrink: 0
                    }}
                  />
                )}
                {option.name}
              </Box>
            </li>
          )}
        />

        {/* Edit button - only show when status is selected */}
        {value && (
          <Tooltip title="Edit Status">
            <span>
              <IconButton
                onClick={handleEdit}
                disabled={disabled || selectedStatusLoading}
                color="primary"
                sx={{ mt: 1 }}
              >
                {selectedStatusLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <EditIcon />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Create button */}
        <Tooltip title="Create New Status">
          <span>
            <IconButton
              onClick={handleCreate}
              disabled={disabled}
              color="primary"
              sx={{ mt: 1 }}
            >
              <AddIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Status Dialog */}
      <StatusDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        mode={dialogMode}
        status={editingStatus}
        saving={saving}
        error={saveError}
      />
    </>
  );
};

export default StatusSelect;
