import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  Alert,
  Box,
  Chip,
  MenuItem,
  Typography,
  Tooltip,
} from '@mui/material';
import { Close as CloseIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import { useState, useEffect, useCallback } from 'react';
import DynamicProfileEditor from '../common/DynamicProfileEditor/DynamicProfileEditor';
import SipInterfacesEditor, { editableInterface, interfaceErrors } from './SipInterfacesEditor.jsx';
import { nodesApi } from '../../services/api/nodesApi';

const EMPTY = {
  name: '',
  type: '',
  roles: [],
  notes: '',
  profile: {},
  sip_interfaces: [],
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
 *
 * Type and Roles offer only what the API lists (GET /api/nodes?action=types,
 * Node::TYPES / Node::ROLES) and it refuses anything else. Roles decide what a
 * node does; type is a label. The profile fields and their examples/patterns
 * come from the API's `node` field list, the SIP interfaces are a table, and
 * a malformed value in either blocks Save.
 */
const NodeEditDialog = ({ open, onClose, onSave, nodeData, loading }) => {
  const isCreate = !nodeData;

  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [catalog, setCatalog] = useState({ types: [], roles: [] });
  const [profileValid, setProfileValid] = useState(true);

  useEffect(() => {
    if (!open) return;
    const src = nodeData || {};
    setFormData({
      ...EMPTY,
      ...src,
      type: src.type || '',
      roles: Array.isArray(src.roles) ? src.roles : [],
      profile: src.profile && typeof src.profile === 'object' ? { ...src.profile } : {},
      sip_interfaces: Array.isArray(src.sip_interfaces) ? src.sip_interfaces.map(editableInterface) : [],
    });
    setErrors({});
    setApiError('');
    setSuccessMessage('');
  }, [nodeData, open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    nodesApi.getNodeCatalog()
      .then((c) => { if (!cancelled) setCatalog({ types: c?.types || [], roles: c?.roles || [] }); })
      .catch(() => { if (!cancelled) setCatalog({ types: [], roles: [] }); });
    return () => { cancelled = true; };
  }, [open]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // The profile is rendered from the API's `node` field list (profile.yml), the
  // same way the application dialog renders `environment`. The editor reports
  // only the fields it shows, so merge them over the stored profile: keys the
  // schema does not declare must survive a save, since PATCH replaces it whole.
  const handleProfileChange = useCallback((visible) => {
    setFormData((prev) => ({ ...prev, profile: { ...prev.profile, ...visible } }));
  }, []);

  // A stored value the list no longer carries is still shown, so opening an
  // older node does not silently blank it; the API refuses it only if re-sent
  // changed, and the user can pick a listed one.
  const typeOptions = [...new Set([...catalog.types, formData.type].filter(Boolean))];
  const roleOptions = [...new Set([...catalog.roles, ...formData.roles])];

  const validate = () => {
    const next = {};
    if (!formData.name?.trim()) next.name = 'Node name is required';
    if (Object.keys(interfaceErrors(formData.sip_interfaces)).length) next.sip_interfaces = true;
    if (!profileValid) next.profile = true;
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
        // '' clears it; the API reads a blank type as none.
        type: formData.type || '',
        roles: formData.roles,
        notes: formData.notes || undefined,
        profile,
        // The whole list: the API replaces a node's interfaces on every write.
        // Blank fields are dropped so a cleared port falls back to its default.
        sip_interfaces: (formData.sip_interfaces || []).map((iface) =>
          Object.fromEntries(Object.entries(iface).filter(([, v]) => v !== '' && v !== null && v !== undefined))
        ),
      });
      setSuccessMessage(isCreate ? 'Node created' : 'Node updated');
      setTimeout(() => onClose(), 1200);
    } catch (error) {
      setApiError(error?.message || 'Failed to save node');
    }
  };

  const handleClose = () => { if (!loading) onClose(); };
  const blocked = errors.sip_interfaces || errors.profile;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth data-testid="node-edit-dialog">
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
        {blocked && (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid="node-invalid">
            Fix the highlighted fields before saving.
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {!isCreate && formData.uuid && (
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70, fontWeight: 600 }}>UUID</Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>{formData.uuid}</Typography>
              <Tooltip title="Copy UUID">
                <IconButton size="small" onClick={() => navigator.clipboard?.writeText(formData.uuid)} sx={{ p: 0.25 }}>
                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          <TextField
            label="Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name || 'Unique across the deployment, e.g. pbx-il-1'}
            placeholder="pbx-il-1"
            disabled={loading}
            fullWidth
            required
            inputProps={{ 'data-testid': 'node-name' }}
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
            <TextField
              select
              label="Type"
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              helperText="A label; roles decide what the node does"
              disabled={loading}
              fullWidth
              SelectProps={{ SelectDisplayProps: { 'data-testid': 'node-type' } }}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {typeOptions.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>

            <TextField
              select
              label="Roles"
              value={formData.roles}
              onChange={(e) => handleChange('roles', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
              helperText="switch = runs FreeSWITCH for the customers homed on it"
              disabled={loading}
              fullWidth
              SelectProps={{
                multiple: true,
                SelectDisplayProps: { 'data-testid': 'node-roles' },
                renderValue: (selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((r) => <Chip key={r} label={r} size="small" />)}
                  </Box>
                ),
              }}
            >
              {roleOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
          </Box>

          <DynamicProfileEditor
            type="node"
            profile={formData.profile}
            onChange={handleProfileChange}
            onValidityChange={setProfileValid}
            disabled={loading}
            title="Profile Properties"
          />

          <SipInterfacesEditor
            value={formData.sip_interfaces}
            onChange={(list) => handleChange('sip_interfaces', list)}
            disabled={loading}
            showErrors={!!errors.sip_interfaces}
          />

          <TextField
            label="Notes"
            value={formData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            disabled={loading}
            fullWidth
            multiline
            minRows={2}
          />
        </Box>
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
