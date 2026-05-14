// ============================================================
// Auto-Layout using Dagre
// ============================================================
import dagre from '@dagrejs/dagre';

const NODE_W = 280;
const NODE_H = 140;

export function autoLayout(nodes, edges, direction = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80, marginx: 40, marginy: 40 });

  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map(n => {
    const layout = g.node(n.id);
    return {
      ...n,
      position: {
        x: layout.x - NODE_W / 2,
        y: layout.y - NODE_H / 2
      }
    };
  });
}
