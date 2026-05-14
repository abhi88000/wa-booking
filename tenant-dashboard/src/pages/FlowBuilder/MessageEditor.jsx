// ============================================================
// MessageEditor — Single message edit card.
// Apple-grade: live preview, draggable variable chips, restore default.
// ============================================================
import { useState, useRef } from 'react';
import { Ico } from './icons';

// Render {{variables}} with sample data for live preview
function fillVars(text, sample) {
  // First: drop [[optional segments]] if any {{var}} inside is empty in sample
  text = text.replace(/\[\[([^\]]*?)\]\]/g, (_, seg) => {
    const keys = [...seg.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
    if (keys.length === 0) return seg;
    const allFilled = keys.every(k => sample[k] !== undefined && String(sample[k]).trim() !== '');
    return allFilled ? seg : '';
  });
  // Then substitute remaining vars
  text = text.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (sample[k] !== undefined) return sample[k];
    return '{{' + k + '}}';
  });
  // Collapse extra blank lines
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// Format WhatsApp markdown (*bold*) for the preview
function formatPreview(text) {
  // bold *word* → <strong>
  const parts = [];
  let last = 0;
  const re = /\*([^*\n]+)\*/g;
  let m;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={key++}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const SAMPLE_DATA = {
  provider_name: 'Dr. Smith',
  patient_name: 'Sarah',
  customer_name: 'Sarah',
  service_name: 'Consultation',
  business_name: 'Acme Clinic',
  date: 'Mon, Jan 15',
  time: '3:30 PM',
  start_time: '3:30 PM',
  end_time: '4:00 PM',
  location: '123 Main St',
  status: 'confirmed',
  appointment_count: '4',
  rating: '5',
};

export default function MessageEditor({ message, value, onChange, onReset, compact = false }) {
  const taRef = useRef(null);
  const [copied, setCopied] = useState('');
  const currentText = value ?? message.default;
  const isDefault = !value || value === message.default;

  const insertVar = (varName) => {
    const ta = taRef.current;
    const token = '{{' + varName + '}}';
    if (!ta) {
      onChange(currentText + token);
      return;
    }
    const start = ta.selectionStart ?? currentText.length;
    const end = ta.selectionEnd ?? currentText.length;
    const next = currentText.slice(0, start) + token + currentText.slice(end);
    onChange(next);
    // Restore cursor after token
    setTimeout(() => {
      try {
        ta.focus();
        ta.setSelectionRange(start + token.length, start + token.length);
      } catch (_) {}
    }, 0);
  };

  const copyVar = (varName) => {
    const token = '{{' + varName + '}}';
    try { navigator.clipboard.writeText(token); } catch (_) {}
    setCopied(varName);
    setTimeout(() => setCopied(''), 1200);
  };

  const preview = fillVars(currentText, SAMPLE_DATA);

  return (
    <div className={`bg-white border border-slate-200 rounded-xl ${compact ? 'p-4' : 'p-5'} space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{message.label}</div>
          <div className="text-xs text-slate-500 mt-0.5">{message.desc}</div>
        </div>
        {!isDefault && message.editable && (
          <button
            onClick={onReset}
            className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 shrink-0"
            title="Restore the default text"
          >
            <Ico.undo className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      {message.note && (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-md px-3 py-2 flex gap-2">
          <Ico.info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{message.note}</span>
        </div>
      )}

      {message.variables && message.variables.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
            Variables you can use {message.editable && <span className="normal-case text-slate-400 font-normal">— click to insert</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {message.variables.map(v => (
              <button
                key={v}
                onClick={() => message.editable ? insertVar(v) : copyVar(v)}
                className="text-[11px] font-mono bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 transition"
                title={message.editable ? 'Insert at cursor' : 'Copy variable'}
              >
                {'{{' + v + '}}'}
                {copied === v && <span className="ml-1 text-emerald-600">copied</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
            {message.editable ? 'Your text' : 'Default text (read-only)'}
          </label>
          <textarea
            ref={taRef}
            value={currentText}
            disabled={!message.editable}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            spellCheck={false}
            className={`w-full text-sm font-mono border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${!message.editable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
            Live preview (with sample data)
          </label>
          <div className="rounded-2xl bg-[#e5ddd5] p-3 min-h-[200px]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)', backgroundSize: '16px 16px' }}>
            <div className="bg-[#dcf8c6] rounded-lg rounded-tl-sm shadow-sm px-3 py-2 max-w-[95%] text-[13px] text-slate-900 whitespace-pre-wrap leading-relaxed">
              {formatPreview(preview)}
              <div className="text-[10px] text-slate-500 mt-1 text-right">10:24 AM ✓✓</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
