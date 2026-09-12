import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  Alert
} from '@mui/material';
import {
  Menu as MenuIcon
} from '@mui/icons-material';
import { useCustomerEnvironment } from '../../../context/CustomerEnvironmentContext';
import IVREntriesSection from './IVREntriesSection';
import { parseServerErrors, is406Error } from '../../../utils/formValidation';

/**
 * IVR Dialog Component
 * Dialog for creating/editing IVRs based on legacy AngularJS patterns
 * Leverages existing DIDDialog patterns and CustomerEnvironmentContext
 */
const IVRDialog = ({ 
  ivr, 
  open, 
  onClose, 
  onSave, 
  loading,
  bridgeTypes = [],
  bridgeResources = {},
  onFetchBridgeResources 
}) => {
  const { selectedEnvironments } = useCustomerEnvironment();
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [apiError, setApiError] = useState('');

  // Initialize form data based on legacy pattern
  useEffect(() => {
    if (ivr) {
      setFormData({
        name: ivr.name || '',
        environment_uuid: ivr.environment_uuid || '',
        announcement_uuid: ivr.announcement_uuid || '',
        timeout: ivr.timeout || 10,
        timeout_bridge_type: ivr.timeout_bridge_type || '',
        timeout_bridge_uuid: ivr.timeout_bridge_uuid || '',
        invalid_bridge_type: ivr.invalid_bridge_type || '',
        invalid_bridge_uuid: ivr.invalid_bridge_uuid || '',
        entries: ivr.entries || {},
        enabled: ivr.enabled !== undefined ? ivr.enabled : true
      });
    } else {
      setFormData({
        name: '',
        environment_uuid: selectedEnvironments?.[0]?.uuid || '',
        announcement_uuid: '',
        timeout: 10,
        timeout_bridge_type: '',
        timeout_bridge_uuid: '',
        invalid_bridge_type: '',
        invalid_bridge_uuid: '',
        entries: {},
        enabled: true
      });
    }
    setErrors({});
    setSubmitAttempted(false);
    setApiError('');
  }, [ivr, open, selectedEnvironments]);

  // Load announcements when environment changes
  useEffect(() => {
    if (formData.environment_uuid && open) {
      onFetchBridgeResources('announcement', formData.environment_uuid);
    }
  }, [formData.environment_uuid, open, onFetchBridgeResources]);

  // Environment change handler - resets dependent fields
  const handleEnvironmentChange = (environmentUuid) => {
    setFormData(prev => ({
      ...prev,
      environment_uuid: environmentUuid,
      announcement_uuid: '',       // Reset announcement
      timeout_bridge_uuid: '',     // Reset timeout destination  
      invalid_bridge_uuid: '',     // Reset invalid destination
      // Reset all entry destinations
      entries: Object.keys(prev.entries).reduce((acc, key) => {
        acc[key] = {
          ...prev.entries[key],
          bridge_uuid: ''
        };
        return acc;
      }, {})
    }));
    
    // Load announcements for new environment
    if (environmentUuid) {
      onFetchBridgeResources('announcement', environmentUuid);
    }
  };

  // Bridge type change handler - resets UUID when type changes
  const handleBridgeTypeChange = (field, bridgeType) => {
    const uuidField = field.replace('_type', '_uuid');
    
    setFormData(prev => ({
      ...prev,
      [field]: bridgeType,
      [uuidField]: '' // Reset UUID when type changes
    }));
    
    // Fetch resources for new bridge type
    if (bridgeType && formData.environment_uuid) {
      onFetchBridgeResources(bridgeType, formData.environment_uuid);
    }
  };

  // Handle entries change
  const handleEntriesChange = (newEntries) => {
    setFormData(prev => ({ ...prev, entries: newEntries }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setApiError('');

    // Basic validation
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.environment_uuid) {
      newErrors.environment_uuid = 'Application is required';
    }
    
    if (!formData.announcement_uuid) {
      newErrors.announcement_uuid = 'Announcement is required';
    }
    
    if (!formData.timeout || formData.timeout <= 0) {
      newErrors.timeout = 'Timeout must be greater than 0';
    }

    // Validate entries
    if (formData.entries && Object.keys(formData.entries).length > 0) {
      Object.keys(formData.entries).forEach(entryNumber => {
        const entry = formData.entries[entryNumber];
        
        if (!entry.name.trim()) {
          newErrors[`entry_name_${entryNumber}`] = 'Entry name is required';
        }
        
        if (!entry.bridge_type) {
          newErrors[`entry_bridge_type_${entryNumber}`] = 'Bridge type is required';
        }
        
        if (entry.bridge_type && entry.bridge_type !== 'number' && !entry.bridge_uuid) {
          newErrors[`entry_bridge_uuid_${entryNumber}`] = 'Bridge is required';
        }
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Transform entries for API submission (same as legacy)
    const transformedData = {
      ...formData,
      entries: Object.keys(formData.entries).length > 0 ? formData.entries : null
    };

    try {
      await onSave(transformedData);
    } catch (error) {
      console.error('Save error:', error);
      // Parse 406 validation errors from server
      if (is406Error(error)) {
        const serverErrors = parseServerErrors(error);
        if (Object.keys(serverErrors).length > 0) {
          setErrors(prev => ({ ...prev, ...serverErrors }));
        }
      }
      setApiError(error?.response?.data?.message || error?.message || 'Failed to save IVR');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      onKeyDown={handleKeyDown}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <MenuIcon color="primary" />
          {ivr ? 'Edit IVR' : 'Create New IVR'}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {apiError}
          </Alert>
        )}
        <Box display="flex" flexDirection="column" gap={2} sx={{ pt: 1 }}>
          {/* UUID Field - Read Only (only shown in edit mode) */}
          {ivr?.uuid && (
            <TextField
              label="UUID"
              fullWidth
              value={ivr.uuid}
              disabled
              InputProps={{
                readOnly: true,
                sx: {
                  fontFamily: 'monospace',
                  backgroundColor: 'action.hover'
                }
              }}
              size="small"
            />
          )}

          {/* Basic Information */}
          <Typography variant="h6" color="primary" gutterBottom>
            Basic Information
          </Typography>

          <TextField
            fullWidth
            label="Name"
            required
            value={formData.name || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={!!errors.name || (submitAttempted && !formData.name?.trim())}
            helperText={errors.name || (submitAttempted && !formData.name?.trim() ? 'Name is required' : '')}
            placeholder="Enter IVR name"
          />

          <FormControl fullWidth required error={!!errors.environment_uuid || (submitAttempted && !formData.environment_uuid)}>
            <InputLabel required>Application</InputLabel>
            <Select
              value={formData.environment_uuid || ''}
              onChange={(e) => handleEnvironmentChange(e.target.value)}
              label="Application"
            >
              <MenuItem value="">
                <em>Select Application</em>
              </MenuItem>
              {selectedEnvironments.map(env => (
                <MenuItem key={env.uuid} value={env.uuid}>
                  {env.name}
                </MenuItem>
              ))}
            </Select>
            {(errors.environment_uuid || (submitAttempted && !formData.environment_uuid)) && (
              <FormHelperText>{errors.environment_uuid || 'Application is required'}</FormHelperText>
            )}
          </FormControl>

          <FormControl fullWidth required error={!!errors.announcement_uuid || (submitAttempted && !formData.announcement_uuid)}>
            <InputLabel required>Announcement</InputLabel>
            <Select
              value={formData.announcement_uuid || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, announcement_uuid: e.target.value }))}
              disabled={!formData.environment_uuid}
              label="Announcement"
            >
              <MenuItem value="">
                <em>Select Announcement</em>
              </MenuItem>
              {(bridgeResources.announcement || []).map(announcement => (
                <MenuItem key={announcement.uuid} value={announcement.uuid}>
                  {announcement.name}
                </MenuItem>
              ))}
            </Select>
            {(errors.announcement_uuid || (submitAttempted && !formData.announcement_uuid)) && (
              <FormHelperText>{errors.announcement_uuid || 'Announcement is required'}</FormHelperText>
            )}
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={formData.enabled || false}
                onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
              />
            }
            label="Enabled"
          />

          {/* Timeout Configuration */}
          <Typography variant="h6" color="primary" gutterBottom sx={{ mt: 2 }}>
            Timeout Configuration
          </Typography>

          <Box display="flex" gap={2} alignItems="start" flexWrap="wrap">
            <TextField
              label="Timeout (seconds) *"
              type="number"
              value={formData.timeout || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value) || 0 }))}
              error={!!errors.timeout}
              helperText={errors.timeout}
              sx={{ minWidth: '150px' }}
              inputProps={{ min: 1 }}
            />
            
            <FormControl sx={{ minWidth: '200px' }}>
              <InputLabel>Timeout Action</InputLabel>
              <Select
                value={formData.timeout_bridge_type || ''}
                onChange={(e) => handleBridgeTypeChange('timeout_bridge_type', e.target.value)}
                label="Timeout Action"
                disabled={!formData.environment_uuid}
              >
                <MenuItem value="">
                  <em>Select Action</em>
                </MenuItem>
                {bridgeTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: '200px' }}>
              <InputLabel>Destination</InputLabel>
              <Select
                value={formData.timeout_bridge_uuid || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, timeout_bridge_uuid: e.target.value }))}
                disabled={!formData.timeout_bridge_type}
                label="Destination"
              >
                <MenuItem value="">
                  <em>Select Destination</em>
                </MenuItem>
                {(bridgeResources[formData.timeout_bridge_type] || []).map(resource => (
                  <MenuItem key={resource.uuid} value={resource.uuid}>
                    {resource.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Invalid Entry Handling */}
          <Typography variant="h6" color="primary" gutterBottom sx={{ mt: 2 }}>
            Invalid Entry Handling
          </Typography>

          <Box display="flex" gap={2} alignItems="start" flexWrap="wrap">
            <FormControl sx={{ minWidth: '200px' }}>
              <InputLabel>Invalid Action</InputLabel>
              <Select
                value={formData.invalid_bridge_type || ''}
                onChange={(e) => handleBridgeTypeChange('invalid_bridge_type', e.target.value)}
                label="Invalid Action"
                disabled={!formData.environment_uuid}
              >
                <MenuItem value="">
                  <em>Select Action</em>
                </MenuItem>
                {bridgeTypes.map(type => (
                  <MenuItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{ minWidth: '200px' }}>
              <InputLabel>Destination</InputLabel>
              <Select
                value={formData.invalid_bridge_uuid || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, invalid_bridge_uuid: e.target.value }))}
                disabled={!formData.invalid_bridge_type}
                label="Destination"
              >
                <MenuItem value="">
                  <em>Select Destination</em>
                </MenuItem>
                {(bridgeResources[formData.invalid_bridge_type] || []).map(resource => (
                  <MenuItem key={resource.uuid} value={resource.uuid}>
                    {resource.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Menu Entries */}
          <IVREntriesSection
            entries={formData.entries || {}}
            onChange={handleEntriesChange}
            bridgeTypes={bridgeTypes}
            bridgeResources={bridgeResources}
            onFetchBridgeResources={onFetchBridgeResources}
            environmentUuid={formData.environment_uuid}
            errors={errors}
          />

        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit} 
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <MenuIcon />}
        >
          {loading ? 'Saving...' : (ivr ? 'Update IVR' : 'Create IVR')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IVRDialog;