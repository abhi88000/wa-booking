import { useState, useEffect } from 'react';
import api from '../api';

// ── Constants ──────────────────────────────────────────
const BTN_ACTIONS = [
  { value: 'next', label: 'Go to another step' },
  { value: 'booking_flow', label: 'Start booking process' },
  { value: 'text', label: 'Send a text reply' },
  { value: 'ai', label: 'Hand off to AI assistant' },
];

const INPUT_TYPES = [
  { value: 'text',   label: 'Any text',        hint: 'Name, address, message...' },
  { value: 'number', label: 'Number',           hint: 'Age, quantity, budget...' },
  { value: 'email',  label: 'Email address',    hint: 'john@example.com' },
  { value: 'phone',  label: 'Phone number',     hint: '+91 9876543210' },
  { value: 'date',   label: 'Date',             hint: '2025-01-15' },
  { value: 'rating', label: 'Rating (1-5)',      hint: 'Customer satisfaction' },
  { value: 'yes_no', label: 'Yes or No',        hint: 'Simple confirmation' },
];

const CONDITION_OPS = [
  { value: 'equals',       label: 'is exactly' },
  { value: 'not_equals',   label: 'is not' },
  { value: 'contains',     label: 'contains' },
  { value: 'greater_than', label: 'is more than' },
  { value: 'less_than',    label: 'is less than' },
];

const LABEL_HELP = {
  staff:    { title: 'Staff Title',    example: 'Doctor, Stylist, Trainer', desc: 'The bot says "Choose a {Staff Title}" when booking.' },
  customer: { title: 'Customer Title', example: 'Patient, Client, Student', desc: 'How customers are called in messages.' },
  booking:  { title: 'Booking Title',  example: 'Appointment, Session, Visit', desc: 'Buttons say "Book {Booking Title}".' },
};

