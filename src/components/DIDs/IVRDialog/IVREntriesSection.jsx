import React, { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  FormHelperText,
  Paper,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

/**
 * IVREntriesSection Component
 * Manages IVR menu entries (keypad options like "Press 1 for Sales")
 * Based on legacy pattern from va-voipbox-admin/src/views/ivr/edit.html
 */
const IVREntriesSection = ({
  entries = {},
  onChange,
  bridgeTypes = [],
  bridgeResources = {},
  onFetchBridgeResources,
  environmentUuid,
  errors = {}
}) => {
  const [newEntryNumber, setNewEntryNumber] = useState('');
  const [newEntryError, setNewEntryError] = useState('');

  // Convert entries object to array for display
  // Legacy format: entries = { "1": { name: "Sales", bridge_type: "extension", bridge_uuid: "uuid" } }
  const entriesArray = Object.keys(entries).map(number => ({
    number,
    name: entries[number]?.name || '',
    bridge_type: entries[number]?.bridge_type || '',
    bridge_uuid: entries[number]?.bridge_uuid || ''
  }));

  // Validate entry number (legacy pattern: ^[#*0-9]{1,4}$)
  const validateEntryNumber = (value) => {
    const regex = /^[#*0-9]{1,4}$/;
    if (!value.trim()) {
      return 'Entry number is required';
    }
    if (!regex.test(value)) {
      return 'Invalid format. Use #, *, or 0-9 (max 4 characters)';
    }
    if (entries[value]) {
      return 'Entry number already exists';
    }
    return '';
  };

  // Handle new entry number input
  const handleNewEntryChange = (value) => {
    setNewEntryNumber(value);
    setNewEntryError(validateEntryNumber(value));
  };

  // Add new entry
  const handleAddEntry = () => {
    const error = validateEntryNumber(newEntryNumber);
    if (error) {
      setNewEntryError(error);
      return;
    }

    const updatedEntries = {
      ...entries,
      [newEntryNumber]: {
        name: '',
        bridge_type: '',
        bridge_uuid: ''
      }
    };

    onChange(updatedEntries);
    setNewEntryNumber('');
    setNewEntryError('');
  };

  // Remove entry
  const handleRemoveEntry = (number) => {
    const updatedEntries = { ...entries };
    delete updatedEntries[number];
    onChange(updatedEntries);
  };

  // Update entry field
  const handleEntryFieldChange = (number, field, value) => {
    const updatedEntries = {
      ...entries,
      [number]: {
        ...entries[number],
        [field]: value
      }
    };

    // Reset bridge_uuid when bridge_type changes (legacy pattern)
    if (field === 'bridge_type') {
      updatedEntries[number].bridge_uuid = '';
      
      // Fetch bridge resources for new type
      if (value && environmentUuid && onFetchBridgeResources) {
        onFetchBridgeResources(value, environmentUuid);
      }
    }

    onChange(updatedEntries);
  };

  return (
    <Box>
      <Typography variant="h6" color="primary" gutterBottom>
        Menu Options
      </Typography>
      
      {entriesArray.length > 0 ? (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width="20%">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Entry Name *
                  </Typography>
                </TableCell>
                <TableCell width="15%">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Number
                  </Typography>
                </TableCell>
                <TableCell width="25%">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Bridge Type *
                  </Typography>
                </TableCell>
                <TableCell width="25%">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Bridge *
                  </Typography>
                </TableCell>
                <TableCell width="15%">
                  <Typography variant="subtitle2" fontWeight={600}>
                    Actions
                  </Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entriesArray.map((entry) => (
                <TableRow key={entry.number}>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={entry.name}
                      onChange={(e) => handleEntryFieldChange(entry.number, 'name', e.target.value)}
                      placeholder="e.g., Sales Department"
                      error={!!errors[`entry_name_${entry.number}`]}
                      helperText={errors[`entry_name_${entry.number}`]}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} color="primary">
                      {entry.number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <FormControl 
                      size="small" 
                      fullWidth 
                      error={!!errors[`entry_bridge_type_${entry.number}`]}
                    >
                      <InputLabel>Bridge Type</InputLabel>
                      <Select
                        value={entry.bridge_type}
                        label="Bridge Type"
                        onChange={(e) => handleEntryFieldChange(entry.number, 'bridge_type', e.target.value)}
                        disabled={!environmentUuid}
                      >
                        <MenuItem value="">
                          <em>Please Select</em>
                        </MenuItem>
                        {bridgeTypes.map(type => (
                          <MenuItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors[`entry_bridge_type_${entry.number}`] && (
                        <FormHelperText>{errors[`entry_bridge_type_${entry.number}`]}</FormHelperText>
                      )}
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <FormControl 
                      size="small" 
                      fullWidth 
                      error={!!errors[`entry_bridge_uuid_${entry.number}`]}
                      disabled={!entry.bridge_type || entry.bridge_type === 'number'}
                    >
                      <InputLabel>Bridge</InputLabel>
                      <Select
                        value={entry.bridge_uuid}
                        label="Bridge"
                        onChange={(e) => handleEntryFieldChange(entry.number, 'bridge_uuid', e.target.value)}
                      >
                        <MenuItem value="">
                          <em>Select a bridge</em>
                        </MenuItem>
                        {(bridgeResources[entry.bridge_type] || []).map(resource => (
                          <MenuItem key={resource.uuid} value={resource.uuid}>
                            {resource.name}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors[`entry_bridge_uuid_${entry.number}`] && (
                        <FormHelperText>{errors[`entry_bridge_uuid_${entry.number}`]}</FormHelperText>
                      )}
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Remove entry">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveEntry(entry.number)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
          No menu options configured. Add entries below to create keypad options like "Press 1 for Sales".
        </Typography>
      )}

      {/* Add New Entry */}
      <Box sx={{ display: 'flex', alignItems: 'start', gap: 2, mt: 2 }}>
        <TextField
          size="small"
          label="Entry Number"
          value={newEntryNumber}
          onChange={(e) => handleNewEntryChange(e.target.value)}
          error={!!newEntryError}
          helperText={newEntryError || 'Use #, *, or 0-9 (max 4 characters)'}
          placeholder="1"
          sx={{ minWidth: '150px' }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddEntry}
          disabled={!newEntryNumber || !!newEntryError}
          size="small"
        >
          Add Entry
        </Button>
      </Box>

      {entriesArray.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Current entries: {entriesArray.length}
        </Typography>
      )}
    </Box>
  );
};

export default IVREntriesSection;