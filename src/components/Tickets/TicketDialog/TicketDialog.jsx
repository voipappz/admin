import { useState, useEffect } from 'react';
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
  Chip,
  Typography,
} from '@mui/material';
import { useCustomerEnvironment } from '../../../context/CustomerEnvironmentContext';
import { useAuth } from '../../../context/AuthContext';

/**
 * TicketDialog Component
 * Dialog for creating new support tickets
 */
const TicketDialog = ({
  open,
  onClose,
  onSubmit,
  loading,
}) => {
  const { selectedCustomer, selectedEnvironments } = useCustomerEnvironment();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'normal',
    category: '',
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setFormData({
        subject: '',
        description: '',
        priority: 'normal',
        category: '',
      });
      setErrors({});
      setSubmitError('');
    }
  }, [open]);

  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const categoryOptions = [
    { value: '', label: 'Select Category (Optional)' },
    { value: 'billing', label: 'Billing' },
    { value: 'technical', label: 'Technical Support' },
    { value: 'feature_request', label: 'Feature Request' },
    { value: 'other', label: 'Other' },
  ];

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value,
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    setSubmitError('');
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (formData.subject.length < 5) {
      newErrors.subject = 'Subject must be at least 5 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      // Build tags array with category and environment info
      const tags = [];
      if (formData.category) {
        tags.push(`category:${formData.category}`);
      }
      // Add environment tags
      selectedEnvironments?.forEach(env => {
        if (env.uuid) tags.push(`environment:${env.uuid}`);
      });

      // Append environment and customer context to description
      const envNames = selectedEnvironments?.map(e => e.name).filter(Boolean) || [];
      let description = formData.description.trim();
      if (envNames.length > 0 || selectedCustomer?.name) {
        description += '\n\n---';
        if (envNames.length > 0) description += `\nTenant: ${envNames.join(', ')}`;
        if (selectedCustomer?.name) description += `\nCustomer: ${selectedCustomer.name}`;
      }

      await onSubmit({
        subject: formData.subject.trim(),
        description,
        priority: formData.priority,
        tags,
        requester_email: user?.email,
      });
    } catch (error) {
      setSubmitError(error.message || 'Failed to create ticket');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle>Create Support Ticket</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {submitError && (
            <Alert severity="error" onClose={() => setSubmitError('')}>
              {submitError}
            </Alert>
          )}

          {/* Show current context */}
          {(selectedCustomer || selectedEnvironments?.length > 0) && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">Context:</Typography>
              {selectedCustomer?.name && (
                <Chip label={selectedCustomer.name} size="small" variant="outlined" color="primary" />
              )}
              {selectedEnvironments?.map(env => (
                <Chip key={env.uuid} label={env.name} size="small" variant="outlined" />
              ))}
            </Box>
          )}

          <TextField
            label="Subject"
            value={formData.subject}
            onChange={handleChange('subject')}
            error={!!errors.subject}
            helperText={errors.subject || 'Brief summary of your issue'}
            fullWidth
            required
            autoFocus
            disabled={loading}
          />

          <TextField
            label="Description"
            value={formData.description}
            onChange={handleChange('description')}
            error={!!errors.description}
            helperText={errors.description || 'Provide details about your issue'}
            fullWidth
            required
            multiline
            rows={6}
            disabled={loading}
          />

          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={formData.priority}
              label="Priority"
              onChange={handleChange('priority')}
              disabled={loading}
            >
              {priorityOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.category}
              label="Category"
              onChange={handleChange('category')}
              disabled={loading}
            >
              {categoryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Creating...' : 'Create Ticket'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TicketDialog;