// ── Templates ──────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'lead_capture',
    name: 'Lead Capture',
    desc: 'Collect name, email, and interest from potential customers',
    icon: '🎯',
    industries: 'Real Estate, Education, Insurance',
    flow: {
      start: { message: 'Hi! 👋 Welcome. Let me help you get started.\n\nI just need a few details.', buttons: [{ id: 'go', label: 'Get Started', action: 'next', next: 'screen_ask_name' }] },
      screen_ask_name: { type: 'input', message: 'What is your name?', input_type: 'text', variable: 'name', next: 'screen_ask_email' },
      screen_ask_email: { type: 'input', message: 'Thanks {{name}}! What is your email address?', input_type: 'email', variable: 'email', next: 'screen_ask_interest' },
      screen_ask_interest: { type: 'input', message: 'What are you interested in?', input_type: 'text', variable: 'interest', next: 'screen_save' },
      screen_save: { type: 'action', action_type: 'save_record', record_type: 'lead', message: 'Thank you {{name}}! Our team will reach out to you at {{email}} shortly. 🙌', next: '' },
      fallback: 'Please answer the question above, or type "menu" to start over.'
    }
  },
  {
    id: 'feedback',
    name: 'Customer Feedback',
    desc: 'Ask for a rating and collect comments after a service',
    icon: '⭐',
    industries: 'Restaurants, Hotels, Salons',
    flow: {
      start: { message: 'Hi! We\'d love to hear about your experience. It takes just 30 seconds.', buttons: [{ id: 'go', label: 'Give Feedback', action: 'next', next: 'screen_rating' }] },
      screen_rating: { type: 'input', message: 'How would you rate us? (1 = Poor, 5 = Excellent)', input_type: 'rating', variable: 'rating', next: 'screen_check' },
      screen_check: { type: 'condition', variable: 'rating', rules: [{ operator: 'greater_than', value: '3', next: 'screen_thanks' }], else_next: 'screen_improve' },
      screen_improve: { type: 'input', message: 'We\'re sorry to hear that. What can we improve?', input_type: 'text', variable: 'feedback', next: 'screen_save_fb' },
      screen_thanks: { type: 'input', message: 'Glad you liked it! 🎉 Any comments you\'d like to share?', input_type: 'text', variable: 'feedback', next: 'screen_save_fb' },
      screen_save_fb: { type: 'action', action_type: 'save_record', record_type: 'feedback', message: 'Thank you for your feedback! We really appreciate it. 🙏', next: '' },
      fallback: 'Please answer the question above.'
    }
  },
  {
    id: 'appointment',
    name: 'Appointment Booking',
    desc: 'Let customers book appointments directly on WhatsApp',
    icon: '📅',
    industries: 'Clinics, Salons, Gyms, Consultants',
    flow: {
      start: { message: 'Welcome! 👋 How can I help you today?', buttons: [
        { id: 'book', label: 'Book Appointment', action: 'booking_flow' },
        { id: 'status', label: 'My Appointments', action: 'booking_flow' },
        { id: 'contact', label: 'Contact Us', action: 'text', response: 'Please call us or visit our website.' }
      ] },
      fallback: 'Sorry, I didn\'t understand. Please choose from the options above.'
    }
  },
  {
    id: 'faq',
    name: 'FAQ / Info Bot',
    desc: 'Answer common questions with menu buttons',
    icon: '❓',
    industries: 'Any business',
    flow: {
      start: { message: 'Welcome! 👋 What would you like to know?', buttons: [
        { id: 'hours', label: 'Business Hours', action: 'text', response: 'We are open Mon-Sat, 9 AM to 6 PM.' },
        { id: 'location', label: 'Our Location', action: 'text', response: 'We are located at [Your Address]. Google Maps: [link]' },
        { id: 'pricing', label: 'Pricing', action: 'text', response: 'Check our pricing at [your-website.com/pricing]' },
        { id: 'talk', label: 'Talk to a Human', action: 'ai' },
      ] },
      fallback: 'I can help with common questions. Please choose from the menu above, or type "menu" to see options again.'
    }
  },
  {
    id: 'order',
    name: 'Order / Inquiry',
    desc: 'Collect product interest and contact details for follow-up',
    icon: '🛒',
    industries: 'E-commerce, Wholesale, Services',
    flow: {
      start: { message: 'Hi! 👋 Welcome to our store.\n\nWhat are you looking for today?', buttons: [
        { id: 'order', label: 'Place an Order', action: 'next', next: 'screen_product' },
        { id: 'status', label: 'Order Status', action: 'text', response: 'Please share your order number and we\'ll check for you.' },
        { id: 'help', label: 'Help', action: 'ai' },
      ] },
      screen_product: { type: 'input', message: 'What product or service are you interested in?', input_type: 'text', variable: 'product', next: 'screen_qty' },
      screen_qty: { type: 'input', message: 'How many would you like?', input_type: 'number', variable: 'quantity', next: 'screen_contact' },
      screen_contact: { type: 'input', message: 'Great! What\'s your name so we can process this?', input_type: 'text', variable: 'name', next: 'screen_save_order' },
      screen_save_order: { type: 'action', action_type: 'save_record', record_type: 'order', message: 'Thanks {{name}}! Your inquiry for {{quantity}}x {{product}} has been received. We\'ll confirm availability shortly! 📦', next: '' },
      fallback: 'Please answer the question, or type "menu" to start over.'
    }
  },
  {
    id: 'blank',
    name: 'Start from Scratch',
    desc: 'Build your own custom flow step by step',
    icon: '✏️',
    industries: 'Custom',
    flow: null
  },
];

// ── Step type explainers ───────────────────────────────
const STEP_TYPES = [
  { type: 'menu', name: 'Send Message', icon: '💬', color: 'emerald', desc: 'Show a message with buttons the customer can tap', example: 'Welcome menu, product categories, service list' },
  { type: 'input', name: 'Ask a Question', icon: '✍️', color: 'purple', desc: 'Ask something and save the answer (name, email, phone...)', example: '"What is your name?", "What\'s your email?"' },
  { type: 'condition', name: 'Smart Routing', icon: '🔀', color: 'amber', desc: 'Automatically send customer to different steps based on answers', example: 'If rating < 4, ask what went wrong' },
  { type: 'action', name: 'Save & Finish', icon: '💾', color: 'blue', desc: 'Save all collected info as a lead, order, feedback, etc.', example: 'Save as "lead" — view in dashboard later' },
];

