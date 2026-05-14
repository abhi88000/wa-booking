// ============================================================
// MessagesDrawer — Side drawer inside Flow Builder.
// Reuses MessagesPanel. Includes link to the full page.
// ============================================================
import { Link } from 'react-router-dom';
import MessagesPanel from './MessagesPanel';
import { Ico } from './icons';

export default function MessagesDrawer({ open, onClose, overrides, onChange, focusId }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-3xl bg-white shadow-2xl z-50 flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Ico.message className="w-4 h-4 text-emerald-600" />
              Bot Messages
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Confirmations, reminders, errors. Customise any of them.</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/system-messages"
              onClick={onClose}
              className="text-xs text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
              title="Open the full page"
            >
              <Ico.externalLink className="w-3.5 h-3.5" /> Full page
            </Link>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <Ico.close className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <MessagesPanel overrides={overrides} onChange={onChange} focusId={focusId} compact />
        </div>
      </div>
    </>
  );
}
