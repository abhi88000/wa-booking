import { useState, useEffect } from 'react';
import api from '../api';

const ACTION_TYPES = [
  { value: 'next', label: 'Go to another step' },
  { value: 'booking_flow', label: 'Start booking' },
  { value: 'text', label: 'Send a text reply' },
  { value: 'ai', label: 'Hand off to AI' },
];

const EMPTY_BUTTON = { id: '', label: '', action: 'next', next: '', response: '', description: '' };

export default function FlowBuilder() {
  const [flow, setFlow] = useState(null);
  const [labels, setLabels] = useState({ staff: 'Doctor', customer: 'Patient', booking: 'Appointment' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.getFlowConfig();
      setFlow(data.flow_config || getDefaultFlow());
      setLabels(data.labels || { staff: 'Doctor', customer: 'Patient', booking: 'Appointment' });
    } catch (e) {
      setError('Failed to load flow config');
    } finally {
      setLoading(false);
    }
  }

  function getDefaultFlow() {
    return {
      start: {
        message: 'Welcome! How can I help you today?',
        buttons: [
          { id: 'book', label: 'Book Appointment', action: 'booking_flow' },
          { id: 'status', label: 'My Appointments', action: 'booking_flow' },
          { id: 'contact', label: 'Contact Us', action: 'text', response: 'Please call us or visit our website.' }
        ]
      },
      fallback: 'Sorry, I didn\'t understand that. Please pick an option from the menu.'
    };
  }

  async function save() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.saveFlowConfig({ flow_config: flow, labels });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function addNode() {
    const id = `node_${Date.now()}`;
    setFlow(prev => ({
      ...prev,
      [id]: { message: 'New step', buttons: [] }
    }));
    setEditingNode(id);
  }

  function deleteNode(nodeId) {
    if (nodeId === 'start') return;
    setFlow(prev => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    if (editingNode === nodeId) setEditingNode(null);
  }

  function updateNode(nodeId, updates) {
    setFlow(prev => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], ...updates }
    }));
  }

  function renameNode(oldId, newId) {
    if (oldId === newId || !newId || newId === 'fallback') return;
    setFlow(prev => {
      const next = {};
      for (const [key, val] of Object.entries(prev)) {
        const nodeKey = key === oldId ? newId : key;
        if (typeof val === 'object' && val !== null && val.buttons) {
          next[nodeKey] = {
            ...val,
            buttons: val.buttons.map(b => ({
              ...b,
              next: b.next === oldId ? newId : b.next
            }))
          };
        } else {
          next[nodeKey] = val;
        }
      }
      return next;
    });
    if (editingNode === oldId) setEditingNode(newId);
  }

  const nodeIds = flow ? Object.keys(flow).filter(k => k !== 'fallback') : [];
  const fallback = flow?.fallback || '';

  if (loading) return <div className="p-6 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Flow Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure how your WhatsApp bot responds to customers</p>
        </div>
        <button onClick={save} disabled={saving}
          className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition">
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</div>}
      {saved && <div className="mb-4 text-sm text-green-600 bg-green-50 rounded-lg px-4 py-2">Flow saved successfully</div>}

      {/* Labels */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Business Labels</h3>
        <p className="text-xs text-gray-400 mb-3">Customize how your bot refers to staff and customers</p>
        <div className="grid grid-cols-3 gap-3">
          {[['staff', 'Staff title'], ['customer', 'Customer title'], ['booking', 'Booking title']].map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input value={labels[key] || ''} onChange={e => setLabels(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-slate-400" />
            </div>
          ))}
        </div>
      </div>

      {/* Fallback Message */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Fallback Message</h3>
        <p className="text-xs text-gray-400 mb-2">Sent when customer types something that doesn't match any button</p>
        <input value={fallback} onChange={e => setFlow(prev => ({ ...prev, fallback: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
          placeholder="Sorry, I didn't understand. Please pick an option." />
      </div>

      {/* Nodes */}
      {nodeIds.map(nodeId => (
        <NodeCard
          key={nodeId}
          nodeId={nodeId}
          node={flow[nodeId]}
          allNodes={nodeIds}
          isEditing={editingNode === nodeId}
          onEdit={() => setEditingNode(editingNode === nodeId ? null : nodeId)}
          onUpdate={(updates) => updateNode(nodeId, updates)}
          onDelete={() => deleteNode(nodeId)}
          onRename={(newId) => renameNode(nodeId, newId)}
        />
      ))}

      <button onClick={addNode}
        className="w-full mt-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition">
        + Add Step
      </button>
    </div>
  );
}

function NodeCard({ nodeId, node, allNodes, isEditing, onEdit, onUpdate, onDelete, onRename }) {
  const [renameId, setRenameId] = useState(nodeId);
  const isStart = nodeId === 'start';

  function addButton() {
    const buttons = [...(node.buttons || []), { ...EMPTY_BUTTON, id: `btn_${Date.now()}` }];
    onUpdate({ buttons });
  }

  function updateButton(idx, updates) {
    const buttons = [...(node.buttons || [])];
    buttons[idx] = { ...buttons[idx], ...updates };
    onUpdate({ buttons });
  }

  function removeButton(idx) {
    const buttons = (node.buttons || []).filter((_, i) => i !== idx);
    onUpdate({ buttons });
  }

  function moveButton(idx, dir) {
    const buttons = [...(node.buttons || [])];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= buttons.length) return;
    [buttons[idx], buttons[newIdx]] = [buttons[newIdx], buttons[idx]];
    onUpdate({ buttons });
  }

  const actionLabel = (btn) => {
    if (btn.action === 'next') return `→ ${btn.next || '?'}`;
    if (btn.action === 'booking_flow') return '→ Booking';
    if (btn.action === 'text') return '→ Text reply';
    if (btn.action === 'ai') return '→ AI chat';
    return btn.action;
  };

  return (
    <div className={`bg-white rounded-xl border mb-3 transition ${isEditing ? 'border-slate-400 shadow-sm' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono px-2 py-0.5 rounded ${isStart ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            {isStart ? 'START' : nodeId}
          </span>
          <span className="text-sm text-gray-700 truncate max-w-xs">{node.message?.substring(0, 60)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">{(node.buttons || []).length} buttons</span>
          {!isStart && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }}
              className="ml-2 text-gray-300 hover:text-red-500 transition text-xs">Delete</button>
          )}
        </div>
      </div>

      {/* Expanded Editor */}
      {isEditing && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
          {/* Node ID */}
          {!isStart && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Step ID</label>
              <div className="flex gap-2">
                <input value={renameId} onChange={e => setRenameId(e.target.value.replace(/[^a-z0-9_]/g, ''))}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:border-slate-400" />
                {renameId !== nodeId && (
                  <button onClick={() => onRename(renameId)}
                    className="px-3 py-1.5 text-xs bg-slate-100 rounded-lg hover:bg-slate-200 transition">Rename</button>
                )}
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Message</label>
            <textarea value={node.message || ''} onChange={e => onUpdate({ message: e.target.value })}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none" />
          </div>

          {/* Buttons */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Buttons {(node.buttons || []).length > 3 && <span className="text-amber-500">(will show as list)</span>}</label>
            <div className="space-y-2">
              {(node.buttons || []).map((btn, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={btn.label} onChange={e => updateButton(idx, { label: e.target.value })}
                      placeholder="Button label (max 20 chars)"
                      maxLength={20}
                      className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-slate-400" />
                    <select value={btn.action} onChange={e => updateButton(idx, { action: e.target.value })}
                      className="border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-slate-400">
                      {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>

                  {btn.action === 'next' && (
                    <select value={btn.next || ''} onChange={e => updateButton(idx, { next: e.target.value })}
                      className="w-full border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-slate-400">
                      <option value="">Select target step...</option>
                      {allNodes.filter(n => n !== nodeId).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}

                  {btn.action === 'text' && (
                    <textarea value={btn.response || ''} onChange={e => updateButton(idx, { response: e.target.value })}
                      placeholder="Text reply to send..."
                      rows={2}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-slate-400 resize-none" />
                  )}

                  <div className="flex justify-between">
                    <input value={btn.id} onChange={e => updateButton(idx, { id: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                      placeholder="button_id"
                      className="text-xs font-mono text-gray-400 border border-gray-200 rounded px-2 py-0.5 w-32 outline-none focus:border-slate-400" />
                    <div className="flex gap-1">
                      {idx > 0 && <button onClick={() => moveButton(idx, -1)} className="text-xs text-gray-400 hover:text-gray-600">↑</button>}
                      {idx < (node.buttons || []).length - 1 && <button onClick={() => moveButton(idx, 1)} className="text-xs text-gray-400 hover:text-gray-600">↓</button>}
                      <button onClick={() => removeButton(idx)} className="text-xs text-red-400 hover:text-red-600 ml-1">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {(node.buttons || []).length < 10 && (
              <button onClick={addButton}
                className="mt-2 text-xs text-slate-500 hover:text-slate-700 transition">+ Add Button</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
