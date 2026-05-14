// ============================================================
// Flow Builder Toolbar — single tight row.
// Brand left, add steps, secondary tools, view toggles, save right.
// ============================================================
import { Ico } from './icons';

function Btn({ onClick, disabled, title, children, variant = 'ghost', active }) {
  const base = 'inline-flex items-center gap-1.5 rounded-md text-sm transition shrink-0';
  const variants = {
    primary: 'px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed',
    outline: 'px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed',
    ghost:   'px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed' + (active ? ' bg-slate-100' : ''),
    icon:    'p-1.5 text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-30 disabled:cursor-not-allowed',
  };
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}

const Sep = () => <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />;

const ADD_STEPS = [
  { type: 'menu',      label: 'Menu',      icon: 'message',  color: 'text-blue-600',    tip: 'Buttons the customer can tap' },
  { type: 'input',     label: 'Question',  icon: 'question', color: 'text-purple-600',  tip: 'Ask for name, rating, email...' },
  { type: 'condition', label: 'If / Else', icon: 'branch',   color: 'text-amber-600',   tip: 'Branch based on an answer' },
  { type: 'action',    label: 'Action',    icon: 'bolt',     color: 'text-emerald-600', tip: 'Save lead, notify staff, etc.' },
];

export default function Toolbar({
  onAddNode,
  onAutoLayout,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onCancel,
  saving,
  saved,
  errors,
  onOpenMessages,
  onOpenLabels,
  onOpenTemplates,
  onTogglePreview,
  previewOpen,
}) {
  const hasErrors = errors && errors.length > 0;

  return (
    <div className="bg-white border-b border-slate-200 px-3 sm:px-4 h-12 flex items-center gap-1 overflow-x-auto">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-3 shrink-0">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white">
          <Ico.canvas className="w-4 h-4" />
        </div>
        <div className="hidden md:block">
          <div className="text-sm font-semibold text-slate-900 leading-tight">Flow Builder</div>
        </div>
      </div>

      <Sep />

      {/* Add steps */}
      {ADD_STEPS.map(s => {
        const Icon = Ico[s.icon];
        return (
          <Btn key={s.type} onClick={() => onAddNode(s.type)} title={s.tip}>
            <Icon className={`w-4 h-4 ${s.color}`} />
            <span className="hidden lg:inline">{s.label}</span>
          </Btn>
        );
      })}

      <Sep />

      {/* History + layout — icon-only to save space */}
      <Btn variant="icon" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Ico.undo className="w-4 h-4" />
      </Btn>
      <Btn variant="icon" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
        <Ico.redo className="w-4 h-4" />
      </Btn>
      <Btn variant="icon" onClick={onAutoLayout} title="Auto-arrange nodes">
        <Ico.layout className="w-4 h-4" />
      </Btn>

      <Sep />

      {/* Configuration drawers */}
      {onOpenMessages && (
        <Btn onClick={onOpenMessages} title="Edit the messages your bot sends">
          <Ico.message className="w-4 h-4 text-emerald-600" />
          <span className="hidden xl:inline">Messages</span>
        </Btn>
      )}
      {onOpenLabels && (
        <Btn onClick={onOpenLabels} title="Rename Doctor / Patient / Appointment">
          <Ico.tag className="w-4 h-4 text-blue-600" />
          <span className="hidden xl:inline">Labels</span>
        </Btn>
      )}
      {onOpenTemplates && (
        <Btn onClick={onOpenTemplates} title="Start from a template">
          <Ico.template className="w-4 h-4 text-slate-600" />
          <span className="hidden xl:inline">Templates</span>
        </Btn>
      )}
      {onTogglePreview && (
        <Btn onClick={onTogglePreview} active={previewOpen} title="WhatsApp phone preview">
          <Ico.phone className="w-4 h-4 text-slate-600" />
          <span className="hidden xl:inline">Preview</span>
        </Btn>
      )}

      <div className="flex-1 min-w-2" />

      {/* Status pill */}
      {hasErrors && (
        <div
          className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 inline-flex items-center gap-1.5 shrink-0 max-w-[260px]"
          title={errors.join('\n')}
        >
          <Ico.warn className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{errors.length} issue{errors.length > 1 ? 's' : ''}</span>
        </div>
      )}
      {!hasErrors && saved && (
        <span className="text-xs text-emerald-700 inline-flex items-center gap-1 shrink-0">
          <Ico.check className="w-3.5 h-3.5" /> Saved
        </span>
      )}

      <Btn variant="ghost" onClick={onCancel} title="Discard unsaved changes">
        Cancel
      </Btn>
      <Btn variant="primary" onClick={onSave} disabled={saving} title="Save and publish flow">
        <Ico.save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save'}
      </Btn>
    </div>
  );
}
