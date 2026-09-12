import { useRef, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  AccessTime as ClockIcon,
  Headset as HeadsetIcon,
  Campaign as AnnouncementIcon,
  SmartToy as BotIcon,
  Code as VmlIcon,
  AccountTree as IvrIcon,
  SettingsPhone as ExtensionIcon,
  Numbers as NumberIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  HelpOutline as UnknownIcon,
} from '@mui/icons-material';
import { useQueuesTopology } from './useQueuesTopology';
import { QueueBridge } from '../Bridges/QueueBridge/QueueBridge.jsx';
import { IVRBridge } from '../Bridges/IVRBridge/IVRBridge.jsx';
import { CallConditionBridge } from '../Bridges/CallConditionBridge/CallConditionBridge.jsx';
import { AnnouncementBridge } from '../Bridges/AnnouncementBridge/AnnouncementBridge.jsx';
import { VMLBridge } from '../Bridges/VMLBridge/VMLBridge.jsx';
import { BotBridge } from '../Bridges/BotBridge/BotBridge.jsx';
import { ExtensionBridge } from '../Bridges/ExtensionBridge/ExtensionBridge.jsx';
import { useNotification } from '../../context/NotificationContext';

// Card sizing
const CARD_W = 164;
const CARD_H = 64;
const COL_GAP = 80;
const ROW_GAP = 14;
const PAD_TOP = 28;
const PAD_LEFT = 20;

// Type → color
const TYPE_COLORS = {
  did: '#1976d2',
  queue: '#2e7d32',
  call_condition: '#ed6c02',
  ivr: '#7b1fa2',
  announcement: '#0288d1',
  vml: '#616161',
  bot: '#d32f2f',
  extension: '#00796b',
  number: '#455a64',
};

// Type → icon component
const TYPE_ICONS = {
  did: PhoneIcon,
  queue: HeadsetIcon,
  call_condition: ClockIcon,
  ivr: IvrIcon,
  announcement: AnnouncementIcon,
  vml: VmlIcon,
  bot: BotIcon,
  extension: ExtensionIcon,
  number: NumberIcon,
};

/**
 * Editable bridge types — these have a panel-mode editor.
 * Clicking a node of this type opens the editor in the side panel.
 */
const EDITABLE_TYPES = new Set([
  'did', 'queue', 'ivr', 'call_condition', 'announcement', 'vml', 'bot', 'extension',
]);

// ──────────────────────────────────────────
// NodeCard
// ──────────────────────────────────────────
const NodeCard = ({ node, x, y, selected, onClickNode, canWrite = true }) => {
  const color = TYPE_COLORS[node.type] || '#757575';
  const Icon = TYPE_ICONS[node.type] || UnknownIcon;
  const editable = canWrite && EDITABLE_TYPES.has(node.type);

  return (
    <Paper
      data-node-id={node.id}
      elevation={selected ? 4 : 1}
      onClick={editable ? () => onClickNode(node) : undefined}
      sx={{
        position: 'absolute',
        left: x,
        top: y,
        width: CARD_W,
        minHeight: CARD_H,
        borderLeft: `4px solid ${color}`,
        outline: selected ? '2px solid' : 'none',
        outlineColor: selected ? 'primary.main' : undefined,
        cursor: editable ? 'pointer' : 'default',
        px: 1.5,
        py: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        transition: 'box-shadow 0.15s',
        '&:hover': editable ? { boxShadow: 4 } : undefined,
        bgcolor: 'background.paper',
      }}
    >
      {/* Row 1: icon + name */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Icon sx={{ fontSize: 15, color }} />
        <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, lineHeight: 1.2 }}>
          {node.label}
        </Typography>
      </Box>
      {/* Row 2: sublabel */}
      {node.sublabel && (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.68rem' }}>
          {node.sublabel}
        </Typography>
      )}
      {/* Row 3: chips for queues */}
      {node.type === 'queue' && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {node.agentCount != null && (
            <Chip label={`${node.agentCount} agents`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
          )}
          {node.enabled !== undefined && (
            <Chip
              label={node.enabled ? 'On' : 'Off'}
              size="small"
              color={node.enabled ? 'success' : 'default'}
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
          )}
        </Box>
      )}
    </Paper>
  );
};

// ──────────────────────────────────────────
// SVG connector lines
// ──────────────────────────────────────────
const ConnectorLines = ({ edges, nodePositions, svgW, svgH }) => {
  if (!edges.length || !nodePositions.size) return null;

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: svgW, height: svgH, pointerEvents: 'none' }}>
      {edges.map((edge, i) => {
        const from = nodePositions.get(edge.from);
        const to = nodePositions.get(edge.to);
        if (!from || !to) return null;

        const x1 = from.x + from.w;
        const y1 = from.y + from.h / 2;
        const x2 = to.x;
        const y2 = to.y + to.h / 2;
        const dx = Math.abs(x2 - x1) * 0.4;
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        const isTimeout = edge.type === 'timeout';
        const isFallback = edge.type === 'cc-fallback';
        const color = isTimeout ? '#9e9e9e' : isFallback ? '#d32f2f' : '#90a4ae';

        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={1.4}
            strokeDasharray={isTimeout || isFallback ? '5 3' : 'none'}
            opacity={0.55}
          />
        );
      })}
    </svg>
  );
};

