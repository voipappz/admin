import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Typography, Chip, Box, Button } from '@mui/material';
import PBXBaseNode, { TYPE_CONFIG } from './PBXBaseNode';

const VISIBLE_ENTRIES = 6;

const IVRNode = memo(({ data, selected }) => {
  const [expanded, setExpanded] = useState(false);

  const entries = data.entries || data.options || {};
  const entryList = Array.isArray(entries)
    ? entries
    : Object.entries(entries).map(([key, val]) => ({ key, ...val }));
  const visibleEntries = expanded ? entryList : entryList.slice(0, VISIBLE_ENTRIES);

  const hasTimeout = data.timeout_bridge_type && data.timeout_bridge_uuid;
  const hasInvalid = data.invalid_bridge_type && data.invalid_bridge_uuid;

  return (
    <PBXBaseNode type="ivr" width={370} selected={selected}>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        {data.name || 'Unnamed IVR'}
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
        <Chip label={`${entryList.length} option${entryList.length !== 1 ? 's' : ''}`} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} />
        {data.timeout && (
          <Chip label={`Timeout: ${data.timeout}s`} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} />
        )}
        <Chip
          label={data.enabled !== false ? 'On' : 'Off'}
          size="small"
          color={data.enabled !== false ? 'success' : 'default'}
          sx={{ height: 22, fontSize: '0.65rem' }}
        />
      </Box>

      {/* Menu entries */}
      {entryList.length > 0 && (
        <>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.25, fontSize: '0.62rem' }}>
            Menu Options
          </Typography>
          {visibleEntries.map((entry, i) => {
            const digit = entry.key || entry.digit || entry.name || i;
            const bt = entry.bridge_type === 'que' ? 'queue' : entry.bridge_type;
            const config = TYPE_CONFIG[bt] || { color: '#757575', label: bt || '?' };
            return (
              <Box key={entry.uuid || `${digit}-${i}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
                <Chip label={digit} size="small" sx={{ fontSize: '0.65rem', height: 20, minWidth: 26, fontWeight: 700 }} />
                <Typography variant="body2" noWrap sx={{ flex: 1, fontSize: '0.72rem' }}>
                  {entry.name || config.label}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: config.color }}>
                  {config.label}
                </Typography>
              </Box>
            );
          })}
          {entryList.length > VISIBLE_ENTRIES && (
            <Button
              size="small"
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              sx={{ textTransform: 'none', fontSize: '0.65rem', py: 0, minHeight: 20 }}
            >
              {expanded ? 'Show less' : `+${entryList.length - VISIBLE_ENTRIES} more`}
            </Button>
          )}
        </>
      )}

      {/* Source handles: per-entry (right side) */}
      {entryList.map((entry, i) => {
        const digit = entry.key || entry.digit || entry.name || i;
        return (
          <Handle
            key={`entry-${digit}`}
            type="source"
            position={Position.Right}
            id={`entry-${digit}`}
            style={{
              width: 6,
              height: 6,
              background: TYPE_CONFIG.ivr.color,
              border: '2px solid #fff',
              top: `${100 + i * 28}px`,
              right: -3,
            }}
          />
        );
      })}

      {/* Timeout handle (bottom-left) */}
      {hasTimeout && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="timeout"
          style={{
            width: 6,
            height: 6,
            background: '#9e9e9e',
            border: '2px solid #fff',
            bottom: -3,
            left: '30%',
          }}
        />
      )}

      {/* Invalid handle (bottom-right) */}
      {hasInvalid && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="invalid"
          style={{
            width: 6,
            height: 6,
            background: '#d32f2f',
            border: '2px solid #fff',
            bottom: -3,
            left: '70%',
          }}
        />
      )}
    </PBXBaseNode>
  );
});

IVRNode.displayName = 'IVRNode';

export default IVRNode;
