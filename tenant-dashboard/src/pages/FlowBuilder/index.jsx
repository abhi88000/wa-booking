// FlowBuilder - Visual Canvas Edition
import { useState, useEffect, useCallback, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import api from '../../api';
import { validateFlowDraft } from '../flowBuilderUtils';

import Canvas from './Canvas';
import Toolbar from './Toolbar';
import NodeEditor from './NodeEditor';
import TemplatePicker from './TemplatePicker';
import { Ico } from './icons';
import { useHistory } from './useHistory';
import { autoLayout } from './useAutoLayout';
import { flowToGraph, graphToFlow, generateNodeId } from './converter';

const NODE_DEFAULTS = {
  menu:      { type: 'menu',      message: 'Hello! Choose an option:', buttons: [] },
  input:     { type: 'input',     message: 'What is your name?', variable: 'answer', input_type: 'text' },
  condition: { type: 'condition', variable: '', rules: [] },
  action:    { type: 'action',    action_type: 'save_record', record_type: 'lead' }
};

export default function FlowBuilder() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [labels, setLabels] = useState({ staff: 'Doctor', customer: 'Patient', booking: 'Appointment' });
  const [messageOverrides, setMessageOverrides] = useState({});
  const [originalFlow, setOriginalFlow] = useState({});
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const originalFlowRef = useRef({});

  const { state: graph, set: setGraph, undo, redo, canUndo, canRedo, reset } = useHistory({ nodes: [], edges: [] });
  const { nodes, edges } = graph;

  const setNodes = useCallback((updater) => {
    setGraph(prev => ({
      ...prev,
      nodes: typeof updater === 'function' ? updater(prev.nodes) : updater
    }));
  }, [setGraph]);

  const setEdges = useCallback((updater) => {
    setGraph(prev => ({
      ...prev,
      edges: typeof updater === 'function' ? updater(prev.edges) : updater
    }));
  }, [setGraph]);

  // Load
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.getFlowConfig();
        let fc = data.flow_config;
        if (!fc || Object.keys(fc).length === 0) {
          setShowTemplates(true);
          fc = { fallback: '' };
        }
        originalFlowRef.current = fc;
        setOriginalFlow(fc);
        const { nodes: gn, edges: ge } = flowToGraph(fc);
        const laidOut = gn.some(n => n.position.x === 0 && n.position.y === 0)
          ? autoLayout(gn, ge)
          : gn;
        reset({ nodes: laidOut, edges: ge });
        setLabels(data.labels || labels);
        setMessageOverrides(data.messages || {});
      } catch (e) {
        setError('Failed to load flow');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  const updateNodeData = useCallback((newData) => {
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, data: { ...newData, id: n.id } } : n));
  }, [selectedNodeId, setNodes]);

  const addNode = useCallback((type) => {
    const id = generateNodeId(type);
    const defaults = NODE_DEFAULTS[type] || NODE_DEFAULTS.menu;
    const newNode = {
      id,
      type,
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { ...defaults, id, name: `New ${type}` }
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(id);
  }, [setNodes]);

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId || selectedNodeId === 'start') return;
    setGraph(prev => ({
      nodes: prev.nodes.filter(n => n.id !== selectedNodeId),
      edges: prev.edges.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId)
    }));
    setSelectedNodeId(null);
  }, [selectedNodeId, setGraph]);

  const duplicateSelected = useCallback(() => {
    if (!selectedNode) return;
    const newId = generateNodeId(selectedNode.type || 'screen');
    const copy = {
      ...selectedNode,
      id: newId,
      position: { x: selectedNode.position.x + 40, y: selectedNode.position.y + 40 },
      data: { ...selectedNode.data, id: newId, name: `${selectedNode.data.name || newId} (copy)` }
    };
    setNodes(prev => [...prev, copy]);
    setSelectedNodeId(newId);
  }, [selectedNode, setNodes]);

  // Connect (drag-and-drop wire)
  const onConnect = useCallback((connection) => {
    const { source, sourceHandle, target } = connection;
    setGraph(prev => {
      const newNodes = prev.nodes.map(n => {
        if (n.id !== source) return n;
        const data = { ...n.data };
        const type = data.type;
        if (type === 'menu') {
          const m = sourceHandle && sourceHandle.match(/^btn-(\d+)$/);
          const buttons = Array.isArray(data.buttons) ? [...data.buttons] : [];
          if (m) {
            const i = parseInt(m[1], 10);
            if (buttons[i]) buttons[i] = { ...buttons[i], action: 'next', next: target };
          } else {
            buttons.push({ id: `btn_${Date.now()}`, label: 'Continue', action: 'next', next: target });
          }
          data.buttons = buttons;
        } else if (type === 'input' || type === 'action') {
          data.next = target;
        } else if (type === 'condition') {
          const m = sourceHandle && sourceHandle.match(/^rule-(\d+)$/);
          const rules = Array.isArray(data.rules) ? [...data.rules] : [];
          if (m) {
            const i = parseInt(m[1], 10);
            if (rules[i]) rules[i] = { ...rules[i], next: target };
          } else if (sourceHandle === 'else') {
            data.else_next = target;
          }
          data.rules = rules;
        }
        return { ...n, data };
      });
      const tempFlow = graphToFlow(newNodes, prev.edges, originalFlowRef.current);
      const { edges: rebuilt } = flowToGraph(tempFlow);
      return { nodes: newNodes, edges: rebuilt };
    });
  }, [setGraph]);

  // Rebuild edges when node data changes
  useEffect(() => {
    if (nodes.length === 0) return;
    const tempFlow = graphToFlow(nodes, edges, originalFlowRef.current);
    const { edges: rebuilt } = flowToGraph(tempFlow);
    const same = rebuilt.length === edges.length && rebuilt.every((e, i) =>
      edges[i] && e.id === edges[i].id && e.source === edges[i].source && e.target === edges[i].target
    );
    if (!same) setEdges(rebuilt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const doSave = async () => {
    const flow = graphToFlow(nodes, edges, originalFlowRef.current);
    const errs = validateFlowDraft(flow);
    if (errs.length > 0) {
      setValidationErrors(errs);
      setError(errs[0]);
      return;
    }
    setValidationErrors([]);
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.saveFlowConfig({ flow_config: flow, labels, messages: messageOverrides });
      originalFlowRef.current = flow;
      setOriginalFlow(flow);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const doCancel = () => {
    const { nodes: gn, edges: ge } = flowToGraph(originalFlow);
    reset({ nodes: gn, edges: ge });
    setSelectedNodeId(null);
    setError('');
  };

  const onPickTemplate = (template) => {
    const fc = JSON.parse(JSON.stringify(template.flow));
    originalFlowRef.current = fc;
    setOriginalFlow(fc);
    const { nodes: gn, edges: ge } = flowToGraph(fc);
    const laidOut = autoLayout(gn, ge);
    reset({ nodes: laidOut, edges: ge });
    setShowTemplates(false);
    setSelectedNodeId(null);
  };

  const doAutoLayout = () => {
    setNodes(prev => autoLayout(prev, edges));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <Ico.spinner className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          Loading your flow...
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col bg-slate-100">
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Flow Builder</h1>
            <p className="text-xs text-slate-500">Design what happens when a customer messages you on WhatsApp</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTemplates(true)} className="text-sm px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 inline-flex items-center gap-1.5">
              <Ico.template className="w-4 h-4" /> Templates
            </button>
            {saved && (
              <span className="text-sm text-emerald-600 inline-flex items-center gap-1">
                <Ico.check className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>

        <Toolbar
          onAddNode={addNode}
          onAutoLayout={doAutoLayout}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onSave={doSave}
          onCancel={doCancel}
          saving={saving}
          errors={validationErrors}
        />

        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0 relative">
            <Canvas
              nodes={nodes}
              edges={edges}
              setNodes={setNodes}
              setEdges={setEdges}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onConnect={onConnect}
            />
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-slate-400">
                  <Ico.canvas className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <div className="text-lg font-medium">Empty canvas</div>
                  <div className="text-sm mt-1">Pick a template or click "Add Menu" above to begin</div>
                </div>
              </div>
            )}
          </div>

          <aside className="w-[380px] border-l border-slate-200 bg-white shrink-0">
            <NodeEditor
              node={selectedNode}
              allNodes={nodes}
              onChange={updateNodeData}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
              onClose={() => setSelectedNodeId(null)}
            />
          </aside>
        </div>

        <TemplatePicker open={showTemplates} onPick={onPickTemplate} onClose={() => setShowTemplates(false)} />
      </div>
    </ReactFlowProvider>
  );
}