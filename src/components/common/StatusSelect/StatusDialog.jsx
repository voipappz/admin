import { useState, useEffect, useCallback } from 'react';
import { parseServerErrors, is406Error } from '../../../utils/formValidation';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  CircularProgress,
  Alert,
  Typography,
  FormControlLabel,
  Switch
} from '@mui/material';

/**
 * StatusDialog Component
 * Dialog for creating or editing statuses
 *
 * Props:
 * - open: Boolean - Dialog visibility
 * - onClose: Function - Close handler
 * - onSave: Function - Save handler (receives status data)
 * - mode: 'create' | 'edit' - Dialog mode
 * - status: Object - Status data for edit mode
 * - saving: Boolean - Save in progress
 * - error: String - Error message
 */
const StatusDialog = ({
  open,
  onClose,
  onSave,
  mode = 'create',
  status = null,
  saving = false,
  error = null
}) => {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    color: '#1976d2',
    enabled: true,
    notes: ''
  });

  // Form validation
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Initialize form data when dialog opens or status changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && status) {
        setFormData({
          name: status.name || '',
          color: status.color || '#1976d2',
          enabled: status.enabled !== undefined ? status.enabled : true,
          notes: status.notes || ''
        });
      } else {
        setFormData({
          name: '',
          color: '#1976d2',
          enabled: true,
          notes: ''
        });
      }
      setErrors({});
      setSubmitAttempted(false);
    }
  }, [open, mode, status]);

  // Handle field changes
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear field error
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  }, [errors]);

  // Validate form
  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle save
  const handleSave = useCallback(async () => {
    setSubmitAttempted(true);
    if (!validate()) return;

    try {
      await onSave({
        name: formData.name.trim(),
        color: formData.color,
        enabled: formData.enabled,
        notes: formData.notes.trim()
      });
    } catch (error) {
      // Parse 406 server validation errors
      if (is406Error(error)) {
        const serverErrors = parseServerErrors(error);
        if (Object.keys(serverErrors).length > 0) {
          setErrors(prev => ({ ...prev, ...serverErrors }));
        }
      }
    }
  }, [formData, validate, onSave]);

  // Handle close
  const handleClose = useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [saving, onClose]);

  const isEdit = mode === 'edit';
  const title = isEdit ? `Edit Status: ${status?.name || ''}` : 'Create New Status';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">{title}</Typography>
          {saving && <CircularProgress size={20} />}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Name field */}
          <TextField
            label="Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={!!errors.name || (submitAttempted && !formData.name?.trim())}
            helperText={errors.name || (submitAttempted && !formData.name?.trim() ? 'Name is required' : '')}
            disabled={saving}
            required
            fullWidth
            autoFocus
          />

          {/* Color field */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              label="Color"
              value={formData.color}
              onChange={(e) => handleChange('color', e.target.value)}
              disabled={saving}
              fullWidth
              placeholder="#1976d2"
            />
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1,
                backgroundColor: formData.color || '#1976d2',
                border: '1px solid',
                borderColor: 'divider',
                flexShrink: 0
              }}
            />
            <input
              type="color"
              value={formData.color || '#1976d2'}
              onChange={(e) => handleChange('color', e.target.value)}
              style={{
                width: 40,
                height: 40,
                padding: 0,
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0
              }}
              disabled={saving}
            />
          </Box>

          {/* Enabled toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={formData.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                disabled={saving}
              />
            }
            label="Enabled"
          />

          {/* Notes field */}
          <TextField
            label="Notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            disabled={saving}
            multiline
            rows={2}
            fullWidth
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !formData.name}
        >
          {saving ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Saving...
            </>
          ) : isEdit ? (
            'Save Changes'
          ) : (
            'Create Status'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StatusDialog;
