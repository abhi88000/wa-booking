// ============================================================
// Flow Builder Toolbar
// ============================================================
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
  const btn = "px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5";
  const btnPrimary = "px-3 py-1.5 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 disabled:opacity-50";

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-2.5 flex items-center gap-2 flex-wrap">
      {/* Add node */}
      <div className="flex items-center gap-1 mr-2">
        <span className="text-xs text-slate-500 mr-1">Add:</span>
        <button className={btn} onClick={() => onAddNode('menu')} title="Menu with buttons">
          💬 Menu
        </button>
        <button className={btn} onClick={() => onAddNode('input')} title="Ask a question">
          ✏️ Question
        </button>
        <button className={btn} onClick={() => onAddNode('condition')} title="Branch based on a variable">
          🔀 If/Else
        </button>
        <button className={btn} onClick={() => onAddNode('action')} title="Do something (save, notify, schedule)">
          ⚙️ Action
        </button>
      </div>

      <div className="h-6 w-px bg-slate-200 mx-1" />

      <button className={btn} onClick={onAutoLayout} title="Auto-arrange nodes">
        🧹 Auto-arrange
      </button>
      <button className={btn} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">↶ Undo</button>
      <button className={btn} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">↷ Redo</button>

      <div className="flex-1" />

      {errors && errors.length > 0 && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 max-w-md truncate" title={errors.join('\n')}>
          ⚠️ {errors.length} issue{errors.length > 1 ? 's' : ''}: {errors[0]}
        </div>
      )}

      <button className={btn} onClick={onCancel}>Cancel</button>
      <button className={btnPrimary} onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : '💾 Save flow'}
      </button>
    </div>
  );
}
