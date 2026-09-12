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
import EventNoteIcon from '@mui/icons-material/EventNote';
import { PlanBridge } from '../../Bridges/PlanBridge/PlanBridge.jsx';
import { plansApi } from '../../../services/api/plansApi';

/**
 * PlanSelect Component
 * Reusable plan selector with inline create/edit functionality
 *
 * Props:
 * - value: String - Selected plan UUID
 * - onChange: Function - Handler for selection change
 * - plans: Array - List of plans (optional, will fetch if not provided)
 * - loading: Boolean - External loading state
 * - disabled: Boolean - Disable interactions
 * - error: Boolean - Show error state
 * - helperText: String - Helper text to display
 * - label: String - Label text (default: "Plan")
 * - required: Boolean - Mark as required
 * - onPlanCreated: Function - Callback after plan is created
 * - onPlanUpdated: Function - Callback after plan is updated
 * - fullWidth: Boolean - Full width (default: true)
 */
const PlanSelect = ({
  value,
  onChange,
  plans: externalPlans,
  loading: externalLoading,
  disabled = false,
  error = false,
  helperText = '',
  label = 'Plan',
  required = false,
  onPlanCreated,
  onPlanUpdated,
  fullWidth = true
}) => {
  // Internal state for plans if not provided externally
  const [internalPlans, setInternalPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanLoading, setSelectedPlanLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [editingPlan, setEditingPlan] = useState(null);

  // Determine which plans list to use
  const plans = externalPlans || internalPlans;
  const loading = externalLoading || plansLoading;

  // Fetch plans on mount if not provided externally
  const fetchPlans = useCallback(async () => {
    if (externalPlans) return;

    setPlansLoading(true);
    try {
      const response = await plansApi.getPlans({ per_page: 9999 });
      setInternalPlans(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setInternalPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, [externalPlans]);

  useEffect(() => {
    if (!externalPlans) {
      fetchPlans();
    }
  }, [externalPlans, fetchPlans]);

  // Get selected plan object from value
  const selectedValue = plans.find(p => p.uuid === value) || null;

  // Handle plan selection change
  const handleChange = useCallback((event, newValue) => {
    onChange?.(newValue?.uuid || '');
  }, [onChange]);

  // Open create dialog
  const handleCreate = useCallback(() => {
    setDialogMode('create');
    setEditingPlan(null);
    setDialogOpen(true);
  }, []);

  // Open edit dialog
  const handleEdit = useCallback(async () => {
    if (!value) return;

    setSelectedPlanLoading(true);
    try {
      const planData = await plansApi.getPlan(value);
      setEditingPlan(planData);
      setDialogMode('edit');
      setDialogOpen(true);
    } catch (err) {
      console.error('Error fetching plan for edit:', err);
    } finally {
      setSelectedPlanLoading(false);
    }
  }, [value]);

  // Handle save from PlanBridge
  const handleSave = useCallback(async (savedPlan) => {
    // Refresh plans list
    if (!externalPlans) {
      await fetchPlans();
    }

    if (dialogMode === 'create') {
      // Select the newly created plan
      if (savedPlan?.uuid) {
        onChange?.(savedPlan.uuid);
      }
      onPlanCreated?.(savedPlan);
    } else {
      onPlanUpdated?.(savedPlan);
    }

    setDialogOpen(false);
    setEditingPlan(null);
  }, [dialogMode, externalPlans, fetchPlans, onChange, onPlanCreated, onPlanUpdated]);

  // Close dialog
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingPlan(null);
  }, []);

  // Format period for display
  const formatPeriod = (plan) => {
    if (!plan.period) return '';
    const interval = plan.interval || 1;
    const period = plan.period.charAt(0).toUpperCase() + plan.period.slice(1);
    return interval === 1 ? period : `${interval} ${period}s`;
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Autocomplete
          value={selectedValue}
          onChange={handleChange}
          options={plans}
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
                startAdornment: (
                  <>
                    <EventNoteIcon sx={{ color: 'action.active', mr: 1 }} />
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
                  <EventNoteIcon fontSize="small" sx={{ color: 'action.active' }} />
                  <span>{option.name}</span>
                  {option.period && (
                    <Chip
                      label={formatPeriod(option)}
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

        {/* Edit button - only show when plan is selected */}
        {value && (
          <Tooltip title="Edit Plan & Manage Items">
            <span>
              <IconButton
                onClick={handleEdit}
                disabled={disabled || selectedPlanLoading}
                color="primary"
                sx={{ mt: 1 }}
              >
                {selectedPlanLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <EditIcon />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Create button */}
        <Tooltip title="Create New Plan">
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

      {/* Plan Dialog */}
      <PlanBridge
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSave}
        plan={editingPlan}
        mode={dialogMode}
      />
    </>
  );
};

export default PlanSelect;
