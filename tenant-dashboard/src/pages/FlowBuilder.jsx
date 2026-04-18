import { useState, useEffect } from 'react';
import api from '../api';

// ── Constants ──────────────────────────────────────────
const BTN_ACTIONS = [
  { value: 'next', label: 'Go to another screen' },
  { value: 'booking_flow', label: 'Start booking process' },
  { value: 'text', label: 'Send a text reply' },
  { value: 'ai', label: 'Hand off to AI' },
];

const INPUT_TYPES = [
  { value: 'text', label: 'Any text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email address' },
  { value: 'phone', label: 'Phone number' },
  { value: 'date', label: 'Date' },
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'yes_no', label: 'Yes or No' },
];

const CONDITION_OPS = [
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'is more than' },
  { value: 'less_than', label: 'is less than' },
];

const LABEL_HELP = {
  staff: { title: 'Staff Title', example: 'Doctor, Stylist, Trainer', desc: 'The bot says "Choose a {Staff Title}" when booking.' },
  customer: { title: 'Customer Title', example: 'Patient, Client, Student', desc: 'How customers are called in messages.' },
  booking: { title: 'Booking Title', example: 'Appointment, Session, Visit', desc: 'Buttons say "Book {Booking Title}".' },
};

// ── Helpers ────────────────────────────────────────────
function friendlyName(id, idx) {
  if (id === 'start') return 'Welcome Screen';
  if (/^screen_\d+$/.test(id)) return `Screen ${idx + 1}`;
  return id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ── Phone Preview ──────────────────────────────────────
function Preview({ flow, screen, onTap, labels }) {
  const node = flow?.[screen];
  const [booking, setBooking] = useState(false);
  if (!node) return null;
  const btns = node.buttons || [];
  const nodeType = node.type || 'menu';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const nodeIds = Object.keys(flow).filter(k => k !== 'fallback');
  const screenIdx = nodeIds.indexOf(screen);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm animate-slideUp" style={{ animationDelay: '60ms' }}>
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <h2 className="text-sm font-bold text-gray-900">Preview</h2>
        <div className="flex gap-2 items-center">
          {screen !== 'start' && (
            <button onClick={() => onTap('start')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Back to start</button>
          )}
          <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{friendlyName(screen, screenIdx)}</span>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="mx-auto max-w-[300px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
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
          <div className="bg-[#efeae2] px-3 py-3 min-h-[130px]">
            {nodeType === 'condition' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-700 text-center">
                <p className="font-medium">Auto-routing step</p>
                <p className="text-[10px] mt-1 text-amber-600">Checks answers and picks the right screen</p>
              </div>
            ) : nodeType === 'action' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-[11px] text-blue-700 text-center">
                <p className="font-medium">Saves data</p>
                <p className="text-[10px] mt-1 text-blue-600">{node.message ? 'Shows message then saves' : 'Saves silently'}</p>
              </div>
            ) : (
              <>
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
                {nodeType === 'input' && (
                  <div className="mt-2 max-w-[250px]">
                    <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none shadow-sm px-3 py-2 text-[13px] text-gray-800 ml-auto max-w-[200px]">
                      <span className="italic text-gray-500">(customer types {node.input_type || 'answer'})</span>
                      <span className="float-right text-[9px] text-gray-400 ml-2 mt-1">{time}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="bg-[#f0f0f0] px-2 py-1 flex items-center gap-1">
            <div className="flex-1 bg-white rounded-full px-3 py-1 text-[10px] text-gray-400">Type a message</div>
            <div className="w-6 h-6 bg-[#075e54] rounded-full" />
          </div>
        </div>
        {btns.some(b => b.action === 'next' && b.next) && (
          <p className="text-center text-[10px] text-gray-400 mt-2">Click a button to preview next screen</p>
        )}
      </div>

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
            <p>5. Customer confirms</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Flow Map ───────────────────────────────────────────
function FlowMap({ flow, nodeIds, onJump }) {
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
          const nodeType = node.type || 'menu';
          const typeColor = nodeType === 'input' ? 'text-purple-500'
            : nodeType === 'condition' ? 'text-amber-500'
            : nodeType === 'action' ? 'text-blue-500' : 'text-gray-500';

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
                  {friendlyName(id, idx)}
                </button>
                {nodeType !== 'menu' && (
                  <span className={`ml-2 text-[9px] font-bold ${typeColor}`}>
                    {nodeType === 'input' ? 'asks question' : nodeType === 'condition' ? 'auto-routes' : 'saves data'}
                  </span>
                )}
                <p className="text-xs text-gray-400 truncate">{node.message?.substring(0, 50)}</p>
                {nodeType === 'menu' && (node.buttons || []).map((b, i) => (
                  <p key={i} className="text-[11px] text-gray-500 mt-0.5">
                    <span className="text-gray-700 font-medium">{b.label}</span> &rarr;{' '}
                    {b.action === 'booking_flow' ? 'Booking'
                      : b.action === 'text' ? 'Reply'
                      : b.action === 'ai' ? 'AI'
                      : b.next ? friendlyName(b.next, nodeIds.indexOf(b.next)) : '?'}
                  </p>
                ))}
                {nodeType === 'input' && <p className="text-[11px] text-purple-400 mt-0.5">&rarr; {node.next ? friendlyName(node.next, nodeIds.indexOf(node.next)) : '?'}</p>}
                {nodeType === 'action' && <p className="text-[11px] text-blue-400 mt-0.5">&rarr; {node.next ? friendlyName(node.next, nodeIds.indexOf(node.next)) : 'end'}</p>}
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

  function addNode(type = 'menu') {
    const id = `screen_${Date.now()}`;
    const defaults = {
      menu: { message: '', buttons: [] },
      input: { type: 'input', message: '', input_type: 'text', variable: '', next: '' },
      condition: { type: 'condition', variable: '', rules: [], else_next: '' },
      action: { type: 'action', action_type: 'save_record', record_type: 'lead', message: '', next: '' },
    };
    setFlow(p => ({ ...p, [id]: defaults[type] || defaults.menu }));
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
          <p className="text-sm text-gray-500 mt-0.5">Design what your customers see on WhatsApp</p>
        </div>
        <button onClick={save} disabled={saving}
          className="w-full sm:w-auto px-6 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-200 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {error && <div className="mb-4 text-sm font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 animate-slideDown">{error}</div>}
      {saved && <div className="mb-4 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 animate-slideDown">Flow saved successfully</div>}

      {/* Preview + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <Preview flow={flow} screen={preview} onTap={setPreview} labels={labels} />
        <FlowMap flow={flow} nodeIds={nodeIds} onJump={(id) => { setEditing(editing === id ? null : id); setPreview(id); }} />
      </div>

      {/* Labels + Fallback */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slideUp" style={{ animationDelay: '180ms' }}>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Business Labels</h2>
          <div className="space-y-3">
            {Object.entries(LABEL_HELP).map(([key, h]) => (
              <div key={key}>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{h.title}</label>
                <input value={labels[key] || ''} onChange={e => setLabels(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={h.example.split(', ')[0]}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 transition" />
                <p className="text-[10px] text-gray-400 mt-0.5">{h.desc}</p>
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
        <p className="text-xs text-gray-500 mt-0.5">Each screen is a step in the conversation. Click to edit.</p>
      </div>

      {nodeIds.map((nodeId, idx) => (
        <ScreenCard key={nodeId} nodeId={nodeId} node={flow[nodeId]} step={idx + 1}
          allNodes={nodeIds} flow={flow} open={editing === nodeId} delay={360 + idx * 60}
          onToggle={() => { setEditing(editing === nodeId ? null : nodeId); setPreview(nodeId); }}
          onUpdate={u => updateNode(nodeId, u)} onDelete={() => deleteNode(nodeId)} />
      ))}

      {/* Add Screen */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-slideUp" style={{ animationDelay: `${360 + nodeIds.length * 60}ms` }}>
        <button onClick={() => addNode('menu')}
          className="py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all">
          + Message
          <p className="text-[10px] font-normal text-gray-400 mt-0.5">Show buttons</p>
        </button>
        <button onClick={() => addNode('input')}
          className="py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50/30 transition-all">
          + Ask Question
          <p className="text-[10px] font-normal text-gray-400 mt-0.5">Collect info</p>
        </button>
        <button onClick={() => addNode('condition')}
          className="py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/30 transition-all">
          + If / Else
          <p className="text-[10px] font-normal text-gray-400 mt-0.5">Branch logic</p>
        </button>
        <button onClick={() => addNode('action')}
          className="py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all">
          + Save Data
          <p className="text-[10px] font-normal text-gray-400 mt-0.5">Store answers</p>
        </button>
      </div>
    </div>
  );
}

// ── Screen Card ────────────────────────────────────────
function ScreenCard({ nodeId, node, step, allNodes, flow, open, delay, onToggle, onUpdate, onDelete }) {
  const isStart = nodeId === 'start';
  const btns = node.buttons || [];
  const nodeType = node.type || 'menu';

  function addBtn() { onUpdate({ buttons: [...btns, { id: `btn_${Date.now()}`, label: '', action: 'next', next: '', response: '' }] }); }
  function updateBtn(i, u) { const b = [...btns]; b[i] = { ...b[i], ...u }; onUpdate({ buttons: b }); }
  function removeBtn(i) { onUpdate({ buttons: btns.filter((_, j) => j !== i) }); }
  function moveBtn(i, d) {
    const b = [...btns]; const n = i + d;
    if (n < 0 || n >= b.length) return;
    [b[i], b[n]] = [b[n], b[i]]; onUpdate({ buttons: b });
  }

  function addRule() {
    onUpdate({ rules: [...(node.rules || []), { operator: 'equals', value: '', next: '' }] });
  }
  function updateRule(i, u) {
    const rules = [...(node.rules || [])];
    rules[i] = { ...rules[i], ...u };
    onUpdate({ rules });
  }
  function removeRule(i) {
    onUpdate({ rules: (node.rules || []).filter((_, j) => j !== i) });
  }

  const allVariables = Object.values(flow).filter(n => typeof n === 'object' && n?.type === 'input' && n?.variable).map(n => n.variable);
  const name = friendlyName(nodeId, allNodes.indexOf(nodeId));

  const typeBadge = nodeType === 'input' ? 'bg-purple-50 text-purple-600'
    : nodeType === 'condition' ? 'bg-amber-50 text-amber-600'
    : nodeType === 'action' ? 'bg-blue-50 text-blue-600' : '';
  const typeLabel = nodeType === 'input' ? 'Question'
    : nodeType === 'condition' ? 'If / Else'
    : nodeType === 'action' ? 'Save Data' : '';

  const ScreenSelect = ({ value, onChange, label }) => (
    <div>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
        <option value="">Select next step...</option>
        {allNodes.filter(n => n !== nodeId).map(n => (
          <option key={n} value={n}>{friendlyName(n, allNodes.indexOf(n))}</option>
        ))}
      </select>
    </div>
  );

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
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{name}</p>
              {typeLabel && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${typeBadge}`}>{typeLabel}</span>}
            </div>
            <p className="text-xs text-gray-500 truncate max-w-[200px] sm:max-w-xs">{node.message?.substring(0, 55) || (nodeType === 'condition' ? 'Routes based on answers' : '')}</p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </div>

      {/* Expanded */}
      {open && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-4 space-y-4 animate-slideDown">

          {/* MENU NODE */}
          {nodeType === 'menu' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                <textarea value={node.message || ''} onChange={e => onUpdate({ message: e.target.value })} rows={3}
                  placeholder="What should the bot say?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 resize-none" />
                {allVariables.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">Tip: Use {allVariables.map(v => '{{' + v + '}}').join(', ')} to personalize</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">
                  Buttons <span className="font-normal text-gray-400">{btns.length > 3 ? '(shows as scrollable list)' : ''}</span>
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
                          {BTN_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      </div>
                      {btn.action === 'next' && (
                        <select value={btn.next || ''} onChange={e => updateBtn(idx, { next: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
                          <option value="">Where does this go?</option>
                          {allNodes.filter(n => n !== nodeId).map(n => (
                            <option key={n} value={n}>{friendlyName(n, allNodes.indexOf(n))}</option>
                          ))}
                        </select>
                      )}
                      {btn.action === 'text' && (
                        <textarea value={btn.response || ''} onChange={e => updateBtn(idx, { response: e.target.value })}
                          placeholder="What should the bot reply?" rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 resize-none bg-white" />
                      )}
                      <div className="flex justify-end gap-3 text-xs font-medium pt-1">
                        {idx > 0 && <button onClick={() => moveBtn(idx, -1)} className="text-gray-400 hover:text-gray-600">Up</button>}
                        {idx < btns.length - 1 && <button onClick={() => moveBtn(idx, 1)} className="text-gray-400 hover:text-gray-600">Down</button>}
                        <button onClick={() => removeBtn(idx)} className="text-red-400 hover:text-red-600">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                {btns.length < 10 && (
                  <button onClick={addBtn} className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700">+ Add Button</button>
                )}
              </div>
            </>
          )}

          {/* INPUT NODE */}
          {nodeType === 'input' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Question to ask</label>
                <textarea value={node.message || ''} onChange={e => onUpdate({ message: e.target.value })} rows={2}
                  placeholder="e.g. What's your name?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">What kind of answer?</label>
                  <select value={node.input_type || 'text'} onChange={e => onUpdate({ input_type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
                    {INPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Save this answer as</label>
                  <input value={node.variable || ''} onChange={e => onUpdate({ variable: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                    placeholder="e.g. name, budget, city"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400" />
                  <p className="text-[10px] text-gray-400 mt-0.5">Use {'{{' + (node.variable || 'name') + '}}'} in later messages</p>
                </div>
              </div>
              <ScreenSelect value={node.next} onChange={v => onUpdate({ next: v })} label="After they answer, go to" />
            </>
          )}

          {/* CONDITION NODE */}
          {nodeType === 'condition' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Which answer to check?</label>
                {allVariables.length > 0 ? (
                  <select value={node.variable || ''} onChange={e => onUpdate({ variable: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
                    <option value="">Select...</option>
                    {allVariables.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">Add an "Ask Question" screen first to have answers to check.</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Rules</label>
                <div className="space-y-2">
                  {(node.rules || []).map((rule, idx) => (
                    <div key={idx} className="bg-amber-50/50 rounded-lg p-3 border border-amber-100 space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <span className="text-xs text-gray-500 pt-2 shrink-0">If answer</span>
                        <select value={rule.operator || 'equals'} onChange={e => updateRule(idx, { operator: e.target.value })}
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400 bg-white">
                          {CONDITION_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <input value={rule.value || ''} onChange={e => updateRule(idx, { value: e.target.value })}
                          placeholder="value"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400 bg-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 shrink-0">then go to</span>
                        <select value={rule.next || ''} onChange={e => updateRule(idx, { next: e.target.value })}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400 bg-white">
                          <option value="">Select step...</option>
                          {allNodes.filter(n => n !== nodeId).map(n => (
                            <option key={n} value={n}>{friendlyName(n, allNodes.indexOf(n))}</option>
                          ))}
                        </select>
                        <button onClick={() => removeRule(idx)} className="text-xs text-red-400 hover:text-red-600 shrink-0">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addRule} className="mt-3 text-xs font-semibold text-amber-600 hover:text-amber-700">+ Add Rule</button>
              </div>
              <ScreenSelect value={node.else_next} onChange={v => onUpdate({ else_next: v })} label="If nothing matches, go to" />
            </>
          )}

          {/* ACTION NODE */}
          {nodeType === 'action' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Save as</label>
                <input value={node.record_type || ''} onChange={e => onUpdate({ record_type: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                  placeholder="e.g. lead, order, feedback, inquiry"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400" />
                <p className="text-[10px] text-gray-400 mt-0.5">All collected answers will be saved. View them in your dashboard.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirmation message</label>
                <textarea value={node.message || ''} onChange={e => onUpdate({ message: e.target.value })}
                  placeholder='e.g. Thank you {{name}}! We will contact you soon.'
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 resize-none" />
                {allVariables.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">Use: {allVariables.map(v => '{{' + v + '}}').join(', ')}</p>
                )}
              </div>
              <ScreenSelect value={node.next} onChange={v => onUpdate({ next: v })} label="After saving, go to (leave empty to end)" />
            </>
          )}

          {/* Delete */}
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
