import { useState, useEffect } from 'react';
import api from '../api';

const ACTION_TYPES = [
  { value: 'next', label: 'Go to another screen' },
  { value: 'booking_flow', label: 'Start booking process' },
  { value: 'text', label: 'Send a text reply' },
  { value: 'ai', label: 'Hand off to AI' },
];

const LABEL_HELP = {
  staff: { title: 'Staff Title', example: 'e.g. Doctor, Stylist, Trainer, Counselor', desc: 'What your team members are called. The bot will say "Choose a {Staff Title}" when booking.' },
  customer: { title: 'Customer Title', example: 'e.g. Patient, Client, Student, Member', desc: 'What your customers are called. The bot will say "Dear {Customer Title}, your booking is confirmed."' },
  booking: { title: 'Booking Title', example: 'e.g. Appointment, Session, Visit, Class', desc: 'What your bookings are called. Buttons will say "Book {Booking Title}" and "My {Booking Title}s".' },
};

const EMPTY_BUTTON = { id: '', label: '', action: 'next', next: '', response: '', description: '' };

/* ── Tooltip component ── */
function InfoTip({ text, example }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <button type="button" onClick={e => { e.preventDefault(); setOpen(!open); }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold hover:bg-slate-300 transition leading-none">
        i
      </button>
      {open && (
        <div className="absolute z-20 bottom-6 left-1/2 -translate-x-1/2 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
          <p>{text}</p>
          <p className="text-slate-300 mt-1 italic">{example}</p>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45" />
        </div>
      )}
    </span>
  );
}

