import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useCustomerEnvironment } from '../../../context/CustomerEnvironmentContext';
import { NumberSelector } from '../../Bridges/NumberBridge/NumberSelector.jsx';
import RoutingChain from './RoutingChain.jsx';
import { didsApi } from '../../../services/api/didsApi';
import { parseServerErrors, is406Error } from '../../../utils/formValidation';
import { Z, menuProps } from '../../../utils/zIndex.js';
import './DIDForm.css';

/** Dashed section divider with centered label */
const FormSection = ({ label }) => (
  <div className="did-form-section">
    <span className="did-form-section-text">{label}</span>
  </div>
);

/**
 * DIDForm Component
 * Pure form content for creating/editing DIDs.
 * No Dialog wrapper — used by both DIDDialog (legacy) and DIDWizard.
 * Bridge create/edit is delegated to the onDrillDown callback.
 */
const DIDForm = forwardRef(({
  did,
  loading,
  bridgeTypes = [],
  bridgeResources = {},
  didTypes = [],
  onFetchBridgeResources,
  onSave,
  onCancel,
  onDrillDown,
  showActions = true,
}, ref) => {
  const { selectedEnvironments } = useCustomerEnvironment();
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [apiError, setApiError] = useState('');
  const [environments, setEnvironments] = useState([]);
  const [metaFields, setMetaFields] = useState([]);
  const [providers, setProviders] = useState([]);

  // Initialize form data
  useEffect(() => {
    if (did) {
      const environmentUuid = did.environment_uuid ||
        (did.environment && did.environment.uuid) || '';

      setFormData({
        name: did.name || '',
        number: did.number || '',
        environment_uuid: environmentUuid,
        type: did.type || '',
        provider_uuid: did.provider_uuid || '',
        bridge_type: did.bridge_type || '',
        bridge_uuid: did.bridge_uuid || (did.bridge && did.bridge.uuid) || '',
        enabled: did.enabled !== undefined ? did.enabled : true,
        notes: did.notes || ''
      });

      if (did.meta) {
        if (typeof did.meta === 'object') {
          setMetaFields(Object.entries(did.meta).map(([key, value]) => ({ key, value })));
        } else {
          try {
            const parsed = JSON.parse(did.meta);
            setMetaFields(Object.entries(parsed).map(([key, value]) => ({ key, value })));
          } catch {
            setMetaFields([]);
          }
        }
      } else {
        setMetaFields([]);
      }
    } else {
      setFormData({
        name: '',
        number: '',
        environment_uuid: selectedEnvironments?.[0]?.uuid || '',
        type: '',
        provider_uuid: '',
        bridge_type: '',
        bridge_uuid: '',
        enabled: true,
        notes: ''
      });
      setMetaFields([]);
    }
    setErrors({});
    setSubmitAttempted(false);
    setApiError('');
  }, [did, selectedEnvironments]);

  // Load environments
  useEffect(() => {
    let envList = selectedEnvironments ? [...selectedEnvironments] : [];

    if (did) {
      const didEnvUuid = did.environment_uuid || did.environment?.uuid;
      const didEnvName = did.environment?.name || did.environment_name;
      if (didEnvUuid && !envList.find(e => e.uuid === didEnvUuid)) {
        envList.push({
          uuid: didEnvUuid,
          name: didEnvName || `Application (${didEnvUuid.slice(0, 8)}...)`,
        });
      }
    }

    setEnvironments(envList);
  }, [selectedEnvironments, did]);

  // Fetch available DID providers
  useEffect(() => {
    didsApi.getProviders()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.data || []);
        setProviders(list);
      })
      .catch(() => setProviders([]));
  }, []);

  // Fetch bridge resources when DID has existing bridge_type
  useEffect(() => {
    if (onFetchBridgeResources) {
      const environmentUuid = did?.environment_uuid || did?.environment?.uuid;
      if (did?.bridge_type && did.bridge_type !== 'number' && environmentUuid) {
        onFetchBridgeResources(did.bridge_type, environmentUuid);
      }
    }
  }, [did?.bridge_type, did?.environment_uuid, did?.environment?.uuid, onFetchBridgeResources]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleBridgeTypeChange = async (bridgeType) => {
    setFormData(prev => ({
      ...prev,
      bridge_type: bridgeType,
      bridge_uuid: ''
    }));
    if (bridgeType && bridgeType !== 'number' && onFetchBridgeResources) {
      await onFetchBridgeResources(bridgeType, formData.environment_uuid);
    }
  };

  const handleEnvironmentChange = (envUuid) => {
    setFormData(prev => ({ ...prev, environment_uuid: envUuid, bridge_type: '', bridge_uuid: '' }));
  };

  // Meta field management
  const addMetaField = () => {
    setMetaFields(prev => [...prev, { key: '', value: '' }]);
  };

  const removeMetaField = (index) => {
    setMetaFields(prev => prev.filter((_, i) => i !== index));
  };

  const updateMetaField = (index, field, value) => {
    setMetaFields(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // Bridge selection — detect inline creation
  const handleBridgeChange = (value) => {
    if (value === 'add_new') {
      if (onDrillDown) {
        onDrillDown({
          type: formData.bridge_type,
          mode: 'create',
          data: null,
          environmentUuid: formData.environment_uuid,
          onResult: async (savedData) => {
            const uuid = savedData.uuid || savedData.id;
            handleChange('bridge_uuid', uuid);
            if (onFetchBridgeResources) {
              await onFetchBridgeResources(formData.bridge_type, formData.environment_uuid, true);
            }
          }
        });
      }
    } else {
      handleChange('bridge_uuid', value);
    }
  };

  // Validation
  const validateForm = () => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = 'Name is required';
    if (!formData.number?.trim()) newErrors.number = 'Number is required';
    if (!formData.environment_uuid) newErrors.environment_uuid = 'Application is required';
    if (!formData.type) newErrors.type = 'Type is required';
    if (!formData.bridge_type) newErrors.bridge_type = 'Bridge type is required';
    if (formData.bridge_type && !formData.bridge_uuid) {
      newErrors.bridge_uuid = formData.bridge_type === 'number'
        ? 'Destination number is required'
        : 'Bridge is required';
    }

    const metaKeys = metaFields.map(f => f.key).filter(k => k.trim());
    const duplicateKeys = metaKeys.filter((k, i) => metaKeys.indexOf(k) !== i);
    if (duplicateKeys.length > 0) {
      newErrors.meta = 'Duplicate meta keys are not allowed';
      duplicateKeys.forEach(k => { newErrors[`meta_${k}`] = 'Duplications are not allowed'; });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setApiError('');
    if (!validateForm()) return;

    const submitData = { ...formData };

    delete submitData.number_bridge;
    if (!submitData.bridge_uuid || submitData.bridge_uuid === '') {
      submitData.bridge_uuid = null;
    }

    if (metaFields.length > 0) {
      const meta = {};
      metaFields.forEach(f => {
        if (f.key.trim() && f.value.trim()) meta[f.key] = f.value;
      });
      submitData.meta = meta;
    }

    try {
      await onSave(submitData);
    } catch (error) {
      console.error('Save error:', error);
      if (is406Error(error)) {
        const serverErrors = parseServerErrors(error);
        if (Object.keys(serverErrors).length > 0) {
          setErrors(prev => ({ ...prev, ...serverErrors }));
        }
      }
      setApiError(error?.response?.data?.message || error?.message || 'Failed to save DID');
    }
  };

  // Expose submit to parent via ref
  useImperativeHandle(ref, () => ({
    submit: handleSubmit,
  }));

  const isFormValid = formData.name && formData.number && formData.environment_uuid && formData.type && formData.bridge_type;

  // Helper: get human-readable bridge type label
  const getBridgeTypeLabel = (type) => {
    const labels = {
      queue: 'Queue', ivr: 'IVR', vml: 'VML Script',
      call_condition: 'Call Condition', bot: 'Bot',
      announcement: 'Announcement', extension: 'Device'
    };
    return labels[type] || type?.charAt(0).toUpperCase() + type?.slice(1);
  };

  return (
    <Box className="did-form" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {apiError && (
        <Alert severity="error" onClose={() => setApiError('')}>
          {apiError}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* ── Details Section ── */}
          <FormSection label="Details" />

          {/* Name + Number side by side */}
          <div className="did-form-row">
            <TextField
              label="Name"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              fullWidth
              error={!!errors.name || (submitAttempted && !formData.name?.trim())}
              helperText={errors.name || (submitAttempted && !formData.name?.trim() ? 'Name is required' : 'A friendly name to identify this DID')}
              placeholder="e.g. Main Office Line"
            />
            <TextField
              label="Phone Number"
              value={formData.number || ''}
              onChange={(e) => handleChange('number', e.target.value)}
              required
              fullWidth
              error={!!errors.number || (submitAttempted && !formData.number?.trim())}
              helperText={errors.number || (submitAttempted && !formData.number?.trim() ? 'Number is required' : 'E.164 format, e.g. +14155551234')}
              placeholder="+14155551234"
            />
          </div>

          {/* Environment */}
          <FormControl fullWidth required error={!!errors.environment_uuid || (submitAttempted && !formData.environment_uuid)}>
            <InputLabel required>Application</InputLabel>
            <Select
              value={formData.environment_uuid || ''}
              label="Application"
              onChange={(e) => handleEnvironmentChange(e.target.value)}
              MenuProps={menuProps(Z.L1)}
            >
              {environments.map(env => (
                <MenuItem key={env.uuid} value={env.uuid}>{env.name}</MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {errors.environment_uuid || (submitAttempted && !formData.environment_uuid)
                ? (errors.environment_uuid || 'Application is required')
                : 'The application this DID belongs to'}
            </FormHelperText>
          </FormControl>

          {/* Type */}
          <FormControl fullWidth required error={!!errors.type || (submitAttempted && !formData.type)}>
            <InputLabel required>DID Type</InputLabel>
            <Select
              value={formData.type || ''}
              label="DID Type"
              onChange={(e) => handleChange('type', e.target.value)}
              MenuProps={menuProps(Z.L1)}
            >
              {didTypes.map(type => (
                <MenuItem key={type} value={type}>{type.replace('_', ' ').toUpperCase()}</MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {errors.type || (submitAttempted && !formData.type)
                ? (errors.type || 'Type is required')
                : 'Classification for this phone number'}
            </FormHelperText>
          </FormControl>

          {/* Provider */}
          {providers.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select
                value={formData.provider_uuid || ''}
                label="Provider"
                onChange={(e) => handleChange('provider_uuid', e.target.value)}
                MenuProps={menuProps(Z.L1)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {providers.map(p => (
                  <MenuItem key={p.uuid} value={p.uuid}>
                    {p.name}{p.type ? ` (${p.type.toUpperCase()})` : ''}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                SIP trunk / provider that delivers calls to this DID
              </FormHelperText>
            </FormControl>
          )}

          {/* ── Call Routing Section ── */}
          <FormSection label="Call Routing" />

          {/* Bridge Type */}
          <FormControl fullWidth required error={!!errors.bridge_type || (submitAttempted && !formData.bridge_type)} data-tour="did-bridge">
            <InputLabel required>Bridge Type</InputLabel>
            <Select
              value={formData.bridge_type || ''}
              label="Bridge Type"
              onChange={(e) => handleBridgeTypeChange(e.target.value)}
              MenuProps={menuProps(Z.L1)}
            >
              {bridgeTypes.map(type => (
                <MenuItem key={type} value={type}>{type.replace('_', ' ').toUpperCase()}</MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {(errors.bridge_type || (submitAttempted && !formData.bridge_type))
                ? (errors.bridge_type || 'Bridge type is required')
                : 'How incoming calls are routed — IVR, Queue, Announcement, etc.'}
            </FormHelperText>
          </FormControl>

          {/* Destination */}
          {formData.bridge_type === 'number' ? (
            <NumberSelector
              value={formData.bridge_uuid || ''}
              onChange={(uuid) => handleChange('bridge_uuid', uuid || '')}
              environmentUuid={formData.environment_uuid}
              label="Destination Number"
              placeholder="Search phone numbers..."
              required
              error={errors.bridge_uuid}
              helperText="Search for an existing number or create a new one"
            />
          ) : formData.bridge_type ? (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              <FormControl
                fullWidth
                required
                error={!!errors.bridge_uuid}
                disabled={!formData.bridge_type}
              >
                <InputLabel>Destination</InputLabel>
                <Select
                  value={formData.bridge_uuid || ''}
                  label="Destination"
                  onChange={(e) => handleBridgeChange(e.target.value)}
                  MenuProps={menuProps(Z.L1)}
                >
                  {['announcement', 'vml', 'call_condition', 'queue', 'ivr', 'bot'].includes(formData.bridge_type) && (
                    <MenuItem value="add_new" sx={{ color: 'primary.main', fontWeight: 600 }}>
                      + Create New {getBridgeTypeLabel(formData.bridge_type)}
                    </MenuItem>
                  )}
                  {(!bridgeResources[formData.bridge_type] || bridgeResources[formData.bridge_type].length === 0) && (
                    <MenuItem disabled>No {formData.bridge_type}s available</MenuItem>
                  )}
                  {(bridgeResources[formData.bridge_type] || []).map(option => (
                    <MenuItem key={option.uuid} value={option.uuid}>{option.name}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {errors.bridge_uuid || 'Select an existing resource or create a new one'}
                </FormHelperText>
              </FormControl>
              {formData.bridge_uuid && onDrillDown && (
                <Tooltip title={`Edit ${getBridgeTypeLabel(formData.bridge_type)}`}>
                  <IconButton
                    size="small"
                    color="primary"
                    sx={{ mt: 1 }}
                    onClick={() => {
                      const selected = (bridgeResources[formData.bridge_type] || []).find(r => r.uuid === formData.bridge_uuid);
                      onDrillDown({
                        type: formData.bridge_type,
                        mode: 'edit',
                        data: selected || { uuid: formData.bridge_uuid },
                        environmentUuid: formData.environment_uuid,
                        onResult: async () => {
                          if (onFetchBridgeResources) {
                            await onFetchBridgeResources(formData.bridge_type, formData.environment_uuid, true);
                          }
                        }
                      });
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              )}
              {onDrillDown && ['announcement', 'vml', 'call_condition', 'queue', 'ivr', 'bot'].includes(formData.bridge_type) && (
                <Tooltip title={`Create New ${getBridgeTypeLabel(formData.bridge_type)}`}>
                  <IconButton
                    size="small"
                    color="primary"
                    sx={{ mt: 1 }}
                    onClick={() => {
                      onDrillDown({
                        type: formData.bridge_type,
                        mode: 'create',
                        data: null,
                        environmentUuid: formData.environment_uuid,
                        onResult: async (savedData) => {
                          const uuid = savedData.uuid || savedData.id;
                          handleChange('bridge_uuid', uuid);
                          if (onFetchBridgeResources) {
                            await onFetchBridgeResources(formData.bridge_type, formData.environment_uuid, true);
                          }
                        }
                      });
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ) : null}

          {/* Routing Chain — below destination select */}
          {formData.bridge_type && formData.bridge_uuid && formData.bridge_type !== 'number' && (
            <div className="did-form-routing-container">
              <RoutingChain
                bridgeType={formData.bridge_type}
                bridgeUuid={formData.bridge_uuid}
                environmentUuid={formData.environment_uuid}
                onEditBridge={onDrillDown ? (type, data) => {
                  onDrillDown({
                    type,
                    mode: 'edit',
                    data,
                    environmentUuid: formData.environment_uuid,
                    onResult: async () => {
                      if (onFetchBridgeResources) {
                        await onFetchBridgeResources(formData.bridge_type, formData.environment_uuid, true);
                      }
                    }
                  });
                } : null}
              />
            </div>
          )}

          {/* ── Additional Section ── */}
          <FormSection label="Additional" />

          {/* Notes */}
          <TextField
            label="Notes"
            value={formData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Optional notes about this DID"
          />

          {/* Enabled toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={formData.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
              />
            }
            label="Enabled"
          />

          {/* Meta Properties */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography className="did-form-section-label">Meta Properties</Typography>
            <Button
              onClick={addMetaField}
              startIcon={<AddIcon />}
              variant="outlined"
              size="small"
              className="did-form-add-meta-btn"
            >
              Add
            </Button>
          </Box>

          {errors.meta && (
            <Alert severity="error">{errors.meta}</Alert>
          )}

          {metaFields.map((field, index) => (
            <Box key={index} className="did-form-meta-row">
              <TextField
                label="Key"
                value={field.key}
                onChange={(e) => updateMetaField(index, 'key', e.target.value)}
                error={!!errors[`meta_${field.key}`]}
                helperText={errors[`meta_${field.key}`] || ''}
                fullWidth
                size="small"
                placeholder="e.g. department"
              />
              <TextField
                label="Value"
                value={field.value}
                onChange={(e) => updateMetaField(index, 'value', e.target.value)}
                fullWidth
                size="small"
                placeholder="e.g. sales"
              />
              <IconButton onClick={() => removeMetaField(index)} color="error" size="small" sx={{ mt: 0.5 }}>
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}

          {metaFields.length === 0 && (
            <Typography className="did-form-meta-empty">
              No meta properties. Click &quot;Add&quot; to create key-value pairs.
            </Typography>
          )}

          {/* ── Action Buttons (used by WizardViewRenderer) ── */}
          {showActions && (
            <Box className="did-form-actions" sx={{ mt: 1 }}>
              <Button onClick={onCancel} className="did-form-cancel-btn">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                variant="contained"
                disabled={!isFormValid || loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                className="did-form-save-btn"
              >
                {did ? 'Update DID' : 'Create DID'}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
});

DIDForm.displayName = 'DIDForm';

export default DIDForm;