// ──────────────────────────────────────────
// Side-panel bridge editor
// ──────────────────────────────────────────
const BridgeEditor = ({ node, onClose, onSave }) => {
  if (!node) return null;
  const { type, data } = node;

  const commonProps = {
    open: true,
    onClose,
    onSave,
    containerMode: 'panel',
    mode: 'edit',
    hideEnvironment: true,
  };

  switch (type) {
    case 'queue':
      return <QueueBridge {...commonProps} queue={data} />;
    case 'ivr':
      return <IVRBridge {...commonProps} ivr={data} />;
    case 'call_condition':
      return <CallConditionBridge {...commonProps} callCondition={data} />;
    case 'announcement':
      return <AnnouncementBridge {...commonProps} announcement={data} editMode="edit" />;
    case 'vml':
      return <VMLBridge {...commonProps} vml={data} />;
    case 'bot':
      return <BotBridge {...commonProps} bot={data} />;
    case 'extension':
      return <ExtensionBridge {...commonProps} extension={data} />;
    default:
      return (
        <Box sx={{ p: 2 }}>
          <Typography color="text.secondary">No editor for type &ldquo;{type}&rdquo;</Typography>
        </Box>
      );
  }
};

// ──────────────────────────────────────────
// Layout engine
// ──────────────────────────────────────────
function computeLayout(nodes, edges) {
  if (!nodes.length) return { positions: {}, columns: [] };

  // Build adjacency
  const outgoing = new Map(); // from → [to]
  const incoming = new Map(); // to → [from]
  for (const e of edges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, []);
    outgoing.get(e.from).push(e.to);
    if (!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to).push(e.from);
  }

  // Assign columns via BFS from DIDs (col 0) outward
  const colOf = new Map();
  const queue = [];

  // DIDs are always column 0
  for (const n of nodes) {
    if (n.type === 'did') {
      colOf.set(n.id, 0);
      queue.push(n.id);
    }
  }

  // BFS
  while (queue.length) {
    const id = queue.shift();
    const col = colOf.get(id);
    for (const to of (outgoing.get(id) || [])) {
      const existing = colOf.get(to);
      if (existing === undefined || existing <= col) {
        colOf.set(to, col + 1);
        queue.push(to);
      }
    }
  }

  // Nodes not reachable from a DID (orphans) — assign to column based on type
  for (const n of nodes) {
    if (!colOf.has(n.id)) {
      const typeCols = { did: 0, call_condition: 1, queue: 2, ivr: 2, announcement: 2, vml: 2, bot: 2, extension: 2, number: 2 };
      colOf.set(n.id, typeCols[n.type] ?? 2);
    }
  }

  // Group nodes by column
  const maxCol = Math.max(...colOf.values(), 0);
  const columnGroups = Array.from({ length: maxCol + 1 }, () => []);
  for (const n of nodes) {
    const c = colOf.get(n.id) ?? 0;
    columnGroups[c].push(n);
  }

  // Sort within each column: try to align with connected nodes
  // For col > 0, sort by average Y of predecessors
  const positions = {};

  // Place column 0 first (DIDs)
  columnGroups[0].forEach((n, i) => {
    positions[n.id] = { x: PAD_LEFT, y: PAD_TOP + i * (CARD_H + ROW_GAP) };
  });

  // Place subsequent columns
  for (let c = 1; c <= maxCol; c++) {
    const group = columnGroups[c];
    // Compute ideal Y per node based on connected predecessors
    const idealY = group.map(n => {
      const parents = (incoming.get(n.id) || []).filter(pid => positions[pid]);
      if (parents.length) {
        return parents.reduce((sum, pid) => sum + positions[pid].y, 0) / parents.length;
      }
      return Infinity; // sort to end
    });

    // Sort by ideal Y
    const indexed = group.map((n, i) => ({ n, iy: idealY[i] }));
    indexed.sort((a, b) => a.iy - b.iy);

    // Place, preventing overlaps
    let nextY = PAD_TOP;
    for (const { n, iy } of indexed) {
      const y = Math.max(iy === Infinity ? nextY : iy, nextY);
      positions[n.id] = { x: PAD_LEFT + c * (CARD_W + COL_GAP), y };
      nextY = y + CARD_H + ROW_GAP;
    }
  }

  // Build column headers
  const colHeaders = [];
  for (let c = 0; c <= maxCol; c++) {
    if (columnGroups[c].length) {
      const types = [...new Set(columnGroups[c].map(n => n.type))];
      const label = types.length === 1 ? formatColHeader(types[0]) : types.map(formatColHeader).join(' / ');
      colHeaders.push({ col: c, x: PAD_LEFT + c * (CARD_W + COL_GAP), label });
    }
  }

  return { positions, columns: colHeaders };
}

