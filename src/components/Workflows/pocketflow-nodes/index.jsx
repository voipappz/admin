import { memo } from 'react';
import BasePocketFlowNode from './BasePocketFlowNode';

/**
 * PocketFlow Node Types Configuration
 * Only nodes with real backend PocketFlow implementations.
 *
 * Backend registry (lib/pocketflow/nodes.rb):
 *   - 'start'   → pass-through in FlowBuilder (finds first real node)
 *   - 'webhook'  → Pocketflow::Nodes::WebhookNode (HTTP send via Mediators::Webhook::Fire)
 *   - 'api_call' → alias for WebhookNode
 *
 * Categories:
 * - general: Flow control + general (start, end, log, webhook, api_call)
 * - campaign: Campaign nodes
 * - widget: Widget nodes
 * - report: Report nodes
 */

// Default UI config per category (for API-only nodes without local overrides)
export const CATEGORY_DEFAULTS = {
  general: { icon: 'circle', color: '#6366f1' },
  campaign: { icon: 'campaign', color: '#f97316' },
  widget: { icon: 'widgets', color: '#06b6d4' },
  report: { icon: 'assessment', color: '#8b5cf6' },
};

// Local overrides for icon/color/inputs (UI-only concerns not in API)
const LOCAL_OVERRIDES = {
  start: {
    icon: 'play-circle',
    color: '#22c55e',
    inputs: [],
    outputs: [{ id: 'next', label: 'Next' }], // API returns 'default', keep 'next' for backward compat
  },
  end: {
    icon: 'stop-circle',
    color: '#ef4444',
    inputs: [{ id: 'in', label: 'In' }],
  },
  log: {
    icon: 'list',
    color: '#f59e0b',
    inputs: [{ id: 'in', label: 'In' }],
  },
  webhook: {
    icon: 'link',
    color: '#ec4899',
    inputs: [{ id: 'in', label: 'In' }],
  },
  api_call: {
    icon: 'globe',
    color: '#ec4899',
    inputs: [{ id: 'in', label: 'In' }],
  },
};

// Hardcoded fallback node types (used when API is unreachable)
export const POCKETFLOW_NODE_TYPES = {
  // === Flow Control ===
  start: {
    label: 'Start',
    category: 'general',
    icon: 'play-circle',
    color: '#22c55e',
    description: 'Entry point — triggers when event fires',
    inputs: [],
    outputs: [{ id: 'next', label: 'Next' }],
    properties: [
      { name: 'flowName', type: 'string', label: 'Flow Name', default: 'event_flow' }
    ]
  },
  end: {
    label: 'End',
    category: 'general',
    icon: 'stop-circle',
    color: '#ef4444',
    description: 'End point of the flow',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [],
    properties: [
      { name: 'reason', type: 'select', label: 'End Reason',
        options: ['completed', 'error'],
        default: 'completed' }
    ]
  },

  // === Logging ===
  log: {
    label: 'Log',
    category: 'general',
    icon: 'list',
    color: '#f59e0b',
    description: 'Write to system logs (track webhook success/failure)',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'next', label: 'Next' }],
    properties: [
      { name: 'message', type: 'string', label: 'Log Message', default: 'Webhook result' },
      { name: 'level', type: 'select', label: 'Level',
        options: ['info', 'warn', 'error'],
        default: 'info' }
    ]
  },

  // === Integrations (backed by WebhookNode) ===
  webhook: {
    label: 'Webhook',
    category: 'general',
    icon: 'link',
    color: '#ec4899',
    description: 'Send HTTP webhook with field mapping',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'webhook_sent', label: 'Sent' }, { id: 'webhook_failed', label: 'Failed' }],
    properties: [
      { name: 'url', type: 'string', label: 'Webhook URL', required: true },
      { name: 'method', type: 'select', label: 'HTTP Method',
        options: ['post', 'get', 'post_url_encoded'],
        default: 'post' },
      { name: 'fields', type: 'keyvalue', label: 'Field Mapping',
        helperText: 'Map output fields to source paths: event.name, call.caller_id_number, call.direction, call.duration_time, call.extension_username, call.did_number, call.queue_name, call.uuid' }
    ]
  },
  api_call: {
    label: 'API Call',
    category: 'general',
    icon: 'globe',
    color: '#ec4899',
    description: 'Make an HTTP request (same engine as Webhook)',
    inputs: [{ id: 'in', label: 'In' }],
    outputs: [{ id: 'webhook_sent', label: 'Success' }, { id: 'webhook_failed', label: 'Failed' }],
    properties: [
      { name: 'url', type: 'string', label: 'URL', required: true },
      { name: 'method', type: 'select', label: 'Method',
        options: ['post', 'get', 'post_url_encoded'],
        default: 'post' },
      { name: 'fields', type: 'keyvalue', label: 'Field Mapping',
        helperText: 'Map output fields to source paths: event.name, call.caller_id_number, call.direction, call.duration_time, call.extension_username, call.did_number, call.queue_name, call.uuid' }
    ]
  },
};

// Category configuration — includes API categories
export const NODE_CATEGORIES = [
  { id: 'general', name: 'General', icon: 'circle', color: '#6366f1' },
  { id: 'campaign', name: 'Campaign', icon: 'campaign', color: '#f97316' },
  { id: 'widget', name: 'Widget', icon: 'widgets', color: '#06b6d4' },
  { id: 'report', name: 'Report', icon: 'assessment', color: '#8b5cf6' },
];