// ── Helpers ────────────────────────────────────────────
function friendlyName(id, idx) {
  if (id === 'start') return 'Welcome (Step 1)';
  if (/^screen_\d+$/.test(id)) return `Step ${idx + 1}`;
  // named steps from templates
  if (id.startsWith('screen_')) {
    const name = id.replace('screen_', '').replace(/_/g, ' ');
    return name.replace(/\b\w/g, l => l.toUpperCase());
  }
  return id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ── Getting Started Guide ──────────────────────────────
function GettingStarted({ collapsed, onToggle }) {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 mb-4 animate-slideUp">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">💡</span>
          <span className="text-sm font-bold text-gray-900">How the Flow Builder Works</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Guide</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {!collapsed && (
        <div className="px-4 pb-4 animate-slideDown">
          <p className="text-sm text-gray-600 mb-3">Your WhatsApp bot follows a series of <b>steps</b>. Each step does one thing:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STEP_TYPES.map(s => (
              <div key={s.type} className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{s.icon}</span>
                  <span className="text-sm font-semibold text-gray-800">{s.name}</span>
                </div>
                <p className="text-xs text-gray-600">{s.desc}</p>
                <p className="text-[10px] text-gray-400 mt-1 italic">e.g. {s.example}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 bg-white rounded-lg p-3 border border-gray-100">
            <p className="text-xs font-semibold text-gray-700 mb-1">💬 How a typical flow works:</p>
            <div className="flex flex-wrap items-center gap-1 text-xs text-gray-600">
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">Welcome Message</span>
              <span>→</span>
              <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium">Ask Name</span>
              <span>→</span>
              <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium">Ask Email</span>
              <span>→</span>
              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium">Check Rating</span>
              <span>→</span>
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">Save as Lead</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Template Picker ────────────────────────────────────
function TemplatePicker({ onPick }) {
  return (
    <div className="animate-fadeIn max-w-5xl">
      <div className="text-center mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">What should your WhatsApp bot do?</h1>
        <p className="text-sm text-gray-500 mt-2">Pick a ready-made template to get started in seconds, or build from scratch.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map(t => (
          <button key={t.id} onClick={() => onPick(t)}
            className="text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-emerald-300 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{t.icon}</span>
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition">{t.name}</h3>
            </div>
            <p className="text-xs text-gray-600 mb-2">{t.desc}</p>
            <p className="text-[10px] text-gray-400">Works for: {t.industries}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
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
        <h2 className="text-sm font-bold text-gray-900">📱 Live Preview</h2>
        <div className="flex gap-2 items-center">
          {screen !== 'start' && (
            <button onClick={() => onTap('start')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">← Back to start</button>
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
        <h2 className="text-sm font-bold text-gray-900">🗺️ Conversation Flow</h2>
        <p className="text-xs text-gray-500 mt-0.5">How your steps connect — tap any step to edit it</p>
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
  const [showGuide, setShowGuide] = useState(false);
  const [isNewFlow, setIsNewFlow] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.getFlowConfig();
      if (data.flow_config) {
        setFlow(data.flow_config);
      } else {
        setIsNewFlow(true);
      }
      setLabels(data.labels || { staff: 'Doctor', customer: 'Patient', booking: 'Appointment' });
    } catch { setError('Failed to load'); }
    finally { setLoading(false); }
  }

  function pickTemplate(template) {
    if (template.flow) {
      setFlow(template.flow);
    } else {
      setFlow(getDefault());
    }
    setIsNewFlow(false);
    setShowGuide(true);
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

  // New flow — show template picker
  if (isNewFlow || !flow) return <TemplatePicker onPick={pickTemplate} />;

  return (
    <div className="animate-fadeIn max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">Flow Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">Design what your customers see on WhatsApp — step by step</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setIsNewFlow(true); }}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            📋 Templates
          </button>
          <button onClick={save} disabled={saving}
            className="px-6 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-200 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm font-medium text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 animate-slideDown">{error}</div>}
      {saved && <div className="mb-4 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 animate-slideDown">✅ Flow saved! Your WhatsApp bot is now updated.</div>}

      {/* Getting Started Guide */}
      <GettingStarted collapsed={!showGuide} onToggle={() => setShowGuide(!showGuide)} />

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

      {/* Steps */}
      <div className="mb-3 animate-slideUp" style={{ animationDelay: '300ms' }}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900">Your Bot's Steps</h2>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{nodeIds.length} steps</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Each step is one message in the conversation. Tap to edit. Drag the order by adding/removing.</p>
      </div>

      {nodeIds.map((nodeId, idx) => (
        <ScreenCard key={nodeId} nodeId={nodeId} node={flow[nodeId]} step={idx + 1}
          allNodes={nodeIds} flow={flow} open={editing === nodeId} delay={360 + idx * 60}
          onToggle={() => { setEditing(editing === nodeId ? null : nodeId); setPreview(nodeId); }}
          onUpdate={u => updateNode(nodeId, u)} onDelete={() => deleteNode(nodeId)} />
      ))}

      {/* Add Step */}
      <div className="mt-3 animate-slideUp" style={{ animationDelay: `${360 + nodeIds.length * 60}ms` }}>
        <p className="text-xs font-semibold text-gray-600 mb-2">➕ Add a new step:</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => addNode('menu')}
            className="py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all">
            💬 Send Message
            <p className="text-[10px] font-normal text-gray-400 mt-0.5">Text + buttons</p>
          </button>
          <button onClick={() => addNode('input')}
            className="py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50/30 transition-all">
            ✍️ Ask Question
            <p className="text-[10px] font-normal text-gray-400 mt-0.5">Name, email, phone...</p>
          </button>
          <button onClick={() => addNode('condition')}
            className="py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/30 transition-all">
            🔀 Smart Route
            <p className="text-[10px] font-normal text-gray-400 mt-0.5">Go to different steps based on answer</p>
          </button>
          <button onClick={() => addNode('action')}
            className="py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-all">
            💾 Save & Finish
            <p className="text-[10px] font-normal text-gray-400 mt-0.5">Save as lead, order, etc.</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step Card ──────────────────────────────────────────
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
    : nodeType === 'action' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600';
  const typeIcon = nodeType === 'input' ? '✍️'
    : nodeType === 'condition' ? '🔀'
    : nodeType === 'action' ? '💾' : '💬';
  const typeLabel = nodeType === 'input' ? 'Ask Question'
    : nodeType === 'condition' ? 'Smart Route'
    : nodeType === 'action' ? 'Save & Finish' : 'Message';

  // Variable inserter helper
  const VariableButtons = ({ field, current, onChange }) => {
    if (allVariables.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        <span className="text-[10px] text-gray-400 mr-1 pt-0.5">Insert:</span>
        {allVariables.map(v => (
          <button key={v} type="button" onClick={() => onChange((current || '') + '{{' + v + '}}')}
            className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded hover:bg-purple-100 transition font-medium">
            {v}
          </button>
        ))}
      </div>
    );
  };

  const ScreenSelect = ({ value, onChange, label, helpText }) => (
    <div>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
        <option value="">Pick the next step...</option>
        {allNodes.filter(n => n !== nodeId).map(n => (
          <option key={n} value={n}>{friendlyName(n, allNodes.indexOf(n))}</option>
        ))}
      </select>
      {helpText && <p className="text-[10px] text-gray-400 mt-0.5">{helpText}</p>}
    </div>
  );

  return (
    <div className={`bg-white rounded-xl border mb-2.5 transition-all duration-200 animate-slideUp
      ${open ? 'border-emerald-300 shadow-md ring-1 ring-emerald-100' : 'border-gray-100 shadow-sm hover:border-gray-200 hover:shadow'}`}
      style={{ animationDelay: `${delay}ms` }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs shrink-0
            ${isStart ? 'bg-emerald-50' : 'bg-gray-50'}`}>
            {typeIcon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{name}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${typeBadge}`}>{typeLabel}</span>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">💬 Bot Message</label>
                <textarea value={node.message || ''} onChange={e => onUpdate({ message: e.target.value })} rows={3}
                  placeholder="What should the bot say? e.g. Hi! Welcome to our store. How can we help?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 resize-none" />
                <VariableButtons field="message" current={node.message} onChange={v => onUpdate({ message: v })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  🔘 Reply Buttons <span className="font-normal text-gray-400">— what can the customer tap?</span>
                </label>
                {btns.length > 3 && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded mb-2">WhatsApp shows max 3 buttons. Extra ones appear as a list menu.</p>
                )}
                <div className="space-y-2">
                  {btns.map((btn, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-100">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input value={btn.label} onChange={e => updateBtn(idx, { label: e.target.value })}
                          placeholder="Button text (e.g. View Services)" maxLength={20}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 bg-white" />
                        <select value={btn.action} onChange={e => updateBtn(idx, { action: e.target.value })}
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
                          {BTN_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      </div>
                      {btn.action === 'next' && (
                        <select value={btn.next || ''} onChange={e => updateBtn(idx, { next: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
                          <option value="">Where should this button lead to?</option>
                          {allNodes.filter(n => n !== nodeId).map(n => (
                            <option key={n} value={n}>{friendlyName(n, allNodes.indexOf(n))}</option>
                          ))}
                        </select>
                      )}
                      {btn.action === 'text' && (
                        <textarea value={btn.response || ''} onChange={e => updateBtn(idx, { response: e.target.value })}
                          placeholder="What should the bot reply? e.g. Our hours are Mon-Sat 9AM-6PM" rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 resize-none bg-white" />
                      )}
                      <div className="flex justify-end gap-3 text-xs font-medium pt-1">
                        {idx > 0 && <button onClick={() => moveBtn(idx, -1)} className="text-gray-400 hover:text-gray-600">↑ Up</button>}
                        {idx < btns.length - 1 && <button onClick={() => moveBtn(idx, 1)} className="text-gray-400 hover:text-gray-600">↓ Down</button>}
                        <button onClick={() => removeBtn(idx)} className="text-red-400 hover:text-red-600">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                {btns.length < 10 && (
                  <button onClick={addBtn} className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700">+ Add a Button</button>
                )}
              </div>
            </>
          )}

          {/* INPUT NODE */}
          {nodeType === 'input' && (
            <>
              <div className="bg-purple-50/50 rounded-lg px-3 py-2 border border-purple-100 mb-1">
                <p className="text-[11px] text-purple-700">✍️ This step asks the customer a question and saves their answer. You can use their answer in later messages.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Question to ask the customer</label>
                <textarea value={node.message || ''} onChange={e => onUpdate({ message: e.target.value })} rows={2}
                  placeholder="e.g. What is your name?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 resize-none" />
                <VariableButtons field="message" current={node.message} onChange={v => onUpdate({ message: v })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">What type of answer do you expect?</label>
                  <select value={node.input_type || 'text'} onChange={e => onUpdate({ input_type: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
                    {INPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {INPUT_TYPES.find(t => t.value === (node.input_type || 'text'))?.hint || ''}
                    {' '}— bot will re-ask if customer sends wrong format
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Save this answer as</label>
                  <input value={node.variable || ''} onChange={e => onUpdate({ variable: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                    placeholder="e.g. name, email, city, budget"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400" />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {node.variable
                      ? <>You can use <span className="bg-purple-50 text-purple-600 px-1 rounded font-medium">{`{{${node.variable}}}`}</span> in any message below</>
                      : 'Give it a short name like "name" or "email" — no spaces'}
                  </p>
                </div>
              </div>
              <ScreenSelect value={node.next} onChange={v => onUpdate({ next: v })} label="After they answer, go to" helpText="Pick the step that comes next in the conversation" />
            </>
          )}

          {/* CONDITION NODE */}
          {nodeType === 'condition' && (
            <>
              <div className="bg-amber-50/50 rounded-lg px-3 py-2 border border-amber-100 mb-1">
                <p className="text-[11px] text-amber-700">🔀 This step is automatic — the customer never sees it. It checks an answer and sends them to different steps.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Which answer should we check?</label>
                {allVariables.length > 0 ? (
                  <select value={node.variable || ''} onChange={e => onUpdate({ variable: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400 bg-white">
                    <option value="">Pick an answer to check...</option>
                    {allVariables.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">⚠️ Add an "Ask Question" step first — you need answers to route on.</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">📋 Rules — check the answer and go to different steps</label>
                <div className="space-y-2">
                  {(node.rules || []).map((rule, idx) => (
                    <div key={idx} className="bg-amber-50/50 rounded-lg p-3 border border-amber-100 space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <span className="text-xs text-gray-600 pt-2 shrink-0 font-medium">If {node.variable || 'answer'}</span>
                        <select value={rule.operator || 'equals'} onChange={e => updateRule(idx, { operator: e.target.value })}
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400 bg-white">
                          {CONDITION_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <input value={rule.value || ''} onChange={e => updateRule(idx, { value: e.target.value })}
                          placeholder="e.g. yes, 5, Mumbai"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400 bg-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 shrink-0 font-medium">→ then go to</span>
                        <select value={rule.next || ''} onChange={e => updateRule(idx, { next: e.target.value })}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400 bg-white">
                          <option value="">Pick a step...</option>
                          {allNodes.filter(n => n !== nodeId).map(n => (
                            <option key={n} value={n}>{friendlyName(n, allNodes.indexOf(n))}</option>
                          ))}
                        </select>
                        <button onClick={() => removeRule(idx)} className="text-xs text-red-400 hover:text-red-600 shrink-0">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addRule} className="mt-3 text-xs font-semibold text-amber-600 hover:text-amber-700">+ Add Another Rule</button>
              </div>
              <ScreenSelect value={node.else_next} onChange={v => onUpdate({ else_next: v })} label="If no rules match, go to" helpText="This is the fallback — where to go if none of the rules above apply" />
            </>
          )}

          {/* ACTION NODE */}
          {nodeType === 'action' && (
            <>
              <div className="bg-blue-50/50 rounded-lg px-3 py-2 border border-blue-100 mb-1">
                <p className="text-[11px] text-blue-700">💾 This step saves everything the customer has told you. You can view all saved data in your dashboard.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">What kind of data is this?</label>
                <input value={node.record_type || ''} onChange={e => onUpdate({ record_type: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                  placeholder="e.g. lead, order, feedback, inquiry, registration"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-emerald-400" />
                <p className="text-[10px] text-gray-400 mt-0.5">This helps you organize data in your dashboard — e.g. "leads" tab, "orders" tab</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Thank you message (shown to customer)</label>
                <textarea value={node.message || ''} onChange={e => onUpdate({ message: e.target.value })}
                  placeholder='e.g. Thank you {{name}}! We will contact you at {{email}} shortly. 🙌'
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-emerald-400 resize-none" />
                <VariableButtons field="message" current={node.message} onChange={v => onUpdate({ message: v })} />
              </div>
              <ScreenSelect value={node.next} onChange={v => onUpdate({ next: v })} label="After saving, go to" helpText="Leave empty to end the conversation here" />
            </>
          )}

          {/* Delete */}
          {!isStart && (
            <div className="pt-3 border-t border-gray-100">
              <button onClick={onDelete} className="text-xs font-medium text-red-400 hover:text-red-600">🗑️ Delete this step</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
