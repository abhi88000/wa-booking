// ============================================================
// Template Picker Modal
// ============================================================
import { TEMPLATES } from './templates';

export default function TemplatePicker({ open, onPick, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Choose a template</h2>
            <p className="text-xs text-slate-500 mt-0.5">Pick a ready-made template, or start from a blank flow</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className="text-left border-2 border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all rounded-xl p-4 bg-white"
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{t.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900">{t.name}</div>
                  <div className="text-sm text-slate-600 mt-1">{t.desc}</div>
                  <div className="text-xs text-slate-400 mt-2">{t.industries}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
