// ============================================================
// Visual Canvas (React Flow)
// ============================================================
import { useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, applyNodeChanges, applyEdgeChanges
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import MenuNode from './nodes/MenuNode';
import InputNode from './nodes/InputNode';
import ConditionNode from './nodes/ConditionNode';
import ActionNode from './nodes/ActionNode';

const nodeTypes = {
  menu: MenuNode,
  input: InputNode,
  condition: ConditionNode,
  action: ActionNode
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#10b981', strokeWidth: 2 }
};

export default function Canvas({ nodes, edges, setNodes, setEdges, onSelectNode, selectedNodeId, onConnect }) {
  const onNodesChange = useCallback((changes) => {
    setNodes(prev => applyNodeChanges(changes, prev));
  }, [setNodes]);

  const onEdgesChange = useCallback((changes) => {
    setEdges(prev => applyEdgeChanges(changes, prev));
  }, [setEdges]);

  const handleConnect = useCallback((connection) => {
    onConnect(connection);
  }, [onConnect]);

  const handleNodeClick = useCallback((_, node) => {
    onSelectNode(node.id);
  }, [onSelectNode]);

  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  // Annotate selection
  const styledNodes = nodes.map(n => ({ ...n, selected: n.id === selectedNodeId }));

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      nodeTypes={nodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} color="#e2e8f0" />
      <Controls />
      <MiniMap pannable zoomable nodeColor={n => {
        switch (n.type) {
          case 'menu': return '#bfdbfe';
          case 'input': return '#e9d5ff';
          case 'condition': return '#fde68a';
          case 'action': return '#a7f3d0';
          default: return '#cbd5e1';
        }
      }} />
    </ReactFlow>
  );
}
