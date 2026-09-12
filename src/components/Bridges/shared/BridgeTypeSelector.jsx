import React, { useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  IconButton,
  Tooltip
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { NumberSelector } from '../NumberBridge/NumberSelector.jsx';
import { Z, menuProps } from '../../../utils/zIndex.js';

/**
 * BridgeTypeSelector Component
 * Reusable component for selecting bridge type and bridge resource
 * Extracted from DIDDialog pattern (lines 340-388)
 *
 * Features:
 * - Cascade selection: type → resource
 * - Environment-scoped filtering
 * - Auto-fetch resources when type changes
 * - Reset resource UUID when type changes
 */
export const BridgeTypeSelector = ({
  bridgeType,
  bridgeUuid,
  onBridgeTypeChange,
  onBridgeUuidChange,
  bridgeTypes = [],
  bridgeResources = {},
  onFetchBridgeResources,
  environmentUuid,
  required = false,
  typeError = null,
  uuidError = null,
  disabled = false,
  excludeNumber = false, // Option to exclude 'number' type
  onCreateResource = null, // Optional callback for inline resource creation (receives bridgeType)
  onEditResource = null, // Optional callback for editing selected resource (receives bridgeType, uuid)
  zLayer = null // Optional z-index layer override (e.g. Z.L3 when nested)
}) => {
  const layer = zLayer || Z.L2;
  // Fetch bridge resources when type changes
  useEffect(() => {
    if (bridgeType && environmentUuid && onFetchBridgeResources && bridgeType !== 'number') {
      onFetchBridgeResources(bridgeType, environmentUuid);
    }
  }, [bridgeType, environmentUuid, onFetchBridgeResources]);

  // Handle type change - delegate uuid reset to the consumer via onBridgeTypeChange
  // so consumers that use a single onChange callback can update both fields atomically
  const handleTypeChange = (type) => {
    onBridgeTypeChange(type);
  };

  // Get available resources for selected bridge type
  const resourceOptions = bridgeResources[bridgeType] || [];

  // Filter bridge types if needed
  const filteredBridgeTypes = excludeNumber
    ? bridgeTypes.filter(type => type !== 'number')
    : bridgeTypes;

  return (
    <Box sx={{ display: 'flex', gap: 2, width: '100%', alignItems: 'center' }}>
      {/* Bridge Type Selector */}
      <FormControl
        fullWidth
        required={required}
        error={!!typeError}
        disabled={disabled}
      >
        <InputLabel>Bridge Type</InputLabel>
        <Select
          value={bridgeType || ''}
          onChange={(e) => handleTypeChange(e.target.value)}
          label="Bridge Type"
          MenuProps={menuProps(layer)}
        >
          {filteredBridgeTypes.map(type => (
            <MenuItem key={type} value={type}>
              {type.replace('_', ' ').toUpperCase()}
            </MenuItem>
          ))}
        </Select>
        {typeError && <FormHelperText>{typeError}</FormHelperText>}
      </FormControl>

      {/* Bridge Resource Selector — NumberSelector for 'number', Select for others */}
      {bridgeType === 'number' ? (
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <NumberSelector
            value={bridgeUuid}
            onChange={(uuid) => onBridgeUuidChange(uuid)}
            environmentUuid={environmentUuid}
            required={required}
            error={uuidError}
            disabled={disabled}
          />
        </Box>
      ) : (
        <FormControl
          fullWidth
          required={required}
          error={!!uuidError}
          disabled={!bridgeType || disabled}
        >
          <InputLabel>Target Resource</InputLabel>
          <Select
            value={bridgeUuid || ''}
            onChange={(e) => onBridgeUuidChange(e.target.value)}
            label="Target Resource"
            MenuProps={menuProps(layer)}
          >
            {onCreateResource && (
              <MenuItem
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onCreateResource(bridgeType); }}
                sx={{ color: 'primary.main', fontWeight: 'bold' }}
              >
                + Create New
              </MenuItem>
            )}
            {resourceOptions.map(resource => (
              <MenuItem key={resource.uuid} value={resource.uuid}>
                {resource.name}
                {resource.number ? ` (${resource.number})` : ''}
              </MenuItem>
            ))}
          </Select>
          {uuidError && <FormHelperText>{uuidError}</FormHelperText>}
        </FormControl>
      )}

      {/* Edit Resource Button */}
      {onEditResource && bridgeUuid && bridgeType !== 'number' && (
        <Tooltip title="Edit Resource">
          <IconButton
            onClick={() => onEditResource(bridgeType, bridgeUuid)}
            size="small"
            color="primary"
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default BridgeTypeSelector;
