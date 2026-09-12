import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Box, Typography, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import CircleIcon from '@mui/icons-material/Circle';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import GridOnIcon from '@mui/icons-material/GridOn';
import MicIcon from '@mui/icons-material/Mic';
import PhoneForwardedIcon from '@mui/icons-material/PhoneForwarded';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BuildIcon from '@mui/icons-material/Build';
import LanguageIcon from '@mui/icons-material/Language';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PhoneIcon from '@mui/icons-material/Phone';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import RefreshIcon from '@mui/icons-material/Refresh';
import LinkIcon from '@mui/icons-material/Link';

// Map node icon strings to MUI icon components
const iconMap = {
  // Flow Control
  'play-circle': PlayCircleIcon,
  'stop-circle': StopCircleIcon,
  'circle': CircleIcon,
  // User Input
  'message-square': ChatBubbleIcon,
  'grid': GridOnIcon,
  'mic': MicIcon,
  // Actions
  'phone-forwarded': PhoneForwardedIcon,
  'volume-2': VolumeUpIcon,
  'smartphone': SmartphoneIcon,
  'file-plus': NoteAddIcon,
  // AI/LLM
  'brain': PsychologyIcon,
  'sparkles': AutoAwesomeIcon,
  'wrench': BuildIcon,
  // Integrations
  'globe': LanguageIcon,
  'dollar-sign': AttachMoneyIcon,
  'phone': PhoneIcon,
  // Conditions
  'git-branch': AccountTreeIcon,
  'git-merge': MergeTypeIcon,
  'refresh-cw': RefreshIcon,
  'link': LinkIcon,
};

// Category colors
const categoryColors = {
  flow: '#6366f1',
  input: '#10b981',
  action: '#f59e0b',
  llm: '#8b5cf6',
  integration: '#ec4899',
  condition: '#14b8a6',
};

const BasePocketFlowNode = memo(({ data, selected, type }) => {
  const IconComponent = iconMap[data.icon] || CircleIcon;
  const color = data.color || categoryColors[data.category] || '#666';

  return (
    <Box
      sx={{
        padding: '12px 16px',
        borderRadius: '10px',
        backgroundColor: '#fff',
        border: `2px solid ${selected ? '#1976d2' : color}`,
        boxShadow: selected
          ? '0 4px 16px rgba(25, 118, 210, 0.35)'
          : '0 2px 8px rgba(0,0,0,0.1)',
        minWidth: '160px',
        maxWidth: '220px',
        position: 'relative',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      {/* Input Handles */}
      {data.inputs?.map((input, idx) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Top}
          id={input.id}
          style={{
            background: color,
            width: '12px',
            height: '12px',
            border: '2px solid #fff',
            left: data.inputs.length > 1
              ? `${((idx + 1) / (data.inputs.length + 1)) * 100}%`
              : '50%',
          }}
        />
      ))}

      {/* Node Content */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconComponent sx={{ fontSize: 20, color: '#fff' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              color: color,
              textTransform: 'uppercase',
              fontSize: '9px',
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            {type.replace(/_/g, ' ')}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: '#333',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {data.label}
          </Typography>
        </Box>
        {selected && (
          <IconButton
            size="small"
            sx={{
              position: 'absolute',
              top: -10,
              right: -10,
              backgroundColor: '#ef4444',
              color: '#fff',
              padding: '4px',
              '&:hover': { backgroundColor: '#dc2626' },
            }}
          >
            <DeleteIcon sx={{ fontSize: '14px' }} />
          </IconButton>
        )}
      </Box>

      {/* Output Handles */}
      {data.outputs?.map((output, idx) => {
        const outputCount = data.outputs.length;
        const isMultiple = outputCount > 1;

        let style = {
          background: color,
          width: '12px',
          height: '12px',
          border: '2px solid #fff',
        };

        if (isMultiple) {
          style.left = `${((idx + 1) / (outputCount + 1)) * 100}%`;
        }

        // Special styling for condition outputs
        if (output.id === 'true' || output.id === 'success' || output.id === 'response') {
          style.background = '#22c55e';
        } else if (output.id === 'false' || output.id === 'error' || output.id === 'failed') {
          style.background = '#ef4444';
        } else if (output.id === 'timeout') {
          style.background = '#f59e0b';
        } else if (output.id === 'default') {
          style.background = '#6b7280';
        }

        return (
          <Box key={output.id} sx={{ position: 'relative' }}>
            <Handle
              type="source"
              position={Position.Bottom}
              id={output.id}
              style={style}
            />
            {isMultiple && (
              <Typography
                sx={{
                  position: 'absolute',
                  bottom: -22,
                  left: `${((idx + 1) / (outputCount + 1)) * 100}%`,
                  transform: 'translateX(-50%)',
                  fontSize: '8px',
                  color: style.background,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {output.label}
              </Typography>
            )}
          </Box>
        );
      })}

      {/* Intent Classifier special outputs */}
      {type === 'intent_classifier' && (
        <>
          <Handle type="source" position={Position.Right} id="balance"
            style={{ background: '#22c55e', width: '10px', height: '10px', border: '2px solid #fff', top: '20%' }} />
          <Handle type="source" position={Position.Right} id="history"
            style={{ background: '#3b82f6', width: '10px', height: '10px', border: '2px solid #fff', top: '35%' }} />
          <Handle type="source" position={Position.Right} id="issue"
            style={{ background: '#f59e0b', width: '10px', height: '10px', border: '2px solid #fff', top: '50%' }} />
          <Handle type="source" position={Position.Right} id="transfer"
            style={{ background: '#ec4899', width: '10px', height: '10px', border: '2px solid #fff', top: '65%' }} />
          <Handle type="source" position={Position.Right} id="unknown"
            style={{ background: '#6b7280', width: '10px', height: '10px', border: '2px solid #fff', top: '80%' }} />
        </>
      )}

      {/* Switch node special outputs */}
      {type === 'switch' && (
        <>
          <Handle type="source" position={Position.Right} id="case1"
            style={{ background: '#22c55e', width: '10px', height: '10px', border: '2px solid #fff', top: '25%' }} />
          <Handle type="source" position={Position.Right} id="case2"
            style={{ background: '#3b82f6', width: '10px', height: '10px', border: '2px solid #fff', top: '45%' }} />
          <Handle type="source" position={Position.Right} id="case3"
            style={{ background: '#f59e0b', width: '10px', height: '10px', border: '2px solid #fff', top: '65%' }} />
          <Handle type="source" position={Position.Left} id="default"
            style={{ background: '#6b7280', width: '10px', height: '10px', border: '2px solid #fff', top: '50%' }} />
        </>
      )}
    </Box>
  );
});

BasePocketFlowNode.displayName = 'BasePocketFlowNode';

export default BasePocketFlowNode;
