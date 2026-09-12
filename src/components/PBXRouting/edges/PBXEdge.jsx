import { memo } from 'react';
import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { Chip } from '@mui/material';

/**
 * Edge style presets by edgeType
 */
const EDGE_STYLES = {
  'did-bridge':    { color: '#1976d2', dash: false, chipColor: 'primary' },
  'ivr-entry':     { color: '#7b1fa2', dash: false, chipColor: 'secondary' },
  'ivr-timeout':   { color: '#9e9e9e', dash: true,  chipColor: 'default' },
  'ivr-invalid':   { color: '#d32f2f', dash: true,  chipColor: 'error' },
  'queue-timeout': { color: '#9e9e9e', dash: true,  chipColor: 'default' },
  'queue-intro':   { color: '#0288d1', dash: false, chipColor: 'info' },
  'queue-hold':    { color: '#0288d1', dash: false, chipColor: 'info' },
  'cc-rule':       { color: '#ed6c02', dash: false, chipColor: 'warning' },
  'cc-fallback':   { color: '#d32f2f', dash: true,  chipColor: 'error' },
  // Billing layer
  'provider-did':  { color: '#0d47a1', dash: false, chipColor: 'primary' },
  'provider-tariff': { color: '#e65100', dash: false, chipColor: 'warning' },
  'subscription-env': { color: '#4a148c', dash: true, chipColor: 'secondary' },
};

const DEFAULT_STYLE = { color: '#90a4ae', dash: false, chipColor: 'default' };

const PBXEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
  markerEnd,
}) => {
  const edgeType = data?.edgeType || '';
  const style = EDGE_STYLES[edgeType] || DEFAULT_STYLE;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: style.color,
          strokeWidth: style.dash ? 1.5 : 2,
          strokeDasharray: style.dash ? '6 3' : 'none',
          opacity: 0.7,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <Chip
            label={label}
            size="small"
            color={style.chipColor}
            variant="outlined"
            sx={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              fontSize: '0.65rem',
              height: 20,
              bgcolor: 'background.paper',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </EdgeLabelRenderer>
      )}
    </>
  );
});

PBXEdge.displayName = 'PBXEdge';

export default PBXEdge;
