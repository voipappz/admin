import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  AccountTree as CallConditionIcon,
  Close as CloseIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useCustomerEnvironment } from '../../../context/CustomerEnvironmentContext';
import { useCallCondition } from './CallConditionBridge.js';
import { updateCallCondition } from '../../../services/api/callConditionsApi.js';
import { ResourceList } from './ResourceList.jsx';
import { BridgeTypeSelector } from '../shared/BridgeTypeSelector.jsx';
import { AnnouncementBridge } from '../AnnouncementBridge/AnnouncementBridge.jsx';
import { Z, menuProps } from '../../../utils/zIndex.js';
import { useIsUserSession } from '../../../hooks/useIsUserSession';

/**
 * CallConditionBridge Component
 * Dialog for creating time-based call routing conditions
 *
 * Based on legacy AngularJS patterns from:
 * - /opt/src/va-voipbox-admin/src/views/call_conditions/new.html
 * - /opt/src/va-voipbox-admin/src/scripts/controllers/call_conditions/new.js
 *
 * Features:
 * - Multiple routing resources with drag-drop reordering
 * - Time-based condition entries
 * - Fallback routing configuration
 * - Environment scoping
 * - containerMode prop: 'dialog' (default) renders in a Dialog wrapper;
 *   'panel' renders the form content directly in a Box (for use in wizard panels)
 * - onDrillDown prop: optional callback for nested bridge creation/editing
 *   instead of opening inline dialogs
 */
