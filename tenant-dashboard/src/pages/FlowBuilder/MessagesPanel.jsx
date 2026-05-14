// ============================================================
// MessagesPanel — Browse + edit all system messages.
// Used both in the Flow Builder drawer and in the standalone page.
// ============================================================
import { useState, useMemo } from 'react';
import SYSTEM_MESSAGES, { getMessagesByCategory, CATEGORY_META } from '../systemMessages';
import MessageEditor from './MessageEditor';
import { Ico } from './icons';

const CAT_ICON = {
  Booking: Ico.calendar,
  Cancellation: Ico.close,
  Reschedule: Ico.clock,
  Status: Ico.message,
  Navigation: Ico.layout,
  Reminders: Ico.bell,
};

const CAT_COLOR = {
  Booking: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Cancellation: 'text-red-700 bg-red-50 border-red-200',
  Reschedule: 'text-blue-700 bg-blue-50 border-blue-200',
  Status: 'text-purple-700 bg-purple-50 border-purple-200',
  Navigation: 'text-slate-700 bg-slate-50 border-slate-200',
  Reminders: 'text-amber-700 bg-amber-50 border-amber-200',
};

export default function MessagesPanel({ overrides, onChange, focusId = null, compact = false }) {
  const groups = useMemo(getMessagesByCategory, []);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState(() => {
    if (focusId) {
      const m = SYSTEM_MESSAGES.find(x => x.id === focusId);
      return m ? m.category : 'Booking';
    }
    return 'Booking';
  });
  const [expanded, setExpanded] = useState(() => focusId ? { [focusId]: true } : {});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups[activeCat] || [];
    return SYSTEM_MESSAGES.filter(m =>
      m.label.toLowerCase().includes(q) ||
      m.desc.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.default || '').toLowerCase().includes(q)
    );
  }, [search, activeCat, groups]);

  const updateOne = (id, text) => {
    const next = { ...overrides };
    const def = SYSTEM_MESSAGES.find(m => m.id === id)?.default;
    if (!text || text === def) {
      delete next[id];
    } else {
      next[id] = text;
    }
    onChange(next);
  };

  const overrideCount = Object.keys(overrides || {}).length;
  const showCats = !search.trim();

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Search bar */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="relative">
          <Ico.search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="w-full text-sm pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        {overrideCount > 0 && (
          <div className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1.5">
            <Ico.check className="w-3.5 h-3.5" /> {overrideCount} message{overrideCount > 1 ? 's' : ''} customised
          </div>
        )}
      </div>

      {/* Category tabs */}
      {showCats && (
        <div className="px-4 pt-3 pb-1 bg-white border-b border-slate-200 flex flex-wrap gap-1.5">
          {Object.keys(groups).map(cat => {
            const Icon = CAT_ICON[cat] || Ico.message;
            const active = activeCat === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`text-xs px-2.5 py-1.5 rounded-full border inline-flex items-center gap-1.5 transition ${active ? CAT_COLOR[cat] + ' font-semibold' : 'text-slate-600 border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {cat}
                <span className="text-[10px] opacity-60">{groups[cat].length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-12">
            <Ico.search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No messages match "{search}"
          </div>
        )}
        {filtered.map(msg => {
          const isExpanded = !!expanded[msg.id];
          const Icon = CAT_ICON[msg.category] || Ico.message;
          const overridden = overrides && overrides[msg.id] !== undefined;
          return (
            <div key={msg.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(e => ({ ...e, [msg.id]: !e[msg.id] }))}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${CAT_COLOR[msg.category] || 'bg-slate-50 border-slate-200'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-2">
                    {msg.label}
                    {overridden && <span className="text-[10px] uppercase tracking-wider bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">customised</span>}
                    {!msg.editable && <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">read-only</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">{msg.desc}</div>
                </div>
                {isExpanded ? <Ico.up className="w-4 h-4 text-slate-400 shrink-0" /> : <Ico.down className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                  <MessageEditor
                    message={msg}
                    value={overrides && overrides[msg.id]}
                    onChange={(text) => updateOne(msg.id, text)}
                    onReset={() => updateOne(msg.id, msg.default)}
                    compact={compact}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
