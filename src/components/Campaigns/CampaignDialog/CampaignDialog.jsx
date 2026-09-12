import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  CircularProgress,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useCustomerEnvironment } from '../../../context/CustomerEnvironmentContext';
import { apiService } from '../../../services/apiService';
import { ivrApi } from '../../../services/api/ivrApi';
import { voipResourcesApi } from '../../../services/api/voipResourcesApi';
import IVRDialog from '../../DIDs/IVRDialog/IVRDialog';

const CampaignDialog = ({ open, onClose, onSave, campaign, loading, canWrite = true }) => {
  const { environments, selectedEnvironments } = useCustomerEnvironment();

  const [formData, setFormData] = useState({
    name: '',
    enabled: true,
    type: 'call',
    environment_uuid: '',
    ivr_uuid: '',
    notes: '',
    profile: {
      concurrent_limit: '',
      originate_rate_min: '',
      originate_rate_max: '',
      no_answer_retries: '',
      busy_retries: '',
      total_retries: '',
    }
  });

  const [ivrs, setIvrs] = useState([]);
  const [ivrsLoading, setIvrsLoading] = useState(false);

  // Inline IVR creation state
  const [ivrDialogOpen, setIvrDialogOpen] = useState(false);
  const [ivrSaving, setIvrSaving] = useState(false);
  const [bridgeTypes, setBridgeTypes] = useState([]);
  const [bridgeResources, setBridgeResources] = useState({});
  const bridgeResourcesRef = useRef(bridgeResources);
  bridgeResourcesRef.current = bridgeResources;

  // Initialize form data when dialog opens
  useEffect(() => {
    if (open) {
      if (campaign) {
        const profile = campaign.profile || {};
        setFormData({
          name: campaign.name || '',
          enabled: campaign.enabled !== undefined ? campaign.enabled : true,
          type: campaign.type || 'call',
          environment_uuid: campaign.environment_uuid || '',
          ivr_uuid: campaign.ivr_uuid || '',
          notes: campaign.notes || '',
          profile: {
            concurrent_limit: profile.concurrent_limit || '',
            originate_rate_min: profile.originate_rate_min || '',
            originate_rate_max: profile.originate_rate_max || '',
            no_answer_retries: profile.no_answer_retries || '',
            busy_retries: profile.busy_retries || '',
            total_retries: profile.total_retries || '',
          }
        });
      } else {
        setFormData({
          name: '',
          enabled: true,
          type: 'call',
          environment_uuid: selectedEnvironments?.[0]?.uuid || '',
          ivr_uuid: '',
          notes: '',
          profile: {
            concurrent_limit: '',
            originate_rate_min: '',
            originate_rate_max: '',
            no_answer_retries: '',
            busy_retries: '',
            total_retries: '',
          }
        });
      }
    }
  }, [open, campaign, selectedEnvironments]);

  // Fetch IVRs when environment changes
  const fetchIvrs = useCallback(async (envUuid) => {
    if (!envUuid) {
      setIvrs([]);
      return;
    }

    setIvrsLoading(true);
    try {
      const params = { 'search[environment_uuid]': envUuid, per_page: 999 };

      const queryParts = [];
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          queryParts.push(`${key}=${encodeURIComponent(value)}`);
        }
      }
      const queryString = queryParts.join('&');
      const url = `/api/ivrs?${queryString}`;

      const response = await apiService.get(url, {}, 'fetching IVRs for campaign', false);

      const ivrList = Array.isArray(response) ? response : (response?.data || []);
      setIvrs(ivrList);
    } catch (err) {
      console.error('Error fetching IVRs:', err);
      setIvrs([]);
    } finally {
      setIvrsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && formData.environment_uuid) {
      fetchIvrs(formData.environment_uuid);
    }
  }, [open, formData.environment_uuid, fetchIvrs]);

  // Fetch bridge types for IVR dialog (lazy load on first open)
  const fetchBridgeTypes = useCallback(async () => {
    if (bridgeTypes.length > 0) return;
    try {
      const response = await voipResourcesApi.getBridgeTypes();
      const types = Array.isArray(response) ? response : (response?.data || []);
      setBridgeTypes(types);
    } catch (err) {
      console.error('Error fetching bridge types:', err);
    }
  }, [bridgeTypes.length]);

  // Fetch bridge resources for IVR dialog dropdowns
  const fetchBridgeResources = useCallback(async (bridgeType, environmentUuid) => {
    if (!bridgeType) return [];
    const cached = bridgeResourcesRef.current[bridgeType];
    if (cached !== undefined) return cached;

    try {
      const params = environmentUuid ? { environment_uuid: environmentUuid } : {};
      const response = await voipResourcesApi.getResourcesByBridgeType(bridgeType, params);
      const resources = Array.isArray(response) ? response : (response?.data || []);
      setBridgeResources(prev => ({ ...prev, [bridgeType]: resources }));
      return resources;
    } catch (err) {
      console.error(`Error fetching ${bridgeType} resources:`, err);
      return [];
    }
  }, []);

  const handleChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'environment_uuid') {
      setFormData(prev => ({ ...prev, [field]: value, ivr_uuid: '' }));
    }
  };

  // Handle IVR dropdown selection — intercept "add_new"
  const handleIvrChange = (event) => {
    const value = event.target.value;
    if (value === 'add_new') {
      // Open inline IVR creation dialog
      fetchBridgeTypes();
      setBridgeResources({});
      setIvrDialogOpen(true);
    } else {
      setFormData(prev => ({ ...prev, ivr_uuid: value }));
    }
  };

  // Handle saving an inline-created IVR
  const handleInlineIvrSave = async (ivrData) => {
    setIvrSaving(true);
    try {
      const result = await ivrApi.createIVR(ivrData);
      const newUuid = result?.uuid || result?.data?.uuid;
      if (newUuid) {
        // Auto-select the new IVR and refresh the list
        setFormData(prev => ({ ...prev, ivr_uuid: newUuid }));
        await fetchIvrs(formData.environment_uuid);
      }
      setIvrDialogOpen(false);
    } catch (err) {
      console.error('Error creating inline IVR:', err);
      throw err; // Let IVRDialog handle the error display
    } finally {
      setIvrSaving(false);
    }
  };

  const handleProfileChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      profile: { ...prev.profile, [field]: value }
    }));
  };

  const handleSubmit = () => {
    const submitData = {
      name: formData.name,
      enabled: formData.enabled,
      type: formData.type,
      environment_uuid: formData.environment_uuid,
      ivr_uuid: formData.ivr_uuid,
      notes: formData.notes,
    };

    const profileFields = {};
    Object.entries(formData.profile).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) {
        profileFields[key] = value;
      }
    });
    if (Object.keys(profileFields).length > 0) {
      submitData.profile = profileFields;
    }

    onSave(submitData);
  };

  const isEdit = !!campaign;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {isEdit ? 'Edit Campaign' : 'Create Campaign'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Name */}
            <TextField
              label="Name"
              value={formData.name}
              onChange={handleChange('name')}
              required
              fullWidth
              size="small"
            />

            {/* Enabled */}
            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={handleChange('enabled')}
                />
              }
              label="Enabled"
            />

            {/* Type */}
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                onChange={handleChange('type')}
                label="Type"
              >
                <MenuItem value="call">Call</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
              </Select>
            </FormControl>

            {/* Environment */}
            <FormControl fullWidth size="small">
              <InputLabel>Application</InputLabel>
              <Select
                value={formData.environment_uuid}
                onChange={handleChange('environment_uuid')}
                label="Application"
                required
              >
                {(environments || []).map(env => (
                  <MenuItem key={env.uuid} value={env.uuid}>
                    {env.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* IVR Destination — with inline "Create New IVR" option */}
            <FormControl fullWidth size="small">
              <InputLabel>IVR Destination</InputLabel>
              <Select
                value={formData.ivr_uuid}
                onChange={handleIvrChange}
                label="IVR Destination"
                disabled={ivrsLoading || !formData.environment_uuid}
              >
                {ivrsLoading ? (
                  <MenuItem disabled>
                    <CircularProgress size={16} sx={{ mr: 1 }} /> Loading...
                  </MenuItem>
                ) : (
                  [
                    ...ivrs.map(ivr => (
                      <MenuItem key={ivr.uuid} value={ivr.uuid}>
                        {ivr.name}
                      </MenuItem>
                    )),
                    <MenuItem key="add_new" value="add_new" sx={{ color: 'primary.main', fontWeight: 600 }}>
                      + Create New IVR
                    </MenuItem>
                  ]
                )}
              </Select>
              <FormHelperText>IVR script to play when call connects</FormHelperText>
            </FormControl>

            {/* Notes */}
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={handleChange('notes')}
              multiline
              rows={2}
              fullWidth
              size="small"
            />

            {/* Profile Settings - Collapsible */}
            <Accordion sx={{ mt: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Profile Settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Concurrent Limit"
                    type="number"
                    value={formData.profile.concurrent_limit}
                    onChange={handleProfileChange('concurrent_limit')}
                    fullWidth
                    size="small"
                    inputProps={{ min: 0 }}
                    helperText="Maximum simultaneous active calls"
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Min Originate Rate"
                      type="number"
                      value={formData.profile.originate_rate_min}
                      onChange={handleProfileChange('originate_rate_min')}
                      fullWidth
                      size="small"
                      inputProps={{ min: 0 }}
                      helperText="Minimum calls per second"
                    />
                    <TextField
                      label="Max Originate Rate"
                      type="number"
                      value={formData.profile.originate_rate_max}
                      onChange={handleProfileChange('originate_rate_max')}
                      fullWidth
                      size="small"
                      inputProps={{ min: 0 }}
                      helperText="Maximum calls per second"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="No Answer Retries"
                      type="number"
                      value={formData.profile.no_answer_retries}
                      onChange={handleProfileChange('no_answer_retries')}
                      fullWidth
                      size="small"
                      inputProps={{ min: 0 }}
                      helperText="Retry attempts for unanswered calls"
                    />
                    <TextField
                      label="Busy Retries"
                      type="number"
                      value={formData.profile.busy_retries}
                      onChange={handleProfileChange('busy_retries')}
                      fullWidth
                      size="small"
                      inputProps={{ min: 0 }}
                      helperText="Retry attempts for busy signals"
                    />
                  </Box>
                  <TextField
                    label="Total Retries"
                    type="number"
                    value={formData.profile.total_retries}
                    onChange={handleProfileChange('total_retries')}
                    fullWidth
                    size="small"
                    inputProps={{ min: 0 }}
                    helperText="Maximum total retry attempts"
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!canWrite || loading || !formData.name || !formData.environment_uuid}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Inline IVR Creation Dialog */}
      <IVRDialog
        open={ivrDialogOpen}
        onClose={() => setIvrDialogOpen(false)}
        onSave={handleInlineIvrSave}
        loading={ivrSaving}
        ivr={null}
        bridgeTypes={bridgeTypes}
        bridgeResources={bridgeResources}
        onFetchBridgeResources={fetchBridgeResources}
      />
    </>
  );
};

export default CampaignDialog;