/**
 * Transform a single API field definition to admin property format.
 * API: { key, label, type, description, default, required, options }
 * Admin: { name, label, type, helperText, default, required, options }
 */
const transformField = (field) => {
  const prop = {
    name: field.key,
    label: field.label || field.key,
    type: field.type === 'key_value' ? 'keyvalue' : field.type,
  };
  if (field.description) prop.helperText = field.description;
  if (field.default !== undefined) prop.default = field.default;
  if (field.required) prop.required = true;
  // Options: API sends [{value,label}], admin uses plain strings
  if (field.options && Array.isArray(field.options)) {
    prop.options = field.options.map(opt =>
      typeof opt === 'object' ? opt.value : opt
    );
  }
  return prop;
};

/**
 * Transform API node types response to admin format.
 * Merges with local overrides (icon, color, inputs) and preserves local-only nodes (end).
 *
 * @param {Object} apiTypes - Map from API: { type → { label, description, category, fields[], outputs[] } }
 * @returns {Object} - Merged node types in admin format
 */
export const mergeNodeTypes = (apiTypes) => {
  if (!apiTypes || typeof apiTypes !== 'object') return POCKETFLOW_NODE_TYPES;

  const merged = {};

  // Transform each API type to admin format
  for (const [type, apiDef] of Object.entries(apiTypes)) {
    // Remap legacy categories to match admin categories
    let category = apiDef.category || 'general';
    if (category === 'flow' || category === 'integration') category = 'general';

    const local = LOCAL_OVERRIDES[type];
    const catDefaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.general;

    merged[type] = {
      label: apiDef.label || type,
      category,
      icon: local?.icon || catDefaults.icon,
      color: local?.color || catDefaults.color,
      description: apiDef.description || '',
      inputs: local?.inputs ?? [{ id: 'in', label: 'In' }],
      outputs: local?.outputs || (apiDef.outputs || []).map(o => ({
        id: o.handle,
        label: o.label || o.handle,
      })),
      properties: (apiDef.fields || []).map(transformField),
    };
  }

  // Preserve local-only nodes not in API (e.g. 'end')
  for (const [type, localDef] of Object.entries(POCKETFLOW_NODE_TYPES)) {
    if (!merged[type]) {
      merged[type] = localDef;
    }
  }

  return merged;
};

/**
 * Derive categories from a merged node types config.
 * Returns only categories that have at least one node.
 */
export const deriveCategories = (nodeTypesConfig) => {
  const usedCategories = new Set();
  for (const def of Object.values(nodeTypesConfig)) {
    usedCategories.add(def.category);
  }
  // Return all known categories that have nodes, preserving order
  return NODE_CATEGORIES.filter(c => usedCategories.has(c.id));
};

// Create specialized node components using BasePocketFlowNode
const createNodeComponent = (type, config) => {
  const NodeComponent = memo((props) => (
    <BasePocketFlowNode
      {...props}
      type={type}
      data={{
        ...props.data,
        icon: config.icon,
        color: props.data?.color || config.color,
        category: config.category,
        inputs: config.inputs,
        outputs: config.outputs,
        nodeConfig: config,
      }}
    />
  ));
  NodeComponent.displayName = `${type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Node`;
  return NodeComponent;
};

/**
 * Create ReactFlow nodeTypes map from dynamic node config.
 * @param {Object} nodeConfig - Merged node types (same shape as POCKETFLOW_NODE_TYPES)
 * @returns {Object} - ReactFlow-compatible { type: Component } map
 */
export const createDynamicNodeTypes = (nodeConfig) => {
  return Object.fromEntries(
    Object.entries(nodeConfig).map(([type, config]) => [
      type,
      createNodeComponent(type, config)
    ])
  );
};

// Generate node components from POCKETFLOW_NODE_TYPES (static fallback)
export const nodeTypes = createDynamicNodeTypes(POCKETFLOW_NODE_TYPES);

// Flatten node types for the palette
export const NODE_TYPES_CONFIG = Object.entries(POCKETFLOW_NODE_TYPES).map(([type, config]) => ({
  type,
  ...config,
}));

// Get nodes by category
export const getNodesByCategory = (categoryId) => {
  return NODE_TYPES_CONFIG.filter(node => node.category === categoryId);
};

// Example workflows — focused on event-driven webhook patterns
export const EXAMPLE_WORKFLOWS = [
  {
    id: 'example-crm-webhook',
    name: 'CRM Webhook',
    type: 'event',
    description: 'Push call events to a CRM (Salesforce, HubSpot, etc.)',
    nodes: [
      { id: 'start-1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start', flowName: 'crm_webhook' } },
      { id: 'wh-1', type: 'webhook', position: { x: 100, y: 250 }, data: {
        label: 'Push to CRM',
        url: 'https://hooks.salesforce.com/services/callcenter/events',
        method: 'post',
        fields: {
          event_type: 'event.name',
          caller_number: 'call.caller_id_number',
          agent_ext: 'call.extension_username',
          call_direction: 'call.direction',
          call_duration: 'call.duration_time',
          queue: 'call.queue_name',
        }
      }},
      { id: 'end-1', type: 'end', position: { x: 100, y: 420 }, data: { label: 'Done', reason: 'completed' } },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'wh-1', sourceHandle: 'next' },
      { id: 'e2', source: 'wh-1', target: 'end-1', sourceHandle: 'webhook_sent' },
    ]
  },
];

export default nodeTypes;
