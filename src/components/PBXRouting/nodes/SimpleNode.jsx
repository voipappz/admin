import { memo } from 'react';
import { Typography } from '@mui/material';
import PBXBaseNode from './PBXBaseNode';

/**
 * Leaf node for simple bridge types: announcement, vml, bot, extension, number.
 * No source handles (terminal node).
 */
const SimpleNode = memo(({ data, type, selected }) => {
  return (
    <PBXBaseNode type={type} width={260} selected={selected}>
      <Typography variant="body2" fontWeight={600}>
        {data?.name || data?.number || type}
      </Typography>
      {data?.description && (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.68rem' }}>
          {data.description}
        </Typography>
      )}
    </PBXBaseNode>
  );
});

SimpleNode.displayName = 'SimpleNode';

export default SimpleNode;
