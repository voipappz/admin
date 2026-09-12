import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Typography, Chip, Box } from '@mui/material';
import PBXBaseNode, { TYPE_CONFIG } from './PBXBaseNode';

const DIDNode = memo(({ data, selected }) => {
  return (
    <PBXBaseNode type="did" width={350} selected={selected}>
      <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.05rem', lineHeight: 1.3 }}>
        {data.number || 'No Number'}
      </Typography>
      {data.name && (
        <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: '0.78rem', mt: 0.25 }}>
          {data.name}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
        <Chip
          label={data.enabled !== false ? 'Enabled' : 'Disabled'}
          size="small"
          color={data.enabled !== false ? 'success' : 'default'}
          variant={data.enabled !== false ? 'filled' : 'outlined'}
          sx={{ height: 20, fontSize: '0.65rem' }}
        />
        {data.bridge_type && (
          <Chip
            label={data.bridge_type}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
        )}
      </Box>

      {/* Single source handle at bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        style={{
          width: 8,
          height: 8,
          background: TYPE_CONFIG.did.color,
          border: '2px solid #fff',
          bottom: -4,
        }}
      />
    </PBXBaseNode>
  );
});

DIDNode.displayName = 'DIDNode';

export default DIDNode;
