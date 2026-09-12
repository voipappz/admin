import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Paper, Box, Typography, Chip } from '@mui/material';
import {
  Code as RubyIcon,
  Terminal as CmdIcon,
  Chat as ChatIcon,
  SmartToy as AgentIcon,
  PlayArrow as StartIcon,
  Stop as EndIcon,
} from '@mui/icons-material';

export const COG_TYPE_CONFIG = {
  ruby:  { icon: RubyIcon,  color: '#e53935', label: 'Ruby',  lang: 'ruby',     desc: 'Execute Ruby code' },
  cmd:   { icon: CmdIcon,   color: '#43a047', label: 'Cmd',   lang: 'shell',    desc: 'Run shell command' },
  chat:  { icon: ChatIcon,  color: '#1e88e5', label: 'Chat',  lang: 'markdown', desc: 'LLM prompt (RubyLLM)' },
  agent: { icon: AgentIcon, color: '#8e24aa', label: 'Agent', lang: 'markdown', desc: 'AI coding agent' },
};

/**
 * Roast Cog node for the workflow canvas.
 * Shows cog type icon + label, node name, code preview, and done/error handles.
 */
const CogNode = memo(({ data, selected }) => {
  const cogType = data?.cog_type || 'ruby';
  const config = COG_TYPE_CONFIG[cogType] || COG_TYPE_CONFIG.ruby;
  const Icon = config.icon;
  const name = data?.name || cogType;
  const code = data?.code || '';
  const lines = code.split('\n');
  const preview = lines.slice(0, 3).join('\n');
  const moreLines = lines.length > 3;

  return (
    <Paper
      elevation={selected ? 6 : 1}
      sx={{
        width: 260,
        borderLeft: `4px solid ${config.color}`,
        borderRadius: 2,
        overflow: 'visible',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, outline-color 0.15s',
        outline: selected ? `2px solid ${config.color}` : '2px solid transparent',
        '&:hover': { boxShadow: 6 },
        position: 'relative',
        bgcolor: 'background.paper',
      }}
    >
      {/* Target handle (top center) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 10, height: 10,
          background: config.color,
          border: '2px solid #fff',
          top: -5,
        }}
      />

      {/* Type badge header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        px: 1.5, pt: 0.75, pb: 0.5,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: `${config.color}08`,
      }}>
        <Icon sx={{ fontSize: 16, color: config.color }} />
        <Typography
          variant="overline"
          sx={{
            color: config.color, fontWeight: 700,
            letterSpacing: 1, lineHeight: 1.4, fontSize: '0.6rem',
          }}
        >
          {config.label}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip
          label={name}
          size="small"
          sx={{
            height: 18, fontSize: '0.65rem', fontWeight: 500,
            bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
          }}
        />
      </Box>

      {/* Code preview */}
      {code ? (
        <Box sx={{
          px: 1.5, py: 0.75,
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: '0.6rem',
          color: 'text.secondary',
          lineHeight: 1.5,
          maxHeight: 54,
          overflow: 'hidden',
          whiteSpace: 'pre',
          bgcolor: '#fafafa',
        }}>
          {preview}
          {moreLines && (
            <Typography component="span" sx={{ fontSize: '0.55rem', color: 'text.disabled', display: 'block' }}>
              ... +{lines.length - 3} lines
            </Typography>
          )}
        </Box>
      ) : (
        <Box sx={{ px: 1.5, py: 1, bgcolor: '#fafafa' }}>
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            Click to add code
          </Typography>
        </Box>
      )}

      {/* Source handles: done (green) and error (red) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="done"
        style={{
          width: 10, height: 10,
          background: '#43a047',
          border: '2px solid #fff',
          bottom: -5,
          left: '33%',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="error"
        style={{
          width: 10, height: 10,
          background: '#e53935',
          border: '2px solid #fff',
          bottom: -5,
          left: '67%',
        }}
      />

      {/* Handle labels */}
      <Box sx={{
        position: 'absolute', bottom: -18, left: 0, right: 0,
        display: 'flex', px: 2,
        pointerEvents: 'none',
      }}>
        <Typography sx={{ fontSize: '0.5rem', color: '#43a047', fontWeight: 700, flex: 1, textAlign: 'center', pl: 1 }}>done</Typography>
        <Typography sx={{ fontSize: '0.5rem', color: '#e53935', fontWeight: 700, flex: 1, textAlign: 'center', pr: 1 }}>error</Typography>
      </Box>
    </Paper>
  );
});

CogNode.displayName = 'CogNode';

/**
 * Start node — green play icon, single output handle.
 */
export const StartNode = memo(({ selected }) => (
  <Paper
    elevation={selected ? 4 : 1}
    sx={{
      width: 72, height: 72, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
      border: selected ? '2px solid #43a047' : '2px solid #e0e0e0',
      transition: 'box-shadow 0.15s',
      bgcolor: 'background.paper',
    }}
  >
    <StartIcon sx={{ fontSize: 24, color: '#43a047' }} />
    <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: '#43a047', mt: -0.25 }}>START</Typography>
    <Handle
      type="source"
      position={Position.Bottom}
      id="default"
      style={{
        width: 10, height: 10,
        background: '#43a047',
        border: '2px solid #fff',
        bottom: -5,
      }}
    />
  </Paper>
));

StartNode.displayName = 'StartNode';

/**
 * End node — red stop icon, single input handle.
 */
export const EndNode = memo(({ selected }) => (
  <Paper
    elevation={selected ? 4 : 1}
    sx={{
      width: 72, height: 72, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
      border: selected ? '2px solid #e53935' : '2px solid #e0e0e0',
      transition: 'box-shadow 0.15s',
      bgcolor: 'background.paper',
    }}
  >
    <EndIcon sx={{ fontSize: 24, color: '#e53935' }} />
    <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: '#e53935', mt: -0.25 }}>END</Typography>
    <Handle
      type="target"
      position={Position.Top}
      style={{
        width: 10, height: 10,
        background: '#e53935',
        border: '2px solid #fff',
        top: -5,
      }}
    />
  </Paper>
));

EndNode.displayName = 'EndNode';

export default CogNode;
