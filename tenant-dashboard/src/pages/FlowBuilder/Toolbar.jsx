// ============================================================
// Flow Builder Toolbar
// ============================================================
import { Ico } from './icons';

function TBtn({ onClick, disabled, title, children, primary, danger }) {
  const cls = primary
    ? 'px-3 py-1.5 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 disabled:opacity-50'
    : danger
    ? 'px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-red-50 hover:border-red-200 text-slate-700 flex items-center gap-1.5'
    : 'px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={cls}>
      {children}
    </button>
  );
}

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
  errors
}) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-2.5 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 mr-2">
        <span className="text-xs text-slate-500 mr-1">Add:</span>
        <TBtn onClick={() => onAddNode('menu')} title="Menu with buttons">
          <Ico.message className="w-4 h-4 text-blue-600" /> Menu
        </TBtn>
        <TBtn onClick={() => onAddNode('input')} title="Ask the customer a question">
          <Ico.question className="w-4 h-4 text-purple-600" /> Question
        </TBtn>
        <TBtn onClick={() => onAddNode('condition')} title="Branch based on a variable">
          <Ico.branch className="w-4 h-4 text-amber-600" /> If / Else
        </TBtn>
        <TBtn onClick={() => onAddNode('action')} title="Save, notify, or schedule something">
          <Ico.bolt className="w-4 h-4 text-emerald-600" /> Action
        </TBtn>
      </div>

      <div className="h-6 w-px bg-slate-200 mx-1" />

      <TBtn onClick={onAutoLayout} title="Auto-arrange nodes neatly">
        <Ico.layout className="w-4 h-4" /> Auto-arrange
      </TBtn>
      <TBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Ico.undo className="w-4 h-4" /> Undo
      </TBtn>
      <TBtn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
        <Ico.redo className="w-4 h-4" /> Redo
      </TBtn>

      <div className="flex-1" />

      {errors && errors.length > 0 && (
        <div
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 max-w-md truncate flex items-center gap-1.5"
          title={errors.join('\n')}
        >
          <Ico.warn className="w-4 h-4 shrink-0" />
          <span className="truncate">{errors.length} issue{errors.length > 1 ? 's' : ''}: {errors[0]}</span>
        </div>
      )}

      <TBtn onClick={onCancel} title="Discard unsaved changes">
        Cancel
      </TBtn>
      <TBtn primary onClick={onSave} disabled={saving} title="Save and publish flow">
        <Ico.save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save flow'}
      </TBtn>
    </div>
  );
}
