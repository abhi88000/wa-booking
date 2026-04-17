import { useState, useEffect } from 'react';
import api from '../api';

const ACTION_TYPES = [
  { value: 'next', label: 'Go to another screen' },
  { value: 'booking_flow', label: 'Start booking process' },
  { value: 'text', label: 'Send a text reply' },
  { value: 'ai', label: 'Hand off to AI' },
];

const LABEL_HELP = {
  staff: { title: 'Staff Title', example: 'e.g. Doctor, Stylist, Trainer', desc: 'What your team members are called. The bot says "Choose a {Staff Title}" when booking.' },
  customer: { title: 'Customer Title', example: 'e.g. Patient, Client, Student', desc: 'What your customers are called. The bot says "Dear {Customer Title}, your booking is confirmed."' },
  booking: { title: 'Booking Title', example: 'e.g. Appointment, Session, Visit', desc: 'What your bookings are called. Buttons say "Book {Booking Title}" and "My {Booking Title}s".' },
};

const EMPTY_BUTTON = { id: '', label: '', action: 'next', next: '', response: '', description: '' };

function InfoTip({ text, example }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1.5">
      <button type="button" onClick={e => { e.preventDefault(); setOpen(!open); }}
        className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#25D366]/10 text-[#128C7E] text-[10px] font-bold hover:bg-[#25D366]/20 transition leading-none">
        ?
      </button>
      {open && (
        <div className="absolute z-20 bottom-7 left-1/2 -translate-x-1/2 w-64 bg-[#0f172a] text-white text-xs rounded-lg px-3 py-2.5 shadow-xl">
          <p className="leading-relaxed">{text}</p>
          <p className="text-gray-400 mt-1">{example}</p>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0f172a] rotate-45" />
        </div>
      )}
    </span>
  );
}

