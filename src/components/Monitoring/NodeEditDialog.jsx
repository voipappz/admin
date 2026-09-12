import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Grid,
  Alert,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Tooltip,
} from '@mui/material';
import { Close as CloseIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import ArrayField from '../common/ArrayField/ArrayField';

// The node profile keys the platform reads (Profile::Node). Anything else a
// deployment puts in the profile is preserved untouched on save — only these
// are surfaced as fields.
const KNOWN_PROFILE_KEYS = ['ip_address_internal', 'ip_address_external', 'domain'];

const EMPTY = {
  name: '',
  type: '',
  notes: '',
  roles: [],
  profile: {},
  uuid: '',
  source: 'database',
  created_at: '',
  updated_at: '',
};

/**
 * Create/edit one node.
 *
 * Nodes are deployment infrastructure, not tenant data: the va.yaml served to a
 * node configures every customer homed on it, so the API only accepts writes
 * from a root account (VA_ROOT) — the caller gates the buttons, this dialog
 * surfaces whatever the API says when it refuses.
 */
const NodeEditDialog = ({ open, onClose, onSave, nodeData, loading }) => {
  const isCreate = !nodeData;

  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    const src = nodeData || {};
    setFormData({
      ...EMPTY,
      ...src,
      roles: Array.isArray(src.roles) ? src.roles : [],
      profile: src.profile && typeof src.profile === 'object' ? { ...src.profile } : {},
    });
    setErrors({});
    setApiError('');
    setSuccessMessage('');
  }, [nodeData, open]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleProfileChange = (key, value) => {
    setFormData((prev) => ({ ...prev, profile: { ...prev.profile, [key]: value } }));
  };

  const validate = () => {
    const next = {};
    if (!formData.name?.trim()) next.name = 'Node name is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setApiError('');
    setSuccessMessage('');
    try {
      // Blank profile values are dropped rather than stored as empty strings.
      const profile = {};
      Object.entries(formData.profile || {}).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) profile[k] = v;
      });
      await onSave({
        uuid: formData.uuid || undefined,
        name: formData.name.trim(),
        type: formData.type?.trim() || undefined,
        notes: formData.notes || undefined,
        roles: formData.roles,
        profile,
      });
      setSuccessMessage(isCreate ? 'Node created' : 'Node updated');
      setTimeout(() => onClose(), 1200);
    } catch (error) {
      setApiError(error?.message || 'Failed to save node');
    }
  };

  const handleClose = () => { if (!loading) onClose(); };

  const extraProfileKeys = Object.keys(formData.profile || {})
    .filter((k) => !KNOWN_PROFILE_KEYS.includes(k) && k !== 'vpc');

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth data-testid="node-edit-dialog">
      <DialogTitle sx={{ pr: 6 }}>
        {isCreate ? 'Add Node' : 'Edit Node'}
        <IconButton
          aria-label="close"
          onClick={handleClose}
          disabled={loading}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

        <Grid container spacing={2} direction="column">
          {!isCreate && formData.uuid && (
            <Grid item xs={12}>
              <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70, fontWeight: 600 }}>UUID</Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{formData.uuid}</Typography>
                <Tooltip title="Copy UUID">
                  <IconButton size="small" onClick={() => navigator.clipboard?.writeText(formData.uuid)} sx={{ p: 0.25 }}>
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
          )}

          <Grid item xs={12}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={!!errors.name}
              helperText={errors.name || 'Unique across the deployment'}
              disabled={loading}
              fullWidth
              required
              data-testid="node-name"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Type"
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              helperText="app, switch, egress, db — free-form; the platform matches on it"
              disabled={loading}
              fullWidth
              data-testid="node-type"
            />
          </Grid>

          <Grid item xs={12}>
            <ArrayField
              items={formData.roles}
              onChange={(roles) => handleChange('roles', roles)}
              label="Roles"
              addButtonText="Add Role"
              placeholder="app, switch, egress, db"
              helperText="What runs on this node. Dialplan templates and health checks gate on these."
              disabled={loading}
            />
          </Grid>

          {KNOWN_PROFILE_KEYS.map((key) => (
            <Grid item xs={12} key={key}>
              <TextField
                label={key.replace(/_/g, ' ')}
                value={formData.profile?.[key] ?? ''}
                onChange={(e) => handleProfileChange(key, e.target.value)}
                disabled={loading}
                fullWidth
                data-testid={`node-profile-${key}`}
              />
            </Grid>
          ))}

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={String(formData.profile?.vpc) === 'true'}
                  onChange={(e) => handleProfileChange('vpc', e.target.checked)}
                  disabled={loading}
                  data-testid="node-profile-vpc"
                />
              }
              label="In VPC (originate from the internal address)"
            />
          </Grid>

          {extraProfileKeys.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary">
                Other profile keys kept as-is: {extraProfileKeys.join(', ')}
              </Typography>
            </Grid>
          )}

          <Grid item xs={12}>
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              disabled={loading}
              fullWidth
              multiline
              minRows={2}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading} data-testid="node-save">
          {isCreate ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NodeEditDialog;