/* ── Phone Preview ── */
function PhonePreview({ flow, previewNode, onTapButton }) {
  const node = flow?.[previewNode];
  if (!node) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Live Preview — What your customer sees</h3>
        {previewNode !== 'start' && (
          <button onClick={() => onTapButton('start')} className="text-xs text-slate-500 hover:text-slate-700 transition">← Back to Start</button>
        )}
      </div>
      <div className="mx-auto w-72 bg-[#efeae2] rounded-2xl overflow-hidden shadow-inner border border-gray-300">
        {/* Top bar */}
        <div className="bg-[#075e54] text-white px-4 py-2 flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-xs">🤖</div>
          <span className="text-sm font-medium">Your Bot</span>
        </div>
        {/* Chat area */}
        <div className="px-3 py-4 min-h-[140px]">
          <div className="bg-white rounded-lg px-3 py-2 text-sm text-gray-800 shadow-sm max-w-[220px] whitespace-pre-wrap">
            {node.message || '(empty message)'}
          </div>
          {(node.buttons || []).length > 0 && (
            <div className="mt-2 space-y-1">
              {(node.buttons || []).map((btn, i) => (
                <button key={i} onClick={() => {
                  if (btn.action === 'next' && btn.next && flow[btn.next]) onTapButton(btn.next);
                }}
                  className="block w-full text-left bg-white rounded-lg px-3 py-1.5 text-sm text-[#075e54] font-medium shadow-sm hover:bg-gray-50 transition border border-gray-100">
                  {btn.label || '(no label)'}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Input bar */}
        <div className="bg-[#f0f0f0] px-3 py-2 flex items-center gap-2">
          <div className="flex-1 bg-white rounded-full px-3 py-1 text-xs text-gray-400">Type a message...</div>
          <div className="w-6 h-6 bg-[#075e54] rounded-full flex items-center justify-center text-white text-[10px]">▶</div>
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-400 mt-2">
        {previewNode === 'start' ? 'This is the first screen your customer sees' : `Viewing: ${previewNode}`}
        {(node.buttons || []).some(b => b.action === 'next' && b.next) && ' · Tap a button to preview the next screen'}
      </p>
    </div>
  );
}

/* ── Flow Map — visual connection diagram ── */
function FlowMap({ flow, nodeIds, onJumpTo }) {
  const getActionDesc = (btn) => {
    if (btn.action === 'next') return btn.next ? `screen "${btn.next}"` : '(not linked)';
    if (btn.action === 'booking_flow') return 'booking process';
    if (btn.action === 'text') return 'text reply';
    if (btn.action === 'ai') return 'AI assistant';
    return btn.action;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Conversation Map</h3>
      <p className="text-xs text-gray-400 mb-3">How your screens connect together — the path your customer follows</p>
      <div className="space-y-3">
        {nodeIds.map((nodeId, idx) => {
          const node = flow[nodeId];
          if (!node || typeof node !== 'object') return null;
          const isStart = nodeId === 'start';
          return (
            <div key={nodeId}>
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center mt-0.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isStart ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {idx + 1}
                  </div>
                  {idx < nodeIds.length - 1 && <div className="w-px h-6 bg-gray-200 mt-1" />}
                </div>
                <div className="flex-1">
                  <button onClick={() => onJumpTo(nodeId)} className="text-sm font-medium text-gray-800 hover:text-slate-600 transition text-left">
                    {isStart ? '🟢 Start Screen' : `Screen: ${nodeId}`}
                  </button>
                  <p className="text-xs text-gray-400 truncate max-w-md">"{node.message?.substring(0, 60)}"</p>
                  {(node.buttons || []).length > 0 && (
                    <div className="mt-1 ml-2 space-y-0.5">
                      {(node.buttons || []).map((btn, bi) => (
                        <div key={bi} className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="text-gray-300">↳</span>
                          <span className="font-medium text-gray-600">"{btn.label}"</span>
                          <span className="text-gray-300">→</span>
                          <span className={btn.action === 'next' && !btn.next ? 'text-amber-500' : 'text-slate-500'}>
                            {getActionDesc(btn)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main FlowBuilder ── */
export default function FlowBuilder() {
  const [flow, setFlow] = useState(null);
  const [labels, setLabels] = useState({ staff: 'Doctor', customer: 'Patient', booking: 'Appointment' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [previewNode, setPreviewNode] = useState('start');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

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
    const id = `screen_${Date.now()}`;
    setFlow(prev => ({
      ...prev,
      [id]: { message: 'New screen — edit this message', buttons: [] }
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Flow Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">Design the conversation your WhatsApp bot has with customers</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHelp(!showHelp)}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
            {showHelp ? 'Hide Guide' : 'How it works'}
          </button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 transition">
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* How it works guide */}
      {showHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4 text-sm text-blue-900">
          <h3 className="font-semibold mb-2">How the Flow Builder works</h3>
          <div className="space-y-2 text-blue-800">
            <p>Your WhatsApp bot works like a <strong>menu system</strong>. When a customer messages you, the bot shows them a message with buttons. Each button takes them somewhere:</p>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>Screen:</strong> Each screen is one message the customer sees, with buttons they can tap.</li>
              <li><strong>Buttons:</strong> Each button on a screen does something when tapped — it can show another screen, start the booking process, send a text reply, or hand off to AI.</li>
              <li><strong>"Start Screen"</strong> is the very first thing your customer sees when they message you.</li>
              <li><strong>Multiple screens:</strong> If you want branching conversations (e.g. Services → Hair → Haircut/Color), add more screens and link buttons to them.</li>
            </ul>
            <p className="text-blue-600 mt-2">Example: Customer messages "Hi" → sees Start Screen → taps "Book Appointment" → booking process begins automatically.</p>
          </div>
        </div>
      )}

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</div>}
      {saved && <div className="mb-4 text-sm text-green-600 bg-green-50 rounded-lg px-4 py-2">Flow saved successfully</div>}

      {/* Phone Preview */}
      <PhonePreview flow={flow} previewNode={previewNode} onTapButton={setPreviewNode} />

      {/* Flow Map */}
      <FlowMap flow={flow} nodeIds={nodeIds} onJumpTo={(id) => setEditingNode(editingNode === id ? null : id)} />

      {/* Labels */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Business Labels</h3>
        <p className="text-xs text-gray-400 mb-3">These words are used throughout the bot's messages — change them to match your business</p>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(LABEL_HELP).map(([key, help]) => (
            <div key={key}>
              <label className="text-xs text-gray-500 mb-1 flex items-center">
                {help.title}
                <InfoTip text={help.desc} example={help.example} />
              </label>
              <input value={labels[key] || ''} onChange={e => setLabels(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={help.example.split(', ')[0].replace('e.g. ', '')}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-slate-400" />
            </div>
          ))}
        </div>
      </div>

      {/* Fallback Message */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Fallback Message</h3>
        <p className="text-xs text-gray-400 mb-2">If a customer types something instead of tapping a button, the bot replies with this message</p>
        <input value={fallback} onChange={e => setFlow(prev => ({ ...prev, fallback: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
          placeholder="Sorry, I didn't understand. Please pick an option." />
      </div>

      {/* Screen Editor Section */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Conversation Screens</h3>
        <p className="text-xs text-gray-400">Each screen below is a message the customer sees. Click to edit. Buttons on each screen lead to the next action.</p>
      </div>

      {nodeIds.map((nodeId, idx) => (
        <NodeCard
          key={nodeId}
          nodeId={nodeId}
          node={flow[nodeId]}
          stepNumber={idx + 1}
          allNodes={nodeIds}
          flow={flow}
          isEditing={editingNode === nodeId}
          onEdit={() => { setEditingNode(editingNode === nodeId ? null : nodeId); setPreviewNode(nodeId); }}
          onUpdate={(updates) => updateNode(nodeId, updates)}
          onDelete={() => deleteNode(nodeId)}
          onRename={(newId) => renameNode(nodeId, newId)}
        />
      ))}

      <button onClick={addNode}
        className="w-full mt-2 py-4 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition">
        <span className="block font-medium">+ Add a new conversation screen</span>
        <span className="block text-xs mt-0.5">Create an additional screen for branching conversations (e.g. Services → sub-menu)</span>
      </button>
    </div>
  );
}

/* ── Node Card ── */
function NodeCard({ nodeId, node, stepNumber, allNodes, flow, isEditing, onEdit, onUpdate, onDelete, onRename }) {
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

  const actionDescription = (btn) => {
    if (btn.action === 'next') {
      if (!btn.next) return '⚠️ Not linked to any screen yet';
      const target = flow?.[btn.next];
      return `→ Goes to screen "${btn.next}" ("${target?.message?.substring(0, 30) || '...'}...")`;
    }
    if (btn.action === 'booking_flow') return '→ Opens the booking process (customer picks staff, date, time)';
    if (btn.action === 'text') return '→ Bot replies with a text message';
    if (btn.action === 'ai') return '→ Hands the conversation to AI assistant';
    return btn.action;
  };

  // Collapsed view: show button connections
  const buttonSummary = (node.buttons || []).map(btn => {
    if (btn.action === 'next') return `"${btn.label}" → ${btn.next || '??'}`;
    if (btn.action === 'booking_flow') return `"${btn.label}" → Booking`;
    if (btn.action === 'text') return `"${btn.label}" → Reply`;
    if (btn.action === 'ai') return `"${btn.label}" → AI`;
    return btn.label;
  });

  return (
    <div className={`bg-white rounded-xl border mb-3 transition ${isEditing ? 'border-slate-400 shadow-sm' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 cursor-pointer" onClick={onEdit}>
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full ${isStart ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {stepNumber}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-800">
                {isStart ? 'Start Screen' : `Screen: ${nodeId}`}
              </span>
              {isStart && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium">First message</span>}
            </div>
            <p className="text-xs text-gray-400 truncate max-w-sm">{node.message?.substring(0, 65)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{(node.buttons || []).length} buttons</span>
          <svg className={`w-4 h-4 text-gray-400 transition ${isEditing ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </div>
      </div>

      {/* Collapsed: show button connections */}
      {!isEditing && buttonSummary.length > 0 && (
        <div className="px-5 pb-3 -mt-1">
          <div className="flex flex-wrap gap-1">
            {buttonSummary.map((s, i) => (
              <span key={i} className="text-[11px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Editor */}
      {isEditing && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
          {/* Node ID */}
          {!isStart && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Screen ID <span className="text-gray-400">(used internally to link buttons)</span>
              </label>
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
            <label className="block text-xs text-gray-500 mb-1">Message the customer sees</label>
            <textarea value={node.message || ''} onChange={e => onUpdate({ message: e.target.value })}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none" />
          </div>

          {/* Buttons */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">
                Buttons the customer can tap
                {(node.buttons || []).length > 3 && <span className="text-amber-500 ml-1">(more than 3 = shows as a menu list)</span>}
              </label>
            </div>
            <div className="space-y-2">
              {(node.buttons || []).map((btn, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={btn.label} onChange={e => updateButton(idx, { label: e.target.value })}
                      placeholder="Button text (what customer sees)"
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
                      <option value="">Which screen should this button open?</option>
                      {allNodes.filter(n => n !== nodeId).map(n => (
                        <option key={n} value={n}>{n === 'start' ? 'Start Screen' : n} — "{flow?.[n]?.message?.substring(0, 40)}"</option>
                      ))}
                    </select>
                  )}

                  {btn.action === 'text' && (
                    <textarea value={btn.response || ''} onChange={e => updateButton(idx, { response: e.target.value })}
                      placeholder="What should the bot reply with? (e.g. address, phone number, working hours)"
                      rows={2}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-slate-400 resize-none" />
                  )}

                  {/* Connection description */}
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-gray-400 italic">{actionDescription(btn)}</span>
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
                className="mt-2 text-xs text-slate-500 hover:text-slate-700 transition">+ Add another button</button>
            )}
          </div>

          {/* Delete */}
          {!isStart && (
            <div className="pt-2 border-t border-gray-100">
              <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 transition">Delete this screen</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
