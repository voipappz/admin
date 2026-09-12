import { Box, TextField, IconButton, Button, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import './KeyValueField.css';

/**
 * Reusable Key-Value Field Component
 * Used for managing dynamic key-value pairs (actions, conditions, meta, etc.)
 */
const KeyValueField = ({
  fields = [],           // Array of {key, value} objects
  onChange,              // Callback(newFields)
  errors = {},           // Object with validation errors
  label = 'Properties',  // Section label
  addButtonText = 'Add Property',
  keyLabel = 'Key',
  valueLabel = 'Value',
  disabled = false,
  helperText = null
}) => {
  const handleAddField = () => {
    const newFields = [...fields, { key: '', value: '' }];
    onChange(newFields);
  };

  const handleRemoveField = (index) => {
    const newFields = fields.filter((_, i) => i !== index);
    onChange(newFields);
  };

  const handleUpdateField = (index, field, value) => {
    const newFields = fields.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(newFields);
  };

  return (
    <Box className="key-value-field">
      {fields.length === 0 && !disabled && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No {label.toLowerCase()} configured. Click "{ addButtonText}" to add one.
        </Typography>
      )}

      {fields.map((field, index) => (
        <Box key={index} className="key-value-row" sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
          <TextField
            label={keyLabel}
            value={field.key}
            onChange={(e) => handleUpdateField(index, 'key', e.target.value)}
            fullWidth
            size="small"
            disabled={disabled}
            error={!!errors[`key_${index}`]}
            helperText={errors[`key_${index}`]}
          />
          <TextField
            label={valueLabel}
            value={field.value}
            onChange={(e) => handleUpdateField(index, 'value', e.target.value)}
            fullWidth
            size="small"
            disabled={disabled}
            error={!!errors[`value_${index}`]}
            helperText={errors[`value_${index}`]}
          />
          {!disabled && (
            <IconButton
              onClick={() => handleRemoveField(index)}
              color="error"
              size="small"
              aria-label="delete"
            >
              <DeleteIcon />
            </IconButton>
          )}
        </Box>
      ))}

      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {helperText}
        </Typography>
      )}

      {!disabled && (
        <Button
          onClick={handleAddField}
          startIcon={<AddIcon />}
          variant="outlined"
          size="small"
          sx={{ mt: fields.length > 0 ? 1 : 0 }}
        >
          {addButtonText}
        </Button>
      )}

      {errors.general && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
          {errors.general}
        </Typography>
      )}
    </Box>
  );
};

export default KeyValueField;
