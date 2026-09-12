import { useState, useEffect, useCallback } from 'react';
import { parseServerErrors, is406Error } from '../../../utils/formValidation';
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
  Box,
  CircularProgress,
  Alert,
  Typography,
  Divider
} from '@mui/material';
import PermissionsTable from './PermissionsTable';

/**
 * ACLDialog Component
 * Dialog for creating or editing ACLs with permissions configuration
 *
 * Props:
 * - open: Boolean - Dialog visibility
 * - onClose: Function - Close handler
 * - onSave: Function - Save handler (receives ACL data)
 * - mode: 'create' | 'edit' - Dialog mode
 * - acl: Object - ACL data for edit mode
 * - types: Array - Available ACL types
 * - typesLoading: Boolean - Types loading state
 * - typeData: Object - Permissions structure for selected type
 * - typeDataLoading: Boolean - Type data loading state
 * - onTypeChange: Function - Handler for type selection change
 * - saving: Boolean - Save in progress
 * - error: String - Error message
 */
const ACLDialog = ({
  open,
  onClose,
  onSave,
  mode = 'create',
  acl = null,
  types = [],
  typesLoading = false,
  typeData = null,
  typeDataLoading = false,
  onTypeChange,
  saving = false,
  error = null
}) => {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    notes: '',
    data: {}
  });

  // Form validation
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Initialize form data when dialog opens or ACL changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && acl) {
        setFormData({
          name: acl.name || '',
          type: acl.type || '',
          notes: acl.notes || '',
          data: acl.data || {}
        });
      } else {
        setFormData({
          name: '',
          type: '',
          notes: '',
          data: {}
        });
      }
      setErrors({});
      setSubmitAttempted(false);
    }
  }, [open, mode, acl]);

  // Handle field changes
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear field error
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }

    // Trigger type change handler
    if (field === 'type' && onTypeChange) {
      onTypeChange(value);
      // Reset permissions when type changes
      setFormData(prev => ({ ...prev, type: value, data: {} }));
    }
  }, [errors, onTypeChange]);

  // Handle permissions change
  const handlePermissionsChange = useCallback((newData) => {
    setFormData(prev => ({ ...prev, data: newData }));
  }, []);

  // Validate form
  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.type) {
      newErrors.type = 'Type is required';
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
        type: formData.type,
        notes: formData.notes.trim(),
        data: formData.data
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
  const title = isEdit ? `Edit ACL: ${acl?.name || ''}` : 'Create New ACL';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
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

          {/* Type field */}
          <FormControl
            fullWidth
            error={!!errors.type || (submitAttempted && !formData.type)}
            disabled={saving || typesLoading || (isEdit && Boolean(acl?.type))}
          >
            <InputLabel required>Type</InputLabel>
            <Select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              label="Type"
            >
              {typesLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Loading types...
                </MenuItem>
              ) : (
                types.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))
              )}
            </Select>
            {(errors.type || (submitAttempted && !formData.type)) && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                {errors.type || 'Type is required'}
              </Typography>
            )}
          </FormControl>

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

          <Divider sx={{ my: 1 }} />

          {/* Permissions table */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Permissions Configuration
            </Typography>
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden'
              }}
            >
              <PermissionsTable
                typeData={typeData}
                value={formData.data}
                onChange={handlePermissionsChange}
                loading={typeDataLoading}
                disabled={saving || !formData.type}
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !formData.name || !formData.type}
        >
          {saving ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Saving...
            </>
          ) : isEdit ? (
            'Save Changes'
          ) : (
            'Create ACL'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ACLDialog;
