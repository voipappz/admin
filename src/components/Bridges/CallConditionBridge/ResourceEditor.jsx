import React from 'react';
import {
  Box,
  Divider,
  Typography
} from '@mui/material';
import { BridgeTypeSelector } from '../shared/BridgeTypeSelector.jsx';
import { InlineRuleEditor } from './InlineRuleEditor.jsx';

/**
 * ResourceEditor Component
 * Editor for individual routing resource configuration.
 *
 * Layout (top → bottom):
 *   1. WHEN — InlineRuleEditor (days / hours / caller / always)
 *   2. THEN — BridgeTypeSelector (where to route the call)
 *
 * Resource name is auto-derived from the selected bridge target so the
 * end user never has to think about it. The hook handles the auto-name
 * on bridge change.
 */
export const ResourceEditor = ({
  resource,
  onChange,
  bridgeTypes = [],
  bridgeResources = {},
  onFetchBridgeResources,
  environmentUuid,
  disabled = false,
  zLayer = null
}) => {
  // Lookup helper: derive a friendly resource name from the chosen bridge.
  const deriveBridgeName = (bridgeType, bridgeUuid) => {
    if (!bridgeType) return '';
    if (bridgeType === 'number') {
      // Number bridge stores the e164 in bridge_uuid directly
      return bridgeUuid ? `Number ${bridgeUuid}` : 'Number';
    }
    const list = bridgeResources[bridgeType] || [];
    const match = list.find(r => r.uuid === bridgeUuid);
    if (match) return match.name || `${bridgeType} ${match.uuid?.slice(0, 6)}`;
    return bridgeType.replace('_', ' ');
  };

  const handleBridgeTypeChange = (type) => {
    // Reset bridge_uuid when type changes; auto-update name to type label
    const nextName = type ? type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
    onChange({
      ...resource,
      bridge_type: type,
      bridge_uuid: '',
      name: nextName
    });
  };

  const handleBridgeUuidChange = (uuid) => {
    const nextName = deriveBridgeName(resource.bridge_type, uuid) || resource.name || '';
    onChange({
      ...resource,
      bridge_uuid: uuid,
      name: nextName
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ---------- 1. WHEN — Rule editor ---------- */}
      <InlineRuleEditor
        segmentUuid={Array.isArray(resource.segment_uuids) ? (resource.segment_uuids[0] || '') : ''}
        onSegmentUuidChange={(uuid) => onChange({
          ...resource,
          segment_uuids: uuid ? [uuid] : []
        })}
        disabled={disabled}
      />

      <Divider sx={{ my: 0.5 }} />

      {/* ---------- 2. THEN — Bridge ---------- */}
      <Box>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
          Then route the call to
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Pick where matching calls should go.
        </Typography>
        <BridgeTypeSelector
          bridgeType={resource.bridge_type || ''}
          bridgeUuid={resource.bridge_uuid || ''}
          onBridgeTypeChange={handleBridgeTypeChange}
          onBridgeUuidChange={handleBridgeUuidChange}
          bridgeTypes={bridgeTypes}
          bridgeResources={bridgeResources}
          onFetchBridgeResources={onFetchBridgeResources}
          environmentUuid={environmentUuid}
          required
          disabled={disabled}
          zLayer={zLayer}
        />
      </Box>
    </Box>
  );
};

export default ResourceEditor;
