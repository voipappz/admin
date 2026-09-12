import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import DynamicProfileEditor from '../common/DynamicProfileEditor/DynamicProfileEditor';
import EventPipelineBuilder from './EventPipelineBuilder/EventPipelineBuilder';
import WebhookBodyEditor, { objectToFields, fieldsToObject } from './WebhookBodyEditor';


/**
 * ServiceDialog Component
 * Dialog for creating/editing services
 */
const ServiceDialog = ({ open, onClose, onSave, service, loading, hookServiceTypes = [], canWrite = true }) => {
  const { environments } = useCustomerEnvironment();

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    enabled: true,
    triggers: [],
    environment_uuids: [],
    profile: {},
    meta_fields: [],
    notes: ''
  });
  const [errors, setErrors] = useState({});

  // Service types come from the API (GET /api/services?action=types) via the
  // hook — no hardcoded list, so the dropdown always matches the backend.
  const serviceTypes = hookServiceTypes;

  useEffect(() => {
    if (service) {
      const triggers = Array.isArray(service.triggers) ? service.triggers : [];
      setFormData({
        name: service.name || '',
        type: service.type || '',
        enabled: service.enabled !== undefined ? service.enabled : true,
        triggers,
        environment_uuids: service.environment_uuids || [],
        profile: service.profile || {},
        meta_fields: objectToFields(service.meta),
        notes: service.notes || ''
      });
    } else {
      setFormData({
        name: '',
        type: '',
        enabled: true,
        triggers: [],
        environment_uuids: [],
        profile: {},
        meta_fields: [],
        notes: ''
      });
    }
    setErrors({});
  }, [service, open]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Service name is required';
    }
    if (!formData.type) {
      newErrors.type = 'Service type is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    // Per-type profile only — dispatch is absolute by service.type on the
    // server, so legacy handler_type/code keys are always dropped.
    let profile = { ...(formData.profile || {}) };
    delete profile.code;
    delete profile.handler_type;

    // Webhook profile is a closed contract (profile_params?type=webhook):
    // url, method, basic auth. Loaded rows may still carry legacy keys
    // (headers, param_*) from the old builder — sending them back would
    // re-persist them forever, so whitelist instead of spreading.
    if (formData.type === 'webhook') {
      const WEBHOOK_PROFILE_KEYS = ['url', 'method', 'basic_auth_username', 'basic_auth_password'];
      profile = Object.fromEntries(
        Object.entries(profile).filter(([key]) => WEBHOOK_PROFILE_KEYS.includes(key))
      );
    }

    const payload = {
      name: formData.name,
      type: formData.type,
      enabled: formData.enabled,
      triggers: formData.triggers || [],
      environment_uuids: formData.environment_uuids || [],
      profile,
      notes: formData.notes
    };
    if (formData.type === 'webhook') {
      payload.meta = fieldsToObject(formData.meta_fields);
    }

    onSave(payload);
  };

  const isFormValid = formData.name && formData.type;

  return (
    <Dialog open={open} onClose={onClose} maxWidth={service ? 'md' : 'sm'} fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SettingsIcon />
          {service ? 'Edit Service' : 'New Service'}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          {/* Service Details Card */}
          <Card elevation={2}>
            <CardHeader
              avatar={<SettingsIcon color="primary" />}
              title="Service Details"
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* UUID - read only with copy, edit mode only */}
                {service?.uuid && (
                  <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70, fontWeight: 600 }}>UUID</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{service.uuid}</Typography>
                      <Tooltip title="Copy UUID">
                        <IconButton size="small" onClick={() => navigator.clipboard?.writeText(service.uuid)} sx={{ p: 0.25 }}>
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                )}

                {/* Enabled - right after UUID */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.enabled}
                      onChange={(e) => handleChange('enabled', e.target.checked)}
                    />
                  }
                  label="Enabled"
                />

                <TextField
                  label="Service Name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name}
                  fullWidth
                  required
                />

                <FormControl fullWidth required error={!!errors.type}>
                  <InputLabel>Service Type</InputLabel>
                  <Select
                    value={formData.type}
                    label="Service Type"
                    onChange={(e) => {
                      const newType = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        type: newType,
                        profile: {},
                      }));
                      if (errors.type) {
                        setErrors(prev => ({ ...prev, type: null }));
                      }
                    }}
                  >
                    {(serviceTypes || []).map(type => (
                      <MenuItem key={type} value={type}>
                        {type.replace('_', ' ').toUpperCase()}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.type && <Typography color="error" variant="caption">{errors.type}</Typography>}
                </FormControl>

                {/* EventStore Pipeline Builder — embedded event + handler/code configuration */}
                <EventPipelineBuilder
                  triggers={formData.triggers}
                  onTriggersChange={(newTriggers) => handleChange('triggers', newTriggers)}
                  serviceUuid={service?.uuid}
                  serviceType={formData.type}
                  triggersOnly
                  disabled={loading}
                />

                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Applications</InputLabel>
                  <Select
                    multiple
                    value={formData.environment_uuids || []}
                    label="Applications"
                    onChange={(e) => handleChange('environment_uuids', e.target.value)}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((uuid) => {
                          const env = environments?.find(e => e.uuid === uuid);
                          return (
                            <Chip
                              key={uuid}
                              label={env?.name || uuid}
                              size="small"
                              onDelete={() => {
                                handleChange(
                                  'environment_uuids',
                                  formData.environment_uuids.filter(id => id !== uuid)
                                );
                              }}
                              onMouseDown={(event) => {
                                event.stopPropagation();
                              }}
                            />
                          );
                        })}
                      </Box>
                    )}
                  >
                    {environments?.map(env => (
                      <MenuItem key={env.uuid} value={env.uuid}>
                        <Checkbox checked={formData.environment_uuids?.includes(env.uuid)} />
                        <ListItemText primary={env.name} />
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Select one or more environments for this service
                  </Typography>
                </FormControl>

                {/* Notes - always last in the form body */}
                <TextField
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                />
              </Box>
            </CardContent>
          </Card>

          {/* Profile Editor - Dynamic fields from API based on service type */}
          {formData.type && (
            <Card elevation={2}>
              <CardContent>
                <DynamicProfileEditor
                  type={formData.type}
                  profile={formData.profile}
                  onChange={(profile) => handleChange('profile', profile)}
                  disabled={loading}
                  title={`${formData.type.replace('_', ' ').toUpperCase()} Configuration`}
                  grouped
                  ownTypeOnly
                />
              </CardContent>
            </Card>
          )}

          {/* Webhook request fields in meta; headers in profile */}
          {formData.type === 'webhook' && (
            <>
              <WebhookBodyEditor
                fields={formData.meta_fields}
                onChange={(fields) => handleChange('meta_fields', fields)}
                disabled={loading}
              />
            </>
          )}

          {service && (
            <>
              {/* Environment Details */}
              {service.environment && (
                <Card elevation={2}>
                  <CardHeader
                    avatar={<SettingsIcon color="primary" />}
                    title="Application Details"
                    titleTypographyProps={{ variant: 'h6', color: 'primary' }}
                  />
                  <CardContent>
                    <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Application Name</Typography>
                        <Typography variant="body2" fontWeight={600}>{service.environment.name || 'N/A'}</Typography>
                      </Box>
                      {service.environment.domain && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Domain</Typography>
                          <Typography variant="body2">{service.environment.domain}</Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              )}

            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!canWrite || !isFormValid || loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {service ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ServiceDialog;
