import { useState } from 'react';
import { Box, TextField, Chip, Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import './ArrayField.css';

/**
 * Reusable Array Field Component
 * Used for managing arrays of strings (triggers, tags, etc.)
 */
const ArrayField = ({
  items = [],            // Array of strings
  onChange,              // Callback(newItems)
  label = 'Items',
  addButtonText = 'Add Item',
  placeholder = 'Enter value',
  helperText = null,
  disabled = false,
  errors = null
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleAddItem = () => {
    if (inputValue.trim()) {
      const newItems = [...items, inputValue.trim()];
      onChange(newItems);
      setInputValue('');
    }
  };

  const handleRemoveItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <Box className="array-field">
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          size="small"
          fullWidth
          disabled={disabled}
          error={!!errors}
          helperText={errors}
        />
        <Button
          onClick={handleAddItem}
          startIcon={<AddIcon />}
          variant="outlined"
          size="small"
          disabled={disabled || !inputValue.trim()}
        >
          {addButtonText}
        </Button>
      </Box>

      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          {helperText}
        </Typography>
      )}

      {items.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {items.map((item, index) => (
            <Chip
              key={index}
              label={item}
              onDelete={disabled ? undefined : () => handleRemoveItem(index)}
              color="primary"
              variant="outlined"
            />
          ))}
        </Box>
      )}

      {items.length === 0 && !disabled && (
        <Typography variant="body2" color="text.secondary">
          No {label.toLowerCase()} added yet. Enter a value and click "{addButtonText}".
        </Typography>
      )}
    </Box>
  );
};

export default ArrayField;
