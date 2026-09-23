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
  Box,
  Typography,
  Tooltip,
} from '@mui/material';
import { Close as CloseIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import { useState, useEffect } from 'react';
import DynamicProfileEditor from '../common/DynamicProfileEditor/DynamicProfileEditor';

const EMPTY = {
  name: '',
  type: '',
  notes: '',
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

  // The profile is rendered from the API's `node` field list (profile.yml), the
  // same way the application dialog renders `environment`. The editor reports
  // only the fields it shows, so merge them over the stored profile: keys the
  // schema does not declare must survive a save, since PATCH replaces it whole.
  const handleProfileChange = (visible) => {
    setFormData((prev) => ({ ...prev, profile: { ...prev.profile, ...visible } }));
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
        profile,
      });
      setSuccessMessage(isCreate ? 'Node created' : 'Node updated');
      setTimeout(() => onClose(), 1200);
    } catch (error) {
      setApiError(error?.message || 'Failed to save node');
    }
  };

  const handleClose = () => { if (!loading) onClose(); };

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
            <DynamicProfileEditor
              type="node"
              profile={formData.profile}
              onChange={handleProfileChange}
              disabled={loading}
              title="Profile Properties"
            />
          </Grid>

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
