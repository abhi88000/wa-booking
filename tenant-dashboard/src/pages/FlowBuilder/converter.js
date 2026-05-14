// ============================================================
// JSON ↔ React Flow Converter
// ============================================================
// Converts the tenant's flow_config JSON to React Flow {nodes, edges}
// and back. Preserves all metadata (positions, _flows, _startFlow, fallback).

const NODE_META_KEYS = new Set(['fallback', '_flows', '_startFlow', '_positions']);

export function isNodeKey(key, value) {
  return !NODE_META_KEYS.has(key) && typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getNodeIds(flow) {
  if (!flow || typeof flow !== 'object') return [];
  return Object.keys(flow).filter(k => isNodeKey(k, flow[k]));
}

/**
 * Convert flow_config JSON to React Flow {nodes, edges}
 */
export function flowToGraph(flow) {
  const nodes = [];
  const edges = [];
  if (!flow || typeof flow !== 'object') return { nodes, edges };

  const positions = flow._positions || {};
  const nodeIds = getNodeIds(flow);

  for (const id of nodeIds) {
    const node = flow[id];
    const type = node.type || 'menu';
    const position = positions[id] || { x: 0, y: 0 };
    nodes.push({
      id,
      type, // custom node type registered with React Flow
      position,
      data: { ...node, id, label: node.name || id }
    });
  }

  // Build edges from outgoing references
  for (const id of nodeIds) {
    const node = flow[id];
    const type = node.type || 'menu';

    if (type === 'menu') {
      const buttons = Array.isArray(node.buttons) ? node.buttons : [];
      buttons.forEach((btn, i) => {
        if (btn.action === 'next' && btn.next) {
          edges.push({
            id: `${id}__btn${i}__${btn.next}`,
            source: id,
            sourceHandle: `btn-${i}`,
            target: btn.next,
            label: btn.label || btn.id,
            type: 'smoothstep',
            animated: false
          });
        }
      });
    } else if (type === 'input' || type === 'action') {
      if (node.next) {
        edges.push({
          id: `${id}__next__${node.next}`,
          source: id,
          sourceHandle: 'next',
          target: node.next,
          type: 'smoothstep'
        });
      }
    } else if (type === 'condition') {
      const rules = Array.isArray(node.rules) ? node.rules : [];
      rules.forEach((rule, i) => {
        if (rule.next) {
          edges.push({
            id: `${id}__rule${i}__${rule.next}`,
            source: id,
            sourceHandle: `rule-${i}`,
            target: rule.next,
            label: `if ${rule.operator || 'equals'} ${rule.value ?? ''}`,
            type: 'smoothstep'
          });
        }
      });
      if (node.else_next) {
        edges.push({
          id: `${id}__else__${node.else_next}`,
          source: id,
          sourceHandle: 'else',
          target: node.else_next,
          label: 'else',
          type: 'smoothstep',
          style: { stroke: '#94a3b8' }
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Convert React Flow {nodes, edges} back to flow_config JSON
 * Preserves node data and updates positions.
 */
export function graphToFlow(nodes, edges, originalFlow = {}) {
  const result = {};

  // Preserve metadata
  if (originalFlow.fallback !== undefined) result.fallback = originalFlow.fallback;
  if (originalFlow._flows !== undefined) result._flows = originalFlow._flows;
  if (originalFlow._startFlow !== undefined) result._startFlow = originalFlow._startFlow;

  // Store positions
  const positions = {};

  for (const n of nodes) {
    positions[n.id] = n.position;
    // Strip React Flow-specific keys, keep raw node config
    const { id, label, ...rest } = n.data || {};
    result[n.id] = { ...rest };
  }

  result._positions = positions;
  return result;
}

/**
 * Generate a fresh unique node ID
 */
export function generateNodeId(prefix = 'screen') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
