import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { TariffBridge } from '../../Bridges/TariffBridge/TariffBridge.jsx';
import { tariffsApi } from '../../../services/api/tariffsApi';
import { Z } from '../../../utils/zIndex.js';

/**
 * TariffSelect Component
 * Reusable tariff selector with inline create/edit functionality
 *
 * Props:
 * - value: String - Selected tariff UUID
 * - onChange: Function - Handler for selection change
 * - tariffs: Array - List of tariffs (optional, will fetch if not provided)
 * - loading: Boolean - External loading state
 * - disabled: Boolean - Disable interactions
 * - error: Boolean - Show error state
 * - helperText: String - Helper text to display
 * - label: String - Label text (default: "Tariff")
 * - required: Boolean - Mark as required
 * - onTariffCreated: Function - Callback after tariff is created
 * - onTariffUpdated: Function - Callback after tariff is updated
 * - fullWidth: Boolean - Full width (default: true)
 * - dialogZIndex: Number - z-index for nested TariffBridge dialog (optional, for use inside other dialogs)
 */
const TariffSelect = ({
  value,
  onChange,
  tariffs: externalTariffs,
  loading: externalLoading,
  disabled = false,
  error = false,
  helperText = '',
  label = 'Tariff',
  required = false,
  onTariffCreated,
  onTariffUpdated,
  fullWidth = true,
  dialogZIndex = null
}) => {
  // Internal state for tariffs if not provided externally
  const [internalTariffs, setInternalTariffs] = useState([]);
  const [tariffsLoading, setTariffsLoading] = useState(false);
  const [selectedTariffLoading, setSelectedTariffLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [editingTariff, setEditingTariff] = useState(null);

  // Determine which tariffs list to use
  const tariffs = externalTariffs || internalTariffs;
  const loading = externalLoading || tariffsLoading;

  // Fetch tariffs on mount if not provided externally
  const fetchTariffs = useCallback(async () => {
    if (externalTariffs) return;

    setTariffsLoading(true);
    try {
      const response = await tariffsApi.getTariffs({ per_page: 9999 });
      setInternalTariffs(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('Error fetching tariffs:', err);
      setInternalTariffs([]);
    } finally {
      setTariffsLoading(false);
    }
  }, [externalTariffs]);

  useEffect(() => {
    if (!externalTariffs) {
      fetchTariffs();
    }
  }, [externalTariffs, fetchTariffs]);

  // Get selected tariff object from value
  const selectedValue = tariffs.find(t => t.uuid === value) || null;

  // Handle tariff selection change
  const handleChange = useCallback((event, newValue) => {
    onChange?.(newValue?.uuid || '');
  }, [onChange]);

  // Open create dialog
  const handleCreate = useCallback(() => {
    setDialogMode('create');
    setEditingTariff(null);
    setDialogOpen(true);
  }, []);

  // Open edit dialog
  const handleEdit = useCallback(async () => {
    if (!value) return;

    setSelectedTariffLoading(true);
    try {
      const tariffData = await tariffsApi.getTariff(value);
      setEditingTariff(tariffData);
      setDialogMode('edit');
      setDialogOpen(true);
    } catch (err) {
      console.error('Error fetching tariff for edit:', err);
    } finally {
      setSelectedTariffLoading(false);
    }
  }, [value]);

  // Handle save from TariffBridge
  const handleSave = useCallback(async (savedTariff) => {
    // Refresh tariffs list
    if (!externalTariffs) {
      await fetchTariffs();
    }

    if (dialogMode === 'create') {
      // Select the newly created tariff
      if (savedTariff?.uuid) {
        onChange?.(savedTariff.uuid);
      }
      onTariffCreated?.(savedTariff);
    } else {
      onTariffUpdated?.(savedTariff);
    }

    setDialogOpen(false);
    setEditingTariff(null);
  }, [dialogMode, externalTariffs, fetchTariffs, onChange, onTariffCreated, onTariffUpdated]);

  // Close dialog
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingTariff(null);
  }, []);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Autocomplete
          value={selectedValue}
          onChange={handleChange}
          options={tariffs}
          getOptionLabel={(option) => option?.name || ''}
          isOptionEqualToValue={(option, value) => option?.uuid === value?.uuid}
          loading={loading}
          disabled={disabled}
          fullWidth={fullWidth}
          slotProps={{ popper: { style: { zIndex: Z.L3.MENU } } }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              required={required}
              error={error}
              helperText={helperText}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <AttachMoneyIcon sx={{ color: 'action.active', mr: 1 }} />
                    {params.InputProps.startAdornment}
                  </>
                ),
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
          renderOption={(props, option) => {
            const { key, ...restProps } = props;
            return (
              <li key={key} {...restProps}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <AttachMoneyIcon fontSize="small" sx={{ color: 'action.active' }} />
                  <span>{option.name}</span>
                  {option.scheme && (
                    <Chip
                      label={option.scheme}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 'auto' }}
                    />
                  )}
                </Box>
              </li>
            );
          }}
        />

        {/* Edit button - only show when tariff is selected */}
        {value && (
          <Tooltip title="Edit Tariff & Manage Rates">
            <span>
              <IconButton
                onClick={handleEdit}
                disabled={disabled || selectedTariffLoading}
                color="primary"
                sx={{ mt: 1 }}
              >
                {selectedTariffLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <EditIcon />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Create button */}
        <Tooltip title="Create New Tariff">
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

      {/* Tariff Dialog */}
      <TariffBridge
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        tariff={editingTariff}
        mode={dialogMode}
        zIndex={dialogZIndex}
      />
    </>
  );
};

export default TariffSelect;
