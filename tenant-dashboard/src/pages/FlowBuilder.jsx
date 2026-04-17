import { useState, useEffect } from 'react';
import api from '../api';

const ACTION_TYPES = [
  { value: 'next', label: 'Go to another screen' },
  { value: 'booking_flow', label: 'Start booking process' },
  { value: 'text', label: 'Send a text reply' },
  { value: 'ai', label: 'Hand off to AI' },
];

const LABEL_HELP = {
  staff: { title: 'Staff Title', example: 'Doctor, Stylist, Trainer', desc: 'What your team members are called. The bot says "Choose a {Staff Title}" when booking.' },
  customer: { title: 'Customer Title', example: 'Patient, Client, Student', desc: 'What your customers are called in confirmation messages.' },
  booking: { title: 'Booking Title', example: 'Appointment, Session, Visit', desc: 'What your bookings are called. Buttons say "Book {Booking Title}".' },
};

const EMPTY_BUTTON = { id: '', label: '', action: 'next', next: '', response: '' };

// ── Tooltip ────────────────────────────────────────────
function Tip({ text, example }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative ml-1">
      <button type="button" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onClick={e => { e.preventDefault(); setShow(!show); }}
        className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold inline-flex items-center justify-center hover:bg-emerald-100 transition">?</button>
      {show && (
        <span className="absolute z-30 bottom-6 left-1/2 -translate-x-1/2 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none">
          {text}<br/><span className="text-gray-400 text-[10px]">e.g. {example}</span>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
        </span>
      )}
    </span>
  );
}

