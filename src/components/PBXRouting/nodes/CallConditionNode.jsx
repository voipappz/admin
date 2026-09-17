import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Typography, Chip, Box, Button } from '@mui/material';
import PBXBaseNode, { TYPE_CONFIG } from './PBXBaseNode';

const VISIBLE_RULES = 5;

const CallConditionNode = memo(({ data, selected }) => {
  const [expanded, setExpanded] = useState(false);

  const resources = data.resources || [];
  const visibleResources = expanded ? resources : resources.slice(0, VISIBLE_RULES);
  const hasFallback = data.fallback_bridge_type && data.fallback_bridge_uuid;

  return (
    <PBXBaseNode type="call_condition" width={370} selected={selected}>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        {data.name || 'Unnamed Condition'}
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
        <Chip label={`${resources.length} rule${resources.length !== 1 ? 's' : ''}`} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} />
        <Chip
          label={data.enabled !== false ? 'On' : 'Off'}
          size="small"
          color={data.enabled !== false ? 'success' : 'default'}
          sx={{ height: 22, fontSize: '0.65rem' }}
        />
      </Box>

      {/* Rules list */}
      {resources.length > 0 && (
        <>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.25, fontSize: '0.62rem' }}>
            Rules
          </Typography>
          {visibleResources.map((res, i) => {
            const bt = res.bridge_type === 'que' ? 'queue' : res.bridge_type;
            const config = TYPE_CONFIG[bt] || { color: 'var(--mui-palette-text-secondary)', label: bt || '?' };
            const Icon = config.icon;
            return (
              <Box key={res.uuid || i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', width: 18, textAlign: 'right', flexShrink: 0 }}>
                  #{i + 1}
                </Typography>
                <Typography variant="body2" noWrap sx={{ flex: 1, fontSize: '0.72rem' }}>
                  {res.name || `Rule ${i + 1}`}
                </Typography>
                {Icon && <Icon sx={{ fontSize: 12, color: config.color, flexShrink: 0 }} />}
              </Box>
            );
          })}
          {resources.length > VISIBLE_RULES && (
            <Button
              size="small"
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              sx={{ textTransform: 'none', fontSize: '0.65rem', py: 0, minHeight: 20 }}
            >
              {expanded ? 'Show less' : `+${resources.length - VISIBLE_RULES} more`}
            </Button>
          )}
        </>
      )}

      {/* Source handles: per-rule (right side) */}
      {resources.map((_, i) => (
        <Handle
          key={`rule-${i}`}
          type="source"
          position={Position.Right}
          id={`rule-${i}`}
          style={{
            width: 6,
            height: 6,
            background: TYPE_CONFIG.call_condition.color,
            border: '2px solid #fff',
            top: `${100 + i * 28}px`,
            right: -3,
          }}
        />
      ))}

      {/* Fallback handle (bottom) */}
      {hasFallback && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="fallback"
          style={{
            width: 6,
            height: 6,
            background: '#d32f2f',
            border: '2px solid #fff',
            bottom: -3,
          }}
        />
      )}
    </PBXBaseNode>
  );
});

CallConditionNode.displayName = 'CallConditionNode';

export default CallConditionNode;
