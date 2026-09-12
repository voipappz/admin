import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  IconButton,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

/**
 * MetaPropertiesEditor Component
 * Reusable component for managing key-value meta properties
 * Extracted from BridgeEditModal pattern
 *
 * Features:
 * - Add/remove meta fields
 * - Duplicate key validation
 * - Clean key-value pair management
 */
export const MetaPropertiesEditor = ({
  metaFields = [],
  onAdd,
  onRemove,
  onUpdate,
  validateDuplicates = true,
  title = "Meta Properties",
  addButtonText = "Add Property"
}) => {
  const [duplicateError, setDuplicateError] = useState(null);

  // Validate for duplicate keys
  useEffect(() => {
    if (validateDuplicates) {
      const keys = metaFields.map(f => f.key).filter(k => k.trim());
      const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
      setDuplicateError(duplicates.length > 0 ? 'Duplicate meta keys are not allowed' : null);
    }
  }, [metaFields, validateDuplicates]);

  // Check if a specific key is duplicate
  const isDuplicateKey = (key) => {
    if (!validateDuplicates || !key.trim()) return false;
    return metaFields.filter(f => f.key === key).length > 1;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{title}</Typography>
        <Button
          onClick={onAdd}
          startIcon={<AddIcon />}
          variant="outlined"
          size="small"
        >
          {addButtonText}
        </Button>
      </Box>

      {duplicateError && (
        <Alert severity="error" sx={{ mb: 2 }}>{duplicateError}</Alert>
      )}

      {metaFields.map((field, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
          <TextField
            label="Key"
            value={field.key}
            onChange={(e) => onUpdate(index, 'key', e.target.value)}
            error={isDuplicateKey(field.key)}
            helperText={isDuplicateKey(field.key) ? 'Duplications are not allowed' : ''}
            fullWidth
            size="small"
          />
          <TextField
            label="Value"
            value={field.value}
            onChange={(e) => onUpdate(index, 'value', e.target.value)}
            fullWidth
            size="small"
          />
          <IconButton
            onClick={() => onRemove(index)}
            color="error"
            size="small"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ))}

      {metaFields.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No meta properties defined. Click "{addButtonText}" to add custom key-value pairs.
        </Typography>
      )}
    </Box>
  );
};

export default MetaPropertiesEditor;
