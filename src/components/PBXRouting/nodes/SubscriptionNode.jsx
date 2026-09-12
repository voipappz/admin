import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Typography, Chip, Box } from '@mui/material';
import PBXBaseNode, { TYPE_CONFIG } from './PBXBaseNode';

const formatBalance = (val) => {
  if (val === undefined || val === null) return '';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return num.toFixed(2);
};

const STATUS_COLORS = {
  active: 'success',
  suspended: 'warning',
  cancelled: 'error',
  expired: 'default',
};

const SubscriptionNode = memo(({ data, selected }) => {
  const statusColor = STATUS_COLORS[data.status] || 'default';

  return (
    <PBXBaseNode type="subscription" width={260} selected={selected}>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
        {data.name || 'Unnamed Subscription'}
      </Typography>

      {(data.plan?.name || data.plan_name) && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem', mb: 0.5 }}>
          Plan: {data.plan?.name || data.plan_name}
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {data.status && (
          <Chip
            label={data.status}
            size="small"
            color={statusColor}
            sx={{ height: 20, fontSize: '0.6rem', textTransform: 'capitalize' }}
          />
        )}
        {data.balance !== undefined && (
          <Chip
            label={`$${formatBalance(data.balance)}`}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.6rem' }}
          />
        )}
        {data.recurring && (
          <Chip
            label="Recurring"
            size="small"
            variant="outlined"
            color="info"
            sx={{ height: 20, fontSize: '0.6rem' }}
          />
        )}
      </Box>

      {/* Source handle (bottom) → connects to DID environment */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        style={{
          width: 8,
          height: 8,
          background: TYPE_CONFIG.subscription.color,
          border: '2px solid #fff',
          bottom: -4,
        }}
      />
    </PBXBaseNode>
  );
});

SubscriptionNode.displayName = 'SubscriptionNode';

export default SubscriptionNode;
