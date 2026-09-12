import dagre from 'dagre';

/**
 * Node size estimates by type.
 * IVR/CC nodes are taller because they list entries/rules inline.
 */
const NODE_SIZES = {
  did:            { width: 350, height: 110 },
  queue:          { width: 370, height: 220 },
  ivr:            { width: 370, height: 240 },
  call_condition: { width: 370, height: 220 },
  // Leaves
  announcement:   { width: 320, height: 90 },
  vml:            { width: 320, height: 90 },
  bot:            { width: 320, height: 90 },
  extension:      { width: 320, height: 90 },
  number:         { width: 320, height: 90 },
  conference:     { width: 320, height: 90 },
  user_login:     { width: 320, height: 90 },
  // Billing layer
  provider:       { width: 350, height: 120 },
  subscription:   { width: 320, height: 100 },
  tariff:         { width: 300, height: 90 },
};

const DEFAULT_SIZE = { width: 320, height: 90 };

/**
 * Estimate node height dynamically based on content.
 */
function estimateHeight(node) {
  const base = (NODE_SIZES[node.type] || DEFAULT_SIZE).height;
  const data = node.data || {};

  if (node.type === 'queue') {
    const tiers = data.tiers || [];
    const hasIntro = !!(data.intro_announcement?.uuid || data.intro_announcement_uuid);
    const hasHold = !!(data.hold_announcement?.uuid || data.hold_announcement_uuid);
    const announcementRows = (hasIntro ? 1 : 0) + (hasHold ? 1 : 0);
    return base + Math.min(tiers.length, 5) * 24 + announcementRows * 22;
  }
  if (node.type === 'ivr') {
    const entries = data.entries || data.options || {};
    const count = Array.isArray(entries) ? entries.length : Object.keys(entries).length;
    return base + Math.min(count, 6) * 28;
  }
  if (node.type === 'call_condition') {
    const resources = data.resources || [];
    return base + Math.min(resources.length, 5) * 28;
  }
  return base;
}

/**
 * Apply dagre auto-layout to ReactFlow nodes and edges.
 *
 * @param {Array} nodes  – ReactFlow nodes (must have .id, .type, .data)
 * @param {Array} edges  – ReactFlow edges (must have .source, .target)
 * @param {object} opts  – { rankdir, nodesep, ranksep }
 * @returns {Array} nodes with updated .position
 */
export function applyDagreLayout(nodes, edges, opts = {}) {
  const { rankdir = 'TB', nodesep = 80, ranksep = 140 } = opts;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep, ranksep });

  for (const node of nodes) {
    const size = NODE_SIZES[node.type] || DEFAULT_SIZE;
    const h = estimateHeight(node);
    g.setNode(node.id, { width: size.width, height: h });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const size = NODE_SIZES[node.type] || DEFAULT_SIZE;
    return {
      ...node,
      position: {
        x: pos.x - size.width / 2,
        y: pos.y - estimateHeight(node) / 2,
      },
    };
  });
}

export default applyDagreLayout;
