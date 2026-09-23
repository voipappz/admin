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
  FormControlLabel,
  Switch,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  MonitorHeart as MonitorIcon
} from '@mui/icons-material';
import { QUERY_TYPES, OPERATORS, INTERVALS } from '../../../services/api/monitorsApi';

/**
 * MonitorDialog Component
 * Dialog for creating/editing monitors with query configuration
 */
const MonitorDialog = ({
  open,
  onClose,
  onSave,
  monitor = null,
  loading = false,
  canWrite = true
}) => {
  const [formData, setFormData] = useState({
    name: '',
    query_type: 'sql',
    query: '',
    interval: 300,
    threshold: 0,
    operator: 'gt',
    enabled: true,
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  // Initialize form data when monitor changes
  useEffect(() => {
    if (open) {
      if (monitor) {
        setFormData({
          name: monitor.name || '',
          query_type: monitor.query_type || 'sql',
          query: monitor.query || '',
          interval: monitor.interval || 300,
          threshold: monitor.threshold || 0,
          operator: monitor.operator || 'gt',
          enabled: monitor.enabled !== undefined ? monitor.enabled : true,
          notes: monitor.notes || ''
        });
      } else {
        setFormData({
          name: '',
          query_type: 'sql',
          query: '',
          interval: 300,
          threshold: 0,
          operator: 'gt',
          enabled: true,
          notes: ''
        });
      }
      setErrors({});
      setApiError('');
    }
  }, [open, monitor]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.query?.trim()) {
      newErrors.query = 'Query is required';
    }

    if (formData.threshold === undefined || formData.threshold === '') {
      newErrors.threshold = 'Threshold is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setApiError('');

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      setApiError(error.message || 'Failed to save monitor');
    }
  };

  // Get placeholder query based on type
  const getQueryPlaceholder = () => {
    switch (formData.query_type) {
      case 'sql':
        return `SELECT COUNT(*) FROM calls
WHERE created_at > NOW() - INTERVAL '1 hour'
AND status = 'completed'`;
      case 'http':
        return 'https://api.example.com/health';
      case 'metric':
        return 'calls_per_hour';
      default:
        return 'Enter your query...';
    }
  };

  const isEdit = !!monitor;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1e293b',
          color: '#fff'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MonitorIcon sx={{ color: '#22c55e' }} />
            <Typography variant="h6">
              {isEdit ? 'Edit Monitor' : 'Add Monitor'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'var(--mui-palette-text-secondary)' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          {/* Name */}
          <TextField
            label="Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            fullWidth
            error={!!errors.name}
            helperText={errors.name}
            placeholder="e.g., Calls per Hour"
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: '#374151' },
                '&:hover fieldset': { borderColor: '#4b5563' },
                '&.Mui-focused fieldset': { borderColor: '#22c55e' }
              },
              '& .MuiInputLabel-root': { color: 'var(--mui-palette-text-secondary)' },
              '& .MuiFormHelperText-root': { color: '#ef4444' }
            }}
          />

          {/* Query Type */}
          <FormControl fullWidth>
            <InputLabel sx={{ color: 'var(--mui-palette-text-secondary)' }}>Query Type</InputLabel>
            <Select
              value={formData.query_type}
              label="Query Type"
              onChange={(e) => handleChange('query_type', e.target.value)}
              disabled={loading}
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#374151' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#22c55e' },
                '& .MuiSvgIcon-root': { color: 'var(--mui-palette-text-secondary)' }
              }}
            >
              {QUERY_TYPES.map(type => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Query */}
          <TextField
            label="Query"
            value={formData.query}
            onChange={(e) => handleChange('query', e.target.value)}
            required
            fullWidth
            multiline
            rows={4}
            error={!!errors.query}
            helperText={errors.query || (formData.query_type === 'sql' ? 'SQL query that returns a numeric value' : '')}
            placeholder={getQueryPlaceholder()}
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                '& fieldset': { borderColor: '#374151' },
                '&:hover fieldset': { borderColor: '#4b5563' },
                '&.Mui-focused fieldset': { borderColor: '#22c55e' }
              },
              '& .MuiInputLabel-root': { color: 'var(--mui-palette-text-secondary)' },
              '& .MuiFormHelperText-root': { color: errors.query ? '#ef4444' : '#64748b' }
            }}
          />

          {/* Interval */}
          <FormControl fullWidth>
            <InputLabel sx={{ color: 'var(--mui-palette-text-secondary)' }}>Check Interval</InputLabel>
            <Select
              value={formData.interval}
              label="Check Interval"
              onChange={(e) => handleChange('interval', e.target.value)}
              disabled={loading}
              sx={{
                color: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#374151' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#22c55e' },
                '& .MuiSvgIcon-root': { color: 'var(--mui-palette-text-secondary)' }
              }}
            >
              {INTERVALS.map(interval => (
                <MenuItem key={interval.value} value={interval.value}>
                  {interval.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Threshold Row */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Typography sx={{ color: 'var(--mui-palette-text-secondary)', pt: 2, whiteSpace: 'nowrap' }}>
              Alert when value
            </Typography>
            <FormControl sx={{ minWidth: 100 }}>
              <Select
                value={formData.operator}
                onChange={(e) => handleChange('operator', e.target.value)}
                disabled={loading}
                size="small"
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#374151' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4b5563' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#22c55e' },
                  '& .MuiSvgIcon-root': { color: 'var(--mui-palette-text-secondary)' }
                }}
              >
                {OPERATORS.map(op => (
                  <MenuItem key={op.value} value={op.value}>
                    {op.label} ({op.description})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              type="number"
              value={formData.threshold}
              onChange={(e) => handleChange('threshold', parseFloat(e.target.value) || 0)}
              error={!!errors.threshold}
              helperText={errors.threshold}
              disabled={loading}
              size="small"
              sx={{
                width: 120,
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: '#374151' },
                  '&:hover fieldset': { borderColor: '#4b5563' },
                  '&.Mui-focused fieldset': { borderColor: '#22c55e' }
                },
                '& .MuiFormHelperText-root': { color: '#ef4444' }
              }}
            />
          </Box>

          {/* Notes */}
          <TextField
            label="Notes (optional)"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Additional notes about this monitor..."
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: '#374151' },
                '&:hover fieldset': { borderColor: '#4b5563' },
                '&.Mui-focused fieldset': { borderColor: '#22c55e' }
              },
              '& .MuiInputLabel-root': { color: 'var(--mui-palette-text-secondary)' }
            }}
          />

          {/* Enabled Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={formData.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                disabled={loading}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#22c55e'
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#22c55e'
                  }
                }}
              />
            }
            label="Enabled"
            sx={{ color: '#fff' }}
          />

          {/* API Error */}
          {apiError && (
            <Alert severity="error" onClose={() => setApiError('')}>
              {apiError}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{ color: 'var(--mui-palette-text-secondary)' }}
        >
          {canWrite ? 'Cancel' : 'Close'}
        </Button>
        {canWrite && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
            sx={{
              backgroundColor: '#22c55e',
              '&:hover': { backgroundColor: '#16a34a' }
            }}
          >
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MonitorDialog;
