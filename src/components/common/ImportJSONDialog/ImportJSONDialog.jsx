import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Autocomplete,
  Switch,
  FormControlLabel,
  Divider,
  IconButton
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { servicesApi } from '../../../services/api/servicesApi';
import { apiService } from '../../../services/apiService';

/**
 * ImportJSONDialog - Create a service with dynamic form fields
 * Fetches SERVICE_TYPES from API and renders appropriate form fields
 */
const ImportJSONDialog = ({
  open,
  onClose,
  onImport,
  title = 'Create Service',
  environments = [],
  selectedEnvironment = '',
  onSuccess
}) => {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    enabled: true,
    triggers: [],
    profile: {},
    conditions: {},
    actions: {},
    meta: {},
    notes: '',
    environment_uuids: []
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // API-fetched service types
  const [serviceTypes, setServiceTypes] = useState({});
  const [typesLoading, setTypesLoading] = useState(false);

  // For linked types: related entities
  const [linkedEntities, setLinkedEntities] = useState([]);
  const [linkedEntitiesLoading, setLinkedEntitiesLoading] = useState(false);

  // Custom trigger input
  const [newTrigger, setNewTrigger] = useState('');

  // Meta key-value pairs
  const [metaEntries, setMetaEntries] = useState([]);

  /**
   * Fetch SERVICE_TYPES from API
   */
  const fetchServiceTypes = useCallback(async () => {
    setTypesLoading(true);
    try {
      const response = await servicesApi.getTypes();
      if (typeof response === 'object' && !Array.isArray(response)) {
        setServiceTypes(response);
      }
    } catch (err) {
      console.error('Error fetching service types:', err);
      setError('Failed to load service types from API');
    } finally {
      setTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && Object.keys(serviceTypes).length === 0) {
      fetchServiceTypes();
    }
  }, [open, serviceTypes, fetchServiceTypes]);

  /**
   * Check type characteristics
   */
  const isLinkedType = (type) => {
    const config = serviceTypes[type];
    return config && config.url && config.url_params;
  };

  const getTypeConfig = (type) => serviceTypes[type] || {};

  /**
   * Fetch linked entities for a type
   */
  const fetchLinkedEntities = useCallback(async (type) => {
    const config = serviceTypes[type];
    if (!config?.url) return;

    setLinkedEntitiesLoading(true);
    try {
      const baseUrl = `/api/${config.url}`;
      const params = new URLSearchParams(config.url_params || {}).toString();
      const url = params ? `${baseUrl}?${params}` : baseUrl;
      const response = await apiService.get(url, {}, `fetching ${type} entities`, false);
      setLinkedEntities(Array.isArray(response) ? response : (response.data || []));
    } catch (err) {
      console.error(`Error fetching ${type} entities:`, err);
      setLinkedEntities([]);
    } finally {
      setLinkedEntitiesLoading(false);
    }
  }, [serviceTypes]);

  /**
   * Handle type change - reset form and load type-specific config
   */
  const handleTypeChange = (type) => {
    const config = getTypeConfig(type);

    // Reset form with type defaults
    const newFormData = {
      name: '',
      type: type,
      enabled: true,
      triggers: [],
      profile: {},
      conditions: {},
      actions: {},
      meta: {},
      notes: '',
      environment_uuids: selectedEnvironment ? [selectedEnvironment] : []
    };

    // Set default profile fields
    if (config.profile_fields && Array.isArray(config.profile_fields)) {
      config.profile_fields.forEach(field => {
        newFormData.profile[field] = '';
      });
    }

    // Type-specific defaults
    switch (type) {
      case 'webhook':
        newFormData.profile = { url: '', method_type: 'post', auth_token: '', max_retries: '3' };
        break;
      case 'metric':
        newFormData.profile = { check_interval_minutes: '5', anomaly_detection_enabled: 'false', baseline_days: '7' };
        break;
      case 'monitor':
        newFormData.profile = { type: 'sql', query: '', interval: '300' };
        break;
      case 'workflow':
        newFormData.profile = { strategy: 'sequential', enabled: 'true' };
        break;
      case 'rule':
        newFormData.profile = { enabled: 'true' };
        break;
      case 'gateway':
        newFormData.profile = { gateway_ip: '', transport: 'udp', port: '5060', auth_required: 'false' };
        break;
      case 'event':
        newFormData.profile = { method: 'post' };
        newFormData.meta = { ext: 'call.extension_username', caller: 'call.caller_id_number', status: 'event.name' };
        break;
    }

    setFormData(newFormData);
    setMetaEntries(Object.entries(newFormData.meta).map(([key, value]) => ({ key, value })));
    setError(null);

    // Fetch linked entities if needed
    if (isLinkedType(type)) {
      fetchLinkedEntities(type);
    } else {
      setLinkedEntities([]);
    }
  };

  /**
   * Update form field
   */
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Update profile field
   */
  const updateProfileField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      profile: { ...prev.profile, [field]: value }
    }));
  };

  /**
   * Add trigger
   */
  const addTrigger = (trigger) => {
    if (trigger && !formData.triggers.includes(trigger)) {
      updateField('triggers', [...formData.triggers, trigger]);
    }
    setNewTrigger('');
  };

  /**
   * Remove trigger
   */
  const removeTrigger = (trigger) => {
    updateField('triggers', formData.triggers.filter(t => t !== trigger));
  };

  /**
   * Add meta entry
   */
  const addMetaEntry = () => {
    setMetaEntries([...metaEntries, { key: '', value: '' }]);
  };

  /**
   * Update meta entry
   */
  const updateMetaEntry = (index, field, value) => {
    const newEntries = [...metaEntries];
    newEntries[index][field] = value;
    setMetaEntries(newEntries);

    // Update formData.meta
    const newMeta = {};
    newEntries.forEach(entry => {
      if (entry.key) newMeta[entry.key] = entry.value;
    });
    updateField('meta', newMeta);
  };

  /**
   * Remove meta entry
   */
  const removeMetaEntry = (index) => {
    const newEntries = metaEntries.filter((_, i) => i !== index);
    setMetaEntries(newEntries);

    const newMeta = {};
    newEntries.forEach(entry => {
      if (entry.key) newMeta[entry.key] = entry.value;
    });
    updateField('meta', newMeta);
  };

  /**
   * Handle close
   */
  const handleClose = () => {
    setFormData({
      name: '', type: '', enabled: true, triggers: [], profile: {},
      conditions: {}, actions: {}, meta: {}, notes: '', environment_uuids: []
    });
    setError(null);
    setSuccess(null);
    setLinkedEntities([]);
    setMetaEntries([]);
    setNewTrigger('');
    onClose();
  };

  /**
   * Handle create - submit to API
   */
  const handleCreate = async () => {
    // Validation
    if (!formData.name.trim()) {
      setError('Service name is required');
      return;
    }
    if (!formData.type) {
      setError('Service type is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare data for API
      const serviceData = {
        ...formData,
        enabled: formData.enabled ? 'true' : 'false'
      };

      // Call the import handler (which uses servicesApi.create)
      await onImport([serviceData]);

      setSuccess('Service created successfully!');
      onSuccess?.();

      setTimeout(handleClose, 1500);
    } catch (err) {
      setError(err.message || 'Failed to create service');
    } finally {
      setLoading(false);
    }
  };

  const typeNames = Object.keys(serviceTypes).sort();
  const currentConfig = getTypeConfig(formData.type);
  const availableTriggers = currentConfig.triggers && Array.isArray(currentConfig.triggers)
    ? currentConfig.triggers
    : [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {title}
        {typesLoading && <CircularProgress size={20} sx={{ ml: 2 }} />}
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {/* Service Type Selection */}
        <FormControl fullWidth sx={{ mb: 2 }} required>
          <InputLabel>Service Type</InputLabel>
          <Select
            value={formData.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            label="Service Type"
            disabled={loading || typesLoading}
          >
            <MenuItem value="">Select type...</MenuItem>
            {typeNames.map(type => (
              <MenuItem key={type} value={type}>
                {type.replace(/_/g, ' ').toUpperCase()}
                {currentConfig.description && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    - {serviceTypes[type]?.description?.substring(0, 50)}
                  </Typography>
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {formData.type && (
          <>
            {/* Basic Info */}
            <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>Basic Information</Typography>
            <Divider sx={{ mb: 2 }} />

            <TextField
              fullWidth
              label="Service Name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              sx={{ mb: 2 }}
              disabled={loading}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => updateField('enabled', e.target.checked)}
                  disabled={loading}
                />
              }
              label="Enabled"
              sx={{ mb: 2 }}
            />

            {/* Linked Entity Selection */}
            {isLinkedType(formData.type) && (
              <Autocomplete
                options={linkedEntities}
                getOptionLabel={(opt) => opt.name || opt.uuid || ''}
                onChange={(_, val) => updateField('type_uuid', val?.uuid || '')}
                loading={linkedEntitiesLoading}
                disabled={loading}
                sx={{ mb: 2 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={`Select ${serviceTypes[formData.type]?.url || 'Entity'}`}
                    required
                  />
                )}
              />
            )}

            {/* Environment Selection */}
            {environments.length > 0 && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Application</InputLabel>
                <Select
                  value={formData.environment_uuids[0] || ''}
                  onChange={(e) => updateField('environment_uuids', e.target.value ? [e.target.value] : [])}
                  label="Application"
                  disabled={loading}
                >
                  <MenuItem value="">No application</MenuItem>
                  {environments.map(env => (
                    <MenuItem key={env.uuid} value={env.uuid}>{env.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Triggers */}
            <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>Triggers</Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {formData.triggers.map(trigger => (
                  <Chip
                    key={trigger}
                    label={trigger}
                    onDelete={() => removeTrigger(trigger)}
                    color="primary"
                    size="small"
                  />
                ))}
              </Box>

              {availableTriggers.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Quick add:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {availableTriggers.filter(t => !formData.triggers.includes(t)).map(trigger => (
                      <Chip
                        key={trigger}
                        label={trigger}
                        onClick={() => addTrigger(trigger)}
                        variant="outlined"
                        size="small"
                        sx={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="Custom trigger..."
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTrigger(newTrigger)}
                  disabled={loading}
                />
                <Button size="small" onClick={() => addTrigger(newTrigger)} disabled={!newTrigger}>
                  Add
                </Button>
              </Box>
            </Box>

            {/* Profile Fields */}
            {Object.keys(formData.profile).length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>Profile Configuration</Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                  {Object.entries(formData.profile).map(([key, value]) => (
                    <TextField
                      key={key}
                      label={key.replace(/_/g, ' ')}
                      value={value}
                      onChange={(e) => updateProfileField(key, e.target.value)}
                      size="small"
                      disabled={loading}
                      fullWidth
                    />
                  ))}
                </Box>
              </>
            )}

            {/* Meta Fields */}
            <Typography variant="subtitle2" sx={{ mb: 1, mt: 2 }}>Meta Data</Typography>
            <Divider sx={{ mb: 2 }} />

            {metaEntries.map((entry, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  label="Key"
                  value={entry.key}
                  onChange={(e) => updateMetaEntry(index, 'key', e.target.value)}
                  disabled={loading}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Value"
                  value={entry.value}
                  onChange={(e) => updateMetaEntry(index, 'value', e.target.value)}
                  disabled={loading}
                  sx={{ flex: 2 }}
                />
                <IconButton size="small" onClick={() => removeMetaEntry(index)} color="error">
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={addMetaEntry} disabled={loading}>
              Add Meta Field
            </Button>

            {/* Notes */}
            <TextField
              fullWidth
              label="Notes"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              multiline
              rows={2}
              sx={{ mt: 2 }}
              disabled={loading}
            />
          </>
        )}

        {!formData.type && !typesLoading && (
          <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography color="text.secondary">
              Select a service type to configure
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!formData.type || !formData.name || loading}
          startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
        >
          {loading ? 'Creating...' : 'Create Service'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportJSONDialog;
