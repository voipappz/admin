import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Typography, Chip, Box } from '@mui/material';
import PBXBaseNode, { TYPE_CONFIG } from './PBXBaseNode';

const ProviderNode = memo(({ data, selected }) => {
  const providerType = data.type || 'sip';

  return (
    <PBXBaseNode type="provider" width={280} selected={selected}>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
        {data.name || 'Unnamed Provider'}
      </Typography>

      {data.hostname && (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: '0.7rem', mb: 0.5 }}>
          {data.hostname}{data.port ? `:${data.port}` : ''}
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        <Chip
          label={providerType.toUpperCase()}
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.6rem' }}
        />
        {data.protocol && (
          <Chip
            label={data.protocol}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.6rem' }}
          />
        )}
        <Chip
          label={data.enabled !== false ? 'Active' : 'Inactive'}
          size="small"
          color={data.enabled !== false ? 'success' : 'default'}
          sx={{ height: 20, fontSize: '0.6rem' }}
        />
      </Box>

      {/* Source handle (bottom) → connects to DID */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        style={{
          width: 8,
          height: 8,
          background: TYPE_CONFIG.provider.color,
          border: '2px solid #fff',
          bottom: -4,
        }}
      />

      {/* Source handle (right) → connects to Tariff */}
      {data.tariff_uuid && (
        <Handle
          type="source"
          position={Position.Right}
          id="tariff"
          style={{
            width: 6,
            height: 6,
            background: '#ff9800',
            border: '2px solid #fff',
            right: -3,
            top: '50%',
          }}
        />
      )}
    </PBXBaseNode>
  );
});

ProviderNode.displayName = 'ProviderNode';

export default ProviderNode;
