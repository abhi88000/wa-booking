// ============================================================
// EmptyState — Apple-style starter cards when canvas is empty.
// ============================================================
import { STARTERS, STEP_GUIDE } from './stepGuidance';
import { Ico } from './icons';

const ICO_MAP = {
  calendar: Ico.calendar,
  target: Ico.target,
  star: Ico.star,
  plus: Ico.plus,
};

export default function EmptyState({ onPickTemplate, onAddStep }) {
  return (
    <div className="absolute inset-0 overflow-y-auto pointer-events-auto bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
            <Ico.sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">What would you like to build?</h2>
          <p className="text-sm text-slate-500 mt-2">Pick a starting point. You can change everything later.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STARTERS.map(s => {
            const Icon = ICO_MAP[s.icon] || Ico.plus;
            return (
              <button
                key={s.id}
                onClick={() => onPickTemplate(s.id)}
                className="text-left group bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md rounded-xl p-4 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{s.title}</div>
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed">{s.desc}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-10">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-3 text-center">Or add a single step</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { type: 'menu',      icon: Ico.message,  color: 'text-blue-600 bg-blue-50',     guide: STEP_GUIDE.menu },
              { type: 'input',     icon: Ico.question, color: 'text-purple-600 bg-purple-50', guide: STEP_GUIDE.input },
              { type: 'condition', icon: Ico.branch,   color: 'text-amber-600 bg-amber-50',   guide: STEP_GUIDE.condition },
              { type: 'action',    icon: Ico.bolt,     color: 'text-emerald-600 bg-emerald-50', guide: STEP_GUIDE.action },
            ].map(s => {
              const Icon = s.icon;
              return (
                <button
                  key={s.type}
                  onClick={() => onAddStep(s.type)}
                  title={s.guide.short}
                  className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-lg p-3 transition text-center"
                >
                  <div className={`w-8 h-8 mx-auto rounded-md flex items-center justify-center mb-1.5 ${s.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-slate-800">{s.guide.title}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{s.guide.short}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