function formatColHeader(type) {
  const map = {
    did: 'DIDs',
    call_condition: 'Conditions',
    queue: 'Queues',
    ivr: 'IVRs',
    announcement: 'Announcements',
    vml: 'VML',
    bot: 'Bots',
    extension: 'Devices',
    number: 'Numbers',
  };
  return map[type] || type;
}

// ──────────────────────────────────────────
// Main component
// ──────────────────────────────────────────
const QueuesTopology = ({ onEditDID, canWrite = true } = {}) => {
  const {
    topology,
    loading,
    selectedNode,
    setSelectedNode,
    refreshTopology,
  } = useQueuesTopology();

  const { showSuccess } = useNotification();
  const containerRef = useRef(null);
  const [nodeRects, setNodeRects] = useState(new Map());
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const [createOpen, setCreateOpen] = useState(false);

  const { nodes, edges } = topology;

  // Compute layout positions
  const { positions, columns } = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);

  // After render, measure DOM rects for SVG lines
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const map = new Map();
    const cards = containerRef.current.querySelectorAll('[data-node-id]');
    const parentRect = containerRef.current.getBoundingClientRect();
    let maxW = 0, maxH = 0;
    cards.forEach(el => {
      const id = el.getAttribute('data-node-id');
      const r = el.getBoundingClientRect();
      const x = r.left - parentRect.left;
      const y = r.top - parentRect.top;
      map.set(id, { x, y, w: r.width, h: r.height });
      maxW = Math.max(maxW, x + r.width + 24);
      maxH = Math.max(maxH, y + r.height + 24);
    });
    setNodeRects(map);
    setSvgSize({ w: maxW, h: maxH });
  }, [positions]);

  const handleClickNode = useCallback((node) => {
    if (node.type === 'did' && onEditDID) {
      onEditDID(node.data);
      return;
    }
    if (EDITABLE_TYPES.has(node.type)) {
      setSelectedNode(node);
    }
  }, [setSelectedNode, onEditDID]);

  const handleEditorSave = useCallback(() => {
    setSelectedNode(null);
    showSuccess('Saved');
    refreshTopology();
  }, [setSelectedNode, showSuccess, refreshTopology]);

  const handleEditorClose = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handleCreateSave = useCallback(() => {
    setCreateOpen(false);
    showSuccess('Queue created');
    refreshTopology();
  }, [showSuccess, refreshTopology]);

  const isEmpty = !nodes.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          PBX routing: DID &rarr; Bridge destinations
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={refreshTopology} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {canWrite && (
          <Tooltip title="Create Queue">
            <IconButton size="small" color="primary" onClick={() => setCreateOpen(true)} disabled={loading}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {/* Empty */}
      {!loading && isEmpty && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">No DIDs found in this application.</Typography>
          {canWrite && (
            <Button variant="outlined" size="small" startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => setCreateOpen(true)}>
              Create Queue
            </Button>
          )}
        </Box>
      )}

      {/* Topology + Editor */}
      {!loading && !isEmpty && (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Topology canvas */}
          <Box
            ref={containerRef}
            sx={{
              flex: 1,
              overflow: 'auto',
              position: 'relative',
              minHeight: 320,
            }}
          >
            {/* Column headers */}
            {columns.map(col => (
              <Typography
                key={col.col}
                variant="overline"
                color="text.secondary"
                sx={{ position: 'absolute', left: col.x, top: 2, fontSize: '0.62rem', letterSpacing: 1 }}
              >
                {col.label}
              </Typography>
            ))}

            {/* SVG lines */}
            <ConnectorLines edges={edges} nodePositions={nodeRects} svgW={svgSize.w} svgH={svgSize.h} />

            {/* Node cards */}
            {nodes.map(node => {
              const pos = positions[node.id];
              if (!pos) return null;
              return (
                <NodeCard
                  key={node.id}
                  node={node}
                  x={pos.x}
                  y={pos.y}
                  selected={selectedNode?.id === node.id}
                  onClickNode={handleClickNode}
                  canWrite={canWrite}
                />
              );
            })}
          </Box>

          {/* Side editor panel */}
          {selectedNode && (
            <Paper
              elevation={2}
              sx={{
                width: 'min(600px, 50vw)',
                minWidth: 430,
                overflow: 'auto',
                borderLeft: '1px solid',
                borderColor: 'divider',
                p: 2,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                <IconButton size="small" onClick={handleEditorClose}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              <BridgeEditor
                node={selectedNode}
                onClose={handleEditorClose}
                onSave={handleEditorSave}
              />
            </Paper>
          )}
        </Box>
      )}

      {/* Create Queue dialog */}
      <QueueBridge
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreateSave}
        mode="create"
        hideEnvironment={false}
      />
    </Box>
  );
};

export default QueuesTopology;