// ── Phone Preview ──────────────────────────────────────
function Preview({ flow, screen, onTap, labels }) {
  const node = flow?.[screen];
  const [booking, setBooking] = useState(false);
  if (!node) return null;
  const btns = node.buttons || [];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm animate-slideUp" style={{ animationDelay: '60ms' }}>
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <h2 className="text-sm font-bold text-gray-900">Preview</h2>
        <div className="flex gap-2 items-center">
          {screen !== 'start' && (
            <button onClick={() => onTap('start')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Back to start</button>
          )}
          <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{screen === 'start' ? 'Start Screen' : screen}</span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="mx-auto max-w-[300px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          {/* WA Header */}
          <div className="bg-[#075e54] px-3 py-2 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            </div>
            <div>
              <p className="text-white text-xs font-medium">Your Business</p>
              <p className="text-white/40 text-[9px]">online</p>
            </div>
          </div>
          {/* Chat */}
          <div className="bg-[#efeae2] px-3 py-3 min-h-[130px]">
            <div className="bg-white rounded-lg rounded-tl-none shadow-sm max-w-[250px]">
              <p className="px-3 py-2 text-[13px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                {node.message || '(empty)'}
                <span className="float-right text-[9px] text-gray-400 ml-2 mt-1">{time}</span>
              </p>
              {btns.length > 0 && btns.length <= 3 && (
                <div className="border-t border-gray-50">
                  {btns.map((b, i) => (
                    <button key={i} onClick={() => {
                      if (b.action === 'next' && b.next && flow[b.next]) onTap(b.next);
                      if (b.action === 'booking_flow') setBooking(true);
                    }} className={`block w-full text-center py-1.5 text-[12px] text-[#00a5f4] font-medium hover:bg-blue-50/50 transition ${i < btns.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      {b.label || '(no label)'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {btns.length > 3 && (
              <div className="mt-2 bg-white rounded-lg shadow-sm text-center py-1.5 text-[12px] text-[#00a5f4] font-medium max-w-[250px]">
                View Options ({btns.length})
              </div>
            )}
          </div>
          {/* Input */}
          <div className="bg-[#f0f0f0] px-2 py-1 flex items-center gap-1">
            <div className="flex-1 bg-white rounded-full px-3 py-1 text-[10px] text-gray-400">Type a message</div>
            <div className="w-6 h-6 bg-[#075e54] rounded-full" />
          </div>
        </div>
        {btns.some(b => b.action === 'next' && b.next) && (
          <p className="text-center text-[10px] text-gray-400 mt-2">Click a button above to preview the next screen</p>
        )}
      </div>

      {/* Booking flow explanation */}
      {booking && (
        <div className="mx-4 mb-4 bg-emerald-50 border border-emerald-100 rounded-lg p-4 animate-slideDown">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold text-gray-800">Booking Flow</h4>
            <button onClick={() => setBooking(false)} className="text-xs text-gray-400 hover:text-gray-600 font-medium">Close</button>
          </div>
          <div className="space-y-1.5 text-sm text-gray-700">
            <p>1. Customer picks a {labels?.staff || 'Staff'}</p>
            <p>2. Customer picks a date</p>
            <p>3. Customer picks a time slot</p>
            <p>4. Bot shows {labels?.booking || 'Booking'} summary</p>
            <p>5. Customer confirms &rarr; {labels?.booking || 'Booking'} saved</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">This is automatic. Uses your staff, services & hours from Settings.</p>
        </div>
      )}
    </div>
  );
}

// ── Flow Map ───────────────────────────────────────────
function FlowMap({ flow, nodeIds, onJump }) {
  const desc = (b) => {
    if (b.action === 'next') return b.next || 'not linked';
    if (b.action === 'booking_flow') return 'Booking';
    if (b.action === 'text') return 'Reply';
    if (b.action === 'ai') return 'AI';
    return b.action;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm animate-slideUp" style={{ animationDelay: '120ms' }}>
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-bold text-gray-900">Conversation Map</h2>
        <p className="text-xs text-gray-500 mt-0.5">How your screens connect</p>
      </div>
      <div className="px-4 pb-4 space-y-2">
        {nodeIds.map((id, idx) => {
          const node = flow[id];
          if (!node || typeof node !== 'object') return null;
          return (
            <div key={id} className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-0.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold
                  ${id === 'start' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {idx + 1}
                </div>
                {idx < nodeIds.length - 1 && <div className="w-px h-4 bg-gray-100 mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <button onClick={() => onJump(id)} className="text-sm font-medium text-gray-800 hover:text-emerald-600 transition text-left">
                  {id === 'start' ? 'Start Screen' : id}
                </button>
                <p className="text-xs text-gray-400 truncate">{node.message?.substring(0, 50)}</p>
                {(node.buttons || []).map((b, i) => (
                  <p key={i} className="text-[11px] text-gray-500 mt-0.5">
                    <span className="text-gray-700 font-medium">{b.label}</span> &rarr; {desc(b)}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────
export default function FlowBuilder() {
  const [flow, setFlow] = useState(null);
  const [labels, setLabels] = useState({ staff: 'Doctor', customer: 'Patient', booking: 'Appointment' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState('start');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.getFlowConfig();
      setFlow(data.flow_config || getDefault());
      setLabels(data.labels || { staff: 'Doctor', customer: 'Patient', booking: 'Appointment' });
    } catch { setError('Failed to load'); }
    finally { setLoading(false); }
  }

  function getDefault() {
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
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  }

  function addNode() {
    const id = `screen_${Date.now()}`;
    setFlow(p => ({ ...p, [id]: { message: 'New screen', buttons: [] } }));
    setEditing(id);
  }

  function deleteNode(id) {
    if (id === 'start') return;
    setFlow(p => { const n = { ...p }; delete n[id]; return n; });
    if (editing === id) setEditing(null);
  }

  function updateNode(id, u) {
    setFlow(p => ({ ...p, [id]: { ...p[id], ...u } }));
  }

  function renameNode(oldId, newId) {
    if (oldId === newId || !newId || newId === 'fallback') return;
    setFlow(p => {
      const n = {};
      for (const [k, v] of Object.entries(p)) {
        const key = k === oldId ? newId : k;
        if (typeof v === 'object' && v !== null && v.buttons) {
          n[key] = { ...v, buttons: v.buttons.map(b => ({ ...b, next: b.next === oldId ? newId : b.next })) };
        } else { n[key] = v; }
      }
      return n;
    });
    if (editing === oldId) setEditing(newId);
  }

  const nodeIds = flow ? Object.keys(flow).filter(k => k !== 'fallback') : [];
  const fallback = flow?.fallback || '';

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 border-2 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="animate-fadeIn max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">Flow Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure your WhatsApp bot conversation</p>
        </div>
        <button onClick={save} disabled={saving}
          className="w-full sm:w-auto px-6 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-200 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {error && <div className="mb-4 text-sm font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 animate-slideDown">{error}</div>}
      {saved && <div className="mb-4 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 animate-slideDown">Flow saved successfully</div>}

      {/* Top: Preview + Map side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <Preview flow={flow} screen={preview} onTap={setPreview} labels={labels} />
        <FlowMap flow={flow} nodeIds={nodeIds} onJump={(id) => { setEditing(editing === id ? null : id); setPreview(id); }} />
      </div>

      {/* Labels + Fallback in a 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slideUp" style={{ animationDelay: '180ms' }}>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Business Labels</h2>
          <div className="space-y-3">
            {Object.entries(LABEL_HELP).map(([key, h]) => (
              <div key={key}>
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center">
                  {h.title} <Tip text={h.desc} example={h.example} />
                </label>
                <input value={labels[key] || ''} onChange={e => setLabels(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={h.example.split(', ')[0]}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 transition" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slideUp" style={{ animationDelay: '240ms' }}>
          <h2 className="text-sm font-bold text-gray-900 mb-1">Fallback Message</h2>
          <p className="text-xs text-gray-500 mb-3">Sent when customer types something instead of tapping a button</p>
          <textarea value={fallback} onChange={e => setFlow(p => ({ ...p, fallback: e.target.value }))} rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 transition resize-none" />
        </div>
      </div>

      {/* Screens */}
      <div className="mb-3 animate-slideUp" style={{ animationDelay: '300ms' }}>
        <h2 className="text-sm font-bold text-gray-900">Screens</h2>
        <p className="text-xs text-gray-500 mt-0.5">Each screen is a message your customer sees. Click to edit.</p>
      </div>

      {nodeIds.map((nodeId, idx) => (
        <ScreenCard key={nodeId} nodeId={nodeId} node={flow[nodeId]} step={idx + 1}
          allNodes={nodeIds} flow={flow} open={editing === nodeId} delay={360 + idx * 60}
          onToggle={() => { setEditing(editing === nodeId ? null : nodeId); setPreview(nodeId); }}
          onUpdate={u => updateNode(nodeId, u)} onDelete={() => deleteNode(nodeId)}
          onRename={newId => renameNode(nodeId, newId)} />
      ))}

      <button onClick={addNode}
        className="w-full mt-2 py-3.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all duration-300 animate-slideUp"
        style={{ animationDelay: `${360 + nodeIds.length * 60}ms` }}>
        + Add Screen
      </button>
      <p className="text-[11px] text-gray-500 mt-1.5 px-1">Most businesses only need the Start Screen. Add extra screens for sub-menus.</p>
    </div>
  );
}

// ── Screen Card ────────────────────────────────────────
function ScreenCard({ nodeId, node, step, allNodes, flow, open, delay, onToggle, onUpdate, onDelete, onRename }) {
  const [renameId, setRenameId] = useState(nodeId);
  const isStart = nodeId === 'start';
  const btns = node.buttons || [];

  function addBtn() { onUpdate({ buttons: [...btns, { ...EMPTY_BUTTON, id: `btn_${Date.now()}` }] }); }
  function updateBtn(i, u) { const b = [...btns]; b[i] = { ...b[i], ...u }; onUpdate({ buttons: b }); }
  function removeBtn(i) { onUpdate({ buttons: btns.filter((_, j) => j !== i) }); }
  function moveBtn(i, d) {
    const b = [...btns]; const n = i + d;
    if (n < 0 || n >= b.length) return;
    [b[i], b[n]] = [b[n], b[i]]; onUpdate({ buttons: b });
  }

  const actionText = (b) => {
    if (b.action === 'next') return b.next ? `Goes to "${b.next}"` : 'Not linked';
    if (b.action === 'booking_flow') return 'Starts booking';
    if (b.action === 'text') return 'Sends reply';
    if (b.action === 'ai') return 'AI assistant';
    return b.action;
  };

  return (
    <div className={`bg-white rounded-xl border mb-2.5 transition-all duration-200 animate-slideUp
      ${open ? 'border-emerald-300 shadow-md ring-1 ring-emerald-100' : 'border-gray-100 shadow-sm hover:border-gray-200 hover:shadow'}`}
      style={{ animationDelay: `${delay}ms` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0
            ${isStart ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'}`}>
            {step}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{isStart ? 'Start Screen' : nodeId}</p>
            <p className="text-xs text-gray-500 truncate max-w-[180px] sm:max-w-xs">{node.message?.substring(0, 55)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!open && btns.length > 0 && (
            <span className="text-[10px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded hidden sm:inline">{btns.length} buttons</span>
          )}
          <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
        </div>
      </div>

      {/* Collapsed: show connections */}
      {!open && btns.length > 0 && (
        <div className="px-4 pb-3 -mt-1 flex flex-wrap gap-1">
          {btns.map((b, i) => (
            <span key={i} className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded">
              {b.label} &rarr; {b.action === 'booking_flow' ? 'Booking' : b.action === 'text' ? 'Reply' : b.action === 'ai' ? 'AI' : b.next || '?'}
            </span>
          ))}
        </div>
      )}

      {/* Expanded */}
      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-4 space-y-4 animate-slideDown">
          {/* Rename */}
          {!isStart && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Screen ID</label>
              <div className="flex gap-2">
                <input value={renameId} onChange={e => setRenameId(e.target.value.replace(/[^a-z0-9_]/g, ''))}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 outline-none focus:border-emerald-400" />
                {renameId !== nodeId && (
                  <button onClick={() => onRename(renameId)} className="px-3 py-2 text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-700">Rename</button>
                )}
              </div>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bot message</label>
            <textarea value={node.message || ''} onChange={e => onUpdate({ message: e.target.value })} rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 resize-none" />
          </div>

          {/* Buttons */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              Buttons {btns.length > 3 && <span className="text-amber-600 font-normal">(shows as list menu)</span>}
            </label>
            <div className="space-y-2">
              {btns.map((btn, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-100">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={btn.label} onChange={e => updateBtn(idx, { label: e.target.value })}
                      placeholder="Button text" maxLength={20}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 bg-white" />
                    <select value={btn.action} onChange={e => updateBtn(idx, { action: e.target.value })}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
                      {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  {btn.action === 'next' && (
                    <select value={btn.next || ''} onChange={e => updateBtn(idx, { next: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
                      <option value="">Select target screen</option>
                      {allNodes.filter(n => n !== nodeId).map(n => (
                        <option key={n} value={n}>{n === 'start' ? 'Start Screen' : n}</option>
                      ))}
                    </select>
                  )}
                  {btn.action === 'text' && (
                    <textarea value={btn.response || ''} onChange={e => updateBtn(idx, { response: e.target.value })}
                      placeholder="Reply text" rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 resize-none bg-white" />
                  )}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 pt-1">
                    <span className="text-[10px] text-gray-400">{actionText(btn)}</span>
                    <div className="flex gap-3 text-xs font-medium">
                      {idx > 0 && <button onClick={() => moveBtn(idx, -1)} className="text-gray-400 hover:text-gray-600">Up</button>}
                      {idx < btns.length - 1 && <button onClick={() => moveBtn(idx, 1)} className="text-gray-400 hover:text-gray-600">Down</button>}
                      <button onClick={() => removeBtn(idx)} className="text-red-400 hover:text-red-600">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {btns.length < 10 && (
              <button onClick={addBtn} className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">+ Add Button</button>
            )}
          </div>

          {!isStart && (
            <div className="pt-3 border-t border-gray-100">
              <button onClick={onDelete} className="text-xs font-medium text-red-400 hover:text-red-600">Delete this screen</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