export const CallConditionBridge = ({
  open,
  onClose,
  onSave,
  environmentUuid = null,
  callCondition = null,    // Existing call condition data for edit mode
  mode = 'create',         // 'create' or 'edit'
  hideEnvironment = false, // Hide environment field when inherited from parent (e.g., DID dialog)
  containerMode = 'dialog', // 'dialog' (default) | 'panel'
  zLayer = null,           // Optional z-index layer override (e.g. Z.L3 when nested inside another L2 bridge)
  onDrillDown              // Optional — call instead of opening nested dialogs
}) => {
  const userSession = useIsUserSession();
  const layer = zLayer || Z.L2;
  const { selectedEnvironments } = useCustomerEnvironment();

  // Use call condition hook
  const {
    resources,
    addResource,
    removeResource,
    updateResource,
    handleReorder,
    validateResources,
    fallbackBridgeType,
    setFallbackBridgeType,
    fallbackBridgeUuid,
    setFallbackBridgeUuid,
    bridgeTypes,
    bridgeResources,
    fetchBridgeResources,
    loading,
    error,
    clearError,
    saveCallCondition,
    reset,
    loadFromApiFormat,
    prepareResourcesForSave
  } = useCallCondition();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    environment_uuid: '',
    enabled: true,
    notes: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [announcementEditMode, setAnnouncementEditMode] = useState('create'); // 'create' or 'edit'
  const [announcementToEdit, setAnnouncementToEdit] = useState(null);

  // Initialize form data
  useEffect(() => {
    if (open) {
      const envUuid = environmentUuid || selectedEnvironments?.[0]?.uuid || '';

      if (mode === 'edit' && callCondition) {
        // Edit mode - load existing call condition data
        const ccEnvUuid = callCondition.environment_uuid
          || callCondition.environment?.uuid
          || envUuid;
        setFormData({
          name: callCondition.name || '',
          environment_uuid: ccEnvUuid,
          enabled: callCondition.enabled !== undefined ? callCondition.enabled : true,
          notes: callCondition.notes || ''
        });
        // Set fallback bridge data if available
        if (callCondition.fallback_bridge_type) {
          setFallbackBridgeType(callCondition.fallback_bridge_type);
        }
        if (callCondition.fallback_bridge_uuid) {
          setFallbackBridgeUuid(callCondition.fallback_bridge_uuid);
        }
        // Load resources from API format
        if (callCondition.resources) {
          loadFromApiFormat(callCondition.resources);
        }

        // Fetch bridge resource lists for all bridge types used in resources + fallback
        // so the dropdowns show names (not just UUIDs)
        if (ccEnvUuid) {
          const typesToFetch = new Set();
          if (callCondition.fallback_bridge_type && callCondition.fallback_bridge_type !== 'number') {
            typesToFetch.add(callCondition.fallback_bridge_type);
          }
          if (callCondition.resources) {
            for (const r of callCondition.resources) {
              if (r.bridge_type && r.bridge_type !== 'number') {
                typesToFetch.add(r.bridge_type);
              }
            }
          }
          for (const bt of typesToFetch) {
            fetchBridgeResources(bt, ccEnvUuid);
          }
        }
      } else {
        // Create mode
        setFormData(prev => ({ ...prev, environment_uuid: envUuid }));
      }
    }
  }, [open, environmentUuid, selectedEnvironments, mode, callCondition, setFallbackBridgeType, setFallbackBridgeUuid, loadFromApiFormat, fetchBridgeResources]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      reset();
      setFormData({
        name: '',
        environment_uuid: '',
        enabled: true,
        notes: ''
      });
      setFormErrors({});
    }
  }, [open, reset]);

  // Handle create new resource from BridgeTypeSelector (fallback section)
  const handleCreateFallbackResource = (type) => {
    if (onDrillDown) {
      onDrillDown({
        type,
        mode: 'create',
        data: null,
        environmentUuid: formData.environment_uuid,
        onResult: async (savedData) => {
          const uuid = savedData?.uuid || savedData?.id;
          try {
            if (type === fallbackBridgeType || type) {
              fetchBridgeResources(type, formData.environment_uuid);
            }
            if (uuid) {
              setFallbackBridgeUuid(uuid);
            }
          } catch (err) {
            console.error('Error reloading resources after drilldown save:', err);
          }
        }
      });
      return;
    }

    // Legacy inline dialog behavior
    if (type === 'announcement') {
      setAnnouncementEditMode('create');
      setAnnouncementToEdit(null);
      setAnnouncementDialogOpen(true);
    }
  };

  // Handle edit resource from BridgeTypeSelector (fallback section)
  const handleEditFallbackResource = (type, uuid) => {
    if (onDrillDown) {
      const resourceList = bridgeResources[type] || [];
      const existingData = resourceList.find(r => r.uuid === uuid) || null;
      onDrillDown({
        type,
        mode: 'edit',
        data: existingData,
        environmentUuid: formData.environment_uuid,
        onResult: async () => {
          try {
            fetchBridgeResources(type, formData.environment_uuid);
          } catch (err) {
            console.error('Error reloading resources after drilldown edit:', err);
          }
        }
      });
      return;
    }

    // Legacy inline dialog behavior
    if (type === 'announcement') {
      const resourceList = bridgeResources['announcement'] || [];
      const ann = resourceList.find(a => a.uuid === uuid);
      if (ann) {
        setAnnouncementEditMode('edit');
        setAnnouncementToEdit(ann);
        setAnnouncementDialogOpen(true);
      }
    }
  };

  // Handle announcement save - reload bridge resources and auto-select
  const handleAnnouncementSave = async (announcementData) => {
    const uuid = announcementData.uuid || announcementData.id;
    setAnnouncementDialogOpen(false);
    setAnnouncementToEdit(null);

    try {
      // Refresh bridge resources so BridgeTypeSelector sees updates
      if (fallbackBridgeType === 'announcement') {
        fetchBridgeResources('announcement', formData.environment_uuid);
      }

      if (uuid) {
        setFallbackBridgeUuid(uuid);
      }
    } catch (err) {
      console.error('Error reloading announcements after save:', err);
    }
  };

  // Handle form field change
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!formData.name?.trim()) {
      errors.name = 'Name is required';
    }

    if (!formData.environment_uuid) {
      errors.environment_uuid = 'Application is required';
    }

    // Validate resources (only if any exist)
    if (resources.length > 0) {
      const resourceValidation = validateResources();
      if (!resourceValidation.valid) {
        errors.resources = resourceValidation.error;
      }
    }

    // Validate fallback
    if (!fallbackBridgeType) {
      errors.fallbackBridgeType = 'Fallback bridge type is required';
    }

    if (fallbackBridgeType && fallbackBridgeType !== 'number' && !fallbackBridgeUuid) {
      errors.fallbackBridgeUuid = 'Fallback destination is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Local loading state for edit mode (create mode uses hook's loading)
  const [editSaving, setEditSaving] = useState(false);

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      let result;
      if (mode === 'edit' && callCondition) {
        // Edit mode - update call condition
        setEditSaving(true);
        const preparedResources = await prepareResourcesForSave(resources);
        result = await updateCallCondition(callCondition.uuid, {
          ...formData,
          fallback_bridge_type: fallbackBridgeType,
          fallback_bridge_uuid: fallbackBridgeUuid,
          resources: preparedResources
        });
      } else {
        // Create mode
        result = await saveCallCondition(formData);
      }
      onSave(result);
      onClose();
    } catch (err) {
      // Error is handled by hook
      console.error('Submit error:', err);
    } finally {
      setEditSaving(false);
    }
  };

  const isSaving = loading || editSaving;

  // Check if form is valid
  const isFormValid = formData.name && formData.environment_uuid && fallbackBridgeType;

  // ---------------------------------------------------------------------------
  // Shared form content (rendered inside either Dialog or panel Box)
  // ---------------------------------------------------------------------------
  const formContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: containerMode === 'panel' ? 0 : 2 }}>
      {/* UUID - Read Only (edit mode only) */}
      {callCondition?.uuid && (
        <TextField
          label="UUID"
          fullWidth
          value={callCondition.uuid}
          disabled
          InputProps={{
            readOnly: true,
            sx: { fontFamily: 'monospace', backgroundColor: 'action.hover' }
          }}
          size="small"
        />
      )}

      {/* Basic Information */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Basic Information</Typography>

        {/* Enabled Switch */}
        <FormControlLabel
          control={
            <Switch
              checked={formData.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
              disabled={loading}
            />
          }
          label="Enabled"
          sx={{ mb: 2 }}
        />

        {/* Name and Environment */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            fullWidth
            error={!!formErrors.name}
            helperText={formErrors.name}
            placeholder="e.g., Business Hours Routing"
            disabled={loading}
          />

          {/* A portal user has one environment, their own: never a choice. */}
          {!hideEnvironment && !userSession && (
            <FormControl fullWidth required error={!!formErrors.environment_uuid} disabled={loading}>
              <InputLabel>Application</InputLabel>
              <Select
                value={formData.environment_uuid}
                label="Application"
                onChange={(e) => handleChange('environment_uuid', e.target.value)}
                MenuProps={menuProps(layer)}
              >
                {selectedEnvironments?.map(env => (
                  <MenuItem key={env.uuid} value={env.uuid}>{env.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

      </Paper>

      {/* Routing Resources */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">Routing Resources</Typography>
            <Typography variant="caption" color="text.secondary">
              Define time-based routing rules. Resources are evaluated in order (priority #1 first).
            </Typography>
          </Box>
          <Button
            onClick={addResource}
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            disabled={loading}
          >
            Add Resource
          </Button>
        </Box>

        <ResourceList
          resources={resources}
          onReorder={handleReorder}
          onRemove={removeResource}
          onUpdate={updateResource}
          bridgeTypes={bridgeTypes}
          bridgeResources={bridgeResources}
          onFetchBridgeResources={fetchBridgeResources}
          environmentUuid={formData.environment_uuid}
          disabled={loading}
          zLayer={layer}
        />

        {formErrors.resources && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {formErrors.resources}
          </Alert>
        )}
      </Paper>

      {/* Fallback Routing */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Fallback Routing</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Route calls here when no time conditions match. This is required.
        </Typography>

        <BridgeTypeSelector
          bridgeType={fallbackBridgeType}
          bridgeUuid={fallbackBridgeUuid}
          onBridgeTypeChange={(type) => { setFallbackBridgeType(type); setFallbackBridgeUuid(''); }}
          onBridgeUuidChange={setFallbackBridgeUuid}
          bridgeTypes={bridgeTypes}
          bridgeResources={bridgeResources}
          onFetchBridgeResources={fetchBridgeResources}
          onCreateResource={handleCreateFallbackResource}
          onEditResource={handleEditFallbackResource}
          environmentUuid={formData.environment_uuid}
          label="Fallback Destination"
          required
          typeError={formErrors.fallbackBridgeType}
          uuidError={formErrors.fallbackBridgeUuid}
          disabled={loading}
          zLayer={layer}
        />
      </Paper>

      {/* Notes - moved to bottom */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Notes</Typography>
        <TextField
          label="Notes"
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          fullWidth
          multiline
          rows={3}
          placeholder="Optional description of routing logic"
          disabled={loading}
        />
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={clearError}>
          {error}
        </Alert>
      )}
    </Box>
  );

  // ---------------------------------------------------------------------------
  // Shared action buttons
  // ---------------------------------------------------------------------------
  const actionButtons = (
    <>
      <Button onClick={onClose} disabled={isSaving}>
        Cancel
      </Button>
      <Button
        onClick={handleSubmit}
        variant="contained"
        disabled={!isFormValid || isSaving}
        startIcon={isSaving ? <CircularProgress size={20} /> : <CallConditionIcon />}
      >
        {isSaving
          ? (mode === 'edit' ? 'Updating...' : 'Creating...')
          : (mode === 'edit' ? 'Update Call Condition' : 'Create Call Condition')}
      </Button>
    </>
  );

  // ---------------------------------------------------------------------------
  // Panel mode — render form directly in a Box (no Dialog wrapper)
  // ---------------------------------------------------------------------------
  if (containerMode === 'panel') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Panel title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CallConditionIcon />
          <Typography variant="h6">
            {mode === 'edit' ? 'Edit Call Condition' : 'Create Call Condition'}
          </Typography>
        </Box>

        {/* Scrollable form body */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {formContent}
        </Box>

        {/* Action buttons pinned at the bottom */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            pt: 2,
            mt: 2,
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          {actionButtons}
        </Box>
      </Box>
    );
  }

  // ---------------------------------------------------------------------------
  // Dialog mode (default) — existing Dialog wrapper behavior unchanged
  // ---------------------------------------------------------------------------
  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{ zIndex: layer.DIALOG }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CallConditionIcon />
            <Typography variant="h6">{mode === 'edit' ? 'Edit Call Condition' : 'Create Call Condition'}</Typography>
          </Box>
          <Button onClick={onClose} size="small" sx={{ minWidth: 'auto' }}>
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {formContent}
      </DialogContent>

      <DialogActions>
        {actionButtons}
      </DialogActions>
    </Dialog>

    {/* Inline Announcement Create/Edit Dialog — only rendered when onDrillDown is not provided */}
    {!onDrillDown && (
      <AnnouncementBridge
        open={announcementDialogOpen}
        onClose={() => { setAnnouncementDialogOpen(false); setAnnouncementToEdit(null); }}
        onSave={handleAnnouncementSave}
        environmentUuid={formData.environment_uuid}
        hideEnvironment={true}
        announcement={announcementToEdit}
        editMode={announcementEditMode}
        zLayer={Z.L3}
      />
    )}
    </>
  );
};

export default CallConditionBridge;