function PhonePreview({ flow, previewNode, onTapButton, labels }) {
  const node = flow?.[previewNode];
  const [showBooking, setShowBooking] = useState(false);
  if (!node) return null;

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const buttons = node.buttons || [];
  const isButtons = buttons.length > 0 && buttons.length <= 3;
  const isList = buttons.length > 3;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#0f172a]">Preview</h3>
        {previewNode !== 'start' && (
          <button onClick={() => onTapButton('start')} className="text-xs font-medium text-[#128C7E] hover:text-[#25D366]">Back to Start</button>
        )}
      </div>
      <div className="mx-auto w-full max-w-[280px] rounded-2xl overflow-hidden border border-gray-200 shadow-md">
        <div className="bg-[#075e54] text-white px-3 py-2.5 flex items-center gap-2">
          <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium leading-tight">Your Business</div>
            <div className="text-[10px] text-white/50">online</div>
          </div>
        </div>
        <div className="bg-[#efeae2] px-3 py-3 min-h-[150px]">
          <div className="bg-white rounded-lg rounded-tl-none shadow-sm max-w-[240px]">
            <div className="px-3 py-2 text-[13px] text-[#334155] whitespace-pre-wrap leading-snug">
              {node.message || '(empty)'}
              <span className="float-right text-[9px] text-[#64748b] mt-1 ml-2">{time}</span>
            </div>
            {isButtons && (
              <div className="border-t border-gray-100">
                {buttons.map((btn, i) => (
                  <button key={i} onClick={() => {
                    if (btn.action === 'next' && btn.next && flow[btn.next]) onTapButton(btn.next);
                    if (btn.action === 'booking_flow') setShowBooking(true);
                  }}
                    className={`block w-full text-center py-2 text-[13px] text-[#00a5f4] font-medium hover:bg-gray-50 ${i < buttons.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    {btn.label || '(no label)'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isList && (
            <div className="mt-2 max-w-[240px]">
              <div className="bg-white rounded-lg shadow-sm text-center py-2 text-[13px] text-[#00a5f4] font-medium">
                View Options ({buttons.length})
              </div>
            </div>
          )}
        </div>
        <div className="bg-[#f0f0f0] px-2 py-1.5 flex items-center gap-1.5">
          <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[11px] text-[#64748b]">Type a message</div>
          <div className="w-7 h-7 bg-[#075e54] rounded-full" />
        </div>
      </div>
      <p className="text-center text-[11px] text-[#64748b] mt-2">
        {previewNode === 'start' ? 'First message customer sees' : `Screen: ${previewNode}`}
        {buttons.some(b => b.action === 'next' && b.next) && '  --  Click a button to navigate'}
      </p>

      {showBooking && (
        <div className="mt-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[#0f172a]">Booking Flow (automatic)</h4>
            <button onClick={() => setShowBooking(false)} className="text-xs font-medium text-[#64748b] hover:text-[#334155]">Close</button>
          </div>
          <div className="space-y-2">
            {[
              `1. Customer picks a ${labels?.staff || 'Staff'}`,
              '2. Customer picks a date',
              '3. Customer picks a time slot',
              `4. Bot shows ${labels?.booking || 'Booking'} summary`,
              `5. Customer confirms -- ${labels?.booking || 'Booking'} is saved`,
            ].map((s, i) => (
              <p key={i} className="text-sm text-[#334155]">{s}</p>
            ))}
          </div>
          <p className="text-xs text-[#64748b] mt-3">Uses your staff, services and working hours from Settings.</p>
        </div>
      )}
    </div>
  );
}

function FlowMap({ flow, nodeIds, onJumpTo }) {
  const desc = (btn) => {
    if (btn.action === 'next') return btn.next || '(not linked)';
    if (btn.action === 'booking_flow') return 'Booking';
    if (btn.action === 'text') return 'Text reply';
    if (btn.action === 'ai') return 'AI';
    return btn.action;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-4">
      <h3 className="text-sm font-semibold text-[#0f172a] mb-1">Conversation Map</h3>
      <p className="text-xs text-[#64748b] mb-3">How screens connect -- the path your customer follows</p>
      <div className="space-y-3">
        {nodeIds.map((nodeId, idx) => {
          const node = flow[nodeId];
          if (!node || typeof node !== 'object') return null;
          const isStart = nodeId === 'start';
          return (
            <div key={nodeId} className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-0.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${isStart ? 'bg-[#25D366] text-white' : 'bg-[#e2e8f0] text-[#334155]'}`}>
                  {idx + 1}
                </div>
                {idx < nodeIds.length - 1 && <div className="w-px h-5 bg-[#e2e8f0] mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <button onClick={() => onJumpTo(nodeId)} className="text-sm font-semibold text-[#0f172a] hover:text-[#128C7E] text-left transition">
                  {isStart ? 'Start Screen' : nodeId}
                </button>
                <p className="text-xs text-[#64748b] truncate">{node.message?.substring(0, 55)}</p>
                {(node.buttons || []).length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {(node.buttons || []).map((btn, bi) => (
                      <p key={bi} className="text-xs text-[#334155]">
                        <span className="font-medium">{btn.label}</span>
                        <span className="text-[#64748b] mx-1">--</span>
                        <span className="text-[#64748b]">{desc(btn)}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FlowBuilder() {
  const [flow, setFlow] = useState(null);
  const [labels, setLabels] = useState({ staff: 'Doctor', customer: 'Patient', booking: 'Appointment' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [previewNode, setPreviewNode] = useState('start');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.getFlowConfig();
      setFlow(data.flow_config || getDefaultFlow());
      setLabels(data.labels || { staff: 'Doctor', customer: 'Patient', booking: 'Appointment' });
    } catch (e) {
      setError('Failed to load');
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
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.saveFlowConfig({ flow_config: flow, labels });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  }

  function addNode() {
    const id = `screen_${Date.now()}`;
    setFlow(prev => ({ ...prev, [id]: { message: 'New screen', buttons: [] } }));
    setEditingNode(id);
  }

  function deleteNode(nodeId) {
    if (nodeId === 'start') return;
    setFlow(prev => { const n = { ...prev }; delete n[nodeId]; return n; });
    if (editingNode === nodeId) setEditingNode(null);
  }

  function updateNode(nodeId, updates) {
    setFlow(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], ...updates } }));
  }

  function renameNode(oldId, newId) {
    if (oldId === newId || !newId || newId === 'fallback') return;
    setFlow(prev => {
      const next = {};
      for (const [key, val] of Object.entries(prev)) {
        const nodeKey = key === oldId ? newId : key;
        if (typeof val === 'object' && val !== null && val.buttons) {
          next[nodeKey] = { ...val, buttons: val.buttons.map(b => ({ ...b, next: b.next === oldId ? newId : b.next })) };
        } else { next[nodeKey] = val; }
      }
      return next;
    });
    if (editingNode === oldId) setEditingNode(newId);
  }

  const nodeIds = flow ? Object.keys(flow).filter(k => k !== 'fallback') : [];
  const fallback = flow?.fallback || '';

  if (loading) return <div className="p-6 text-[#64748b]">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[#0f172a]">Flow Builder</h1>
          <p className="text-sm text-[#64748b] mt-0.5">Configure your WhatsApp bot conversation</p>
        </div>
        <button onClick={save} disabled={saving}
          className="w-full sm:w-auto px-5 py-2.5 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition hover:shadow-md"
          style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</div>}
      {saved && <div className="mb-4 text-sm text-[#128C7E] bg-[#25D366]/10 border border-[#25D366]/20 rounded-lg px-4 py-2.5">Flow saved successfully</div>}

      {/* Preview */}
      <PhonePreview flow={flow} previewNode={previewNode} onTapButton={setPreviewNode} labels={labels} />

      {/* Labels */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-4">
        <h3 className="text-sm font-semibold text-[#0f172a] mb-1">Business Labels</h3>
        <p className="text-xs text-[#64748b] mb-3">Used throughout bot messages -- match these to your business</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(LABEL_HELP).map(([key, help]) => (
            <div key={key}>
              <label className="text-xs font-medium text-[#334155] mb-1 flex items-center">
                {help.title}
                <InfoTip text={help.desc} example={help.example} />
              </label>
              <input value={labels[key] || ''} onChange={e => setLabels(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={help.example.split(', ')[0].replace('e.g. ', '')}
                className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#334155] outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/20 transition" />
            </div>
          ))}
        </div>
      </div>

      {/* Fallback */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-4">
        <h3 className="text-sm font-semibold text-[#0f172a] mb-1">Fallback Message</h3>
        <p className="text-xs text-[#64748b] mb-2">Sent when customer types something instead of tapping a button</p>
        <input value={fallback} onChange={e => setFlow(prev => ({ ...prev, fallback: e.target.value }))}
          className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#334155] outline-none focus:border-[#25D366] focus:ring-1 focus:ring-[#25D366]/20 transition"
          placeholder="Sorry, I didn't understand. Please pick an option." />
      </div>

      {/* Flow Map */}
      <FlowMap flow={flow} nodeIds={nodeIds} onJumpTo={(id) => { setEditingNode(editingNode === id ? null : id); setPreviewNode(id); }} />

      {/* Screens */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[#0f172a] mb-1">Conversation Screens</h3>
        <p className="text-xs text-[#64748b]">Each screen is a message the customer sees. Tap to edit.</p>
      </div>

      {nodeIds.map((nodeId, idx) => (
        <NodeCard
          key={nodeId} nodeId={nodeId} node={flow[nodeId]} stepNumber={idx + 1}
          allNodes={nodeIds} flow={flow} isEditing={editingNode === nodeId}
          onEdit={() => { setEditingNode(editingNode === nodeId ? null : nodeId); setPreviewNode(nodeId); }}
          onUpdate={(u) => updateNode(nodeId, u)} onDelete={() => deleteNode(nodeId)}
          onRename={(newId) => renameNode(nodeId, newId)}
        />
      ))}

      <button onClick={addNode}
        className="w-full mt-2 py-3 border-2 border-dashed border-[#e2e8f0] rounded-xl text-sm font-medium text-[#64748b] hover:border-[#25D366] hover:text-[#128C7E] transition">
        + Add Screen
      </button>
      <p className="text-[11px] text-[#64748b] mt-1.5 px-1">Most businesses only need the Start Screen. Add screens for sub-menus (e.g. Services list).</p>
    </div>
  );
}

function NodeCard({ nodeId, node, stepNumber, allNodes, flow, isEditing, onEdit, onUpdate, onDelete, onRename }) {
  const [renameId, setRenameId] = useState(nodeId);
  const isStart = nodeId === 'start';

  function addButton() {
    onUpdate({ buttons: [...(node.buttons || []), { ...EMPTY_BUTTON, id: `btn_${Date.now()}` }] });
  }
  function updateButton(idx, updates) {
    const b = [...(node.buttons || [])]; b[idx] = { ...b[idx], ...updates }; onUpdate({ buttons: b });
  }
  function removeButton(idx) {
    onUpdate({ buttons: (node.buttons || []).filter((_, i) => i !== idx) });
  }
  function moveButton(idx, dir) {
    const b = [...(node.buttons || [])]; const n = idx + dir;
    if (n < 0 || n >= b.length) return;
    [b[idx], b[n]] = [b[n], b[idx]]; onUpdate({ buttons: b });
  }

  const actionDesc = (btn) => {
    if (btn.action === 'next') return btn.next ? `Goes to "${btn.next}"` : 'Not linked yet';
    if (btn.action === 'booking_flow') return 'Starts booking (staff, date, time, confirm)';
    if (btn.action === 'text') return 'Sends a text reply';
    if (btn.action === 'ai') return 'Hands off to AI';
    return btn.action;
  };

  return (
    <div className={`bg-white rounded-xl border mb-3 transition ${isEditing ? 'border-[#25D366] shadow-sm ring-1 ring-[#25D366]/10' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-6 h-6 flex-shrink-0 flex items-center justify-center text-[11px] font-bold rounded-full ${isStart ? 'bg-[#25D366] text-white' : 'bg-[#f8fafc] text-[#334155] border border-[#e2e8f0]'}`}>
            {stepNumber}
          </span>
          <div className="min-w-0">
            <span className="text-sm font-semibold text-[#0f172a]">{isStart ? 'Start Screen' : nodeId}</span>
            <p className="text-xs text-[#64748b] truncate max-w-[200px] sm:max-w-sm">{node.message?.substring(0, 60)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[#64748b] hidden sm:inline">{(node.buttons || []).length} buttons</span>
          <svg className={`w-4 h-4 text-[#64748b] transition ${isEditing ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </div>
      </div>

      {isEditing && (
        <div className="px-4 sm:px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
          {!isStart && (
            <div>
              <label className="block text-xs font-medium text-[#334155] mb-1">Screen ID</label>
              <div className="flex gap-2">
                <input value={renameId} onChange={e => setRenameId(e.target.value.replace(/[^a-z0-9_]/g, ''))}
                  className="flex-1 border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm font-mono text-[#334155] outline-none focus:border-[#25D366]" />
                {renameId !== nodeId && (
                  <button onClick={() => onRename(renameId)} className="px-3 py-2 text-xs font-medium bg-[#f8fafc] border border-[#e2e8f0] rounded-lg hover:bg-gray-100 text-[#334155]">Rename</button>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#334155] mb-1">Message</label>
            <textarea value={node.message || ''} onChange={e => onUpdate({ message: e.target.value })} rows={3}
              className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#334155] outline-none focus:border-[#25D366] resize-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-[#334155] mb-2 block">
              Buttons {(node.buttons || []).length > 3 && <span className="text-amber-600 font-normal">(more than 3 shows as list)</span>}
            </label>
            <div className="space-y-2">
              {(node.buttons || []).map((btn, idx) => (
                <div key={idx} className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={btn.label} onChange={e => updateButton(idx, { label: e.target.value })}
                      placeholder="Button text" maxLength={20}
                      className="flex-1 border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#334155] outline-none focus:border-[#25D366]" />
                    <select value={btn.action} onChange={e => updateButton(idx, { action: e.target.value })}
                      className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#334155] outline-none focus:border-[#25D366]">
                      {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  {btn.action === 'next' && (
                    <select value={btn.next || ''} onChange={e => updateButton(idx, { next: e.target.value })}
                      className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#334155] outline-none focus:border-[#25D366]">
                      <option value="">Select target screen</option>
                      {allNodes.filter(n => n !== nodeId).map(n => (
                        <option key={n} value={n}>{n === 'start' ? 'Start Screen' : n}</option>
                      ))}
                    </select>
                  )}
                  {btn.action === 'text' && (
                    <textarea value={btn.response || ''} onChange={e => updateButton(idx, { response: e.target.value })}
                      placeholder="Reply text" rows={2}
                      className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-[#334155] outline-none focus:border-[#25D366] resize-none" />
                  )}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <span className="text-[11px] text-[#64748b]">{actionDesc(btn)}</span>
                    <div className="flex gap-2">
                      {idx > 0 && <button onClick={() => moveButton(idx, -1)} className="text-xs font-medium text-[#64748b] hover:text-[#334155]">Up</button>}
                      {idx < (node.buttons || []).length - 1 && <button onClick={() => moveButton(idx, 1)} className="text-xs font-medium text-[#64748b] hover:text-[#334155]">Down</button>}
                      <button onClick={() => removeButton(idx)} className="text-xs font-medium text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {(node.buttons || []).length < 10 && (
              <button onClick={addButton} className="mt-2 text-xs font-semibold text-[#128C7E] hover:text-[#25D366] transition">+ Add Button</button>
            )}
          </div>

          {!isStart && (
            <div className="pt-3 border-t border-[#e2e8f0]">
              <button onClick={onDelete} className="text-xs font-medium text-red-500 hover:text-red-700 transition">Delete this screen</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
