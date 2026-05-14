// ============================================================
// Node Editor — Side Panel for the Selected Node
// ============================================================
import { useState } from 'react';

const INPUT_TYPES = [
  { v: 'text', l: 'Text' }, { v: 'number', l: 'Number' }, { v: 'email', l: 'Email' },
  { v: 'phone', l: 'Phone' }, { v: 'date', l: 'Date' }, { v: 'rating', l: 'Rating 1-5' },
  { v: 'yes_no', l: 'Yes / No' }
];

const BUTTON_ACTIONS = [
  { v: 'next', l: 'Go to next step' },
  { v: 'text', l: 'Send a text reply' },
  { v: 'booking_flow', l: 'Start booking' },
  { v: 'booking_status', l: 'Show upcoming bookings' },
  { v: 'booking_cancel', l: 'Cancel / reschedule' },
  { v: 'ai', l: 'Switch to AI chat' }
];

const ACTION_TYPES = [
  { v: 'save_record', l: 'Save record (lead/order/feedback)' },
  { v: 'notify_admin', l: 'Notify admin' },
  { v: 'set_variable', l: 'Set a variable' },
  { v: 'send_followup', l: 'Schedule follow-up message' }
];

const OPERATORS = [
  { v: 'equals', l: '=' }, { v: 'not_equals', l: '≠' },
  { v: 'contains', l: 'contains' },
  { v: 'greater_than', l: '>' }, { v: 'less_than', l: '<' },
  { v: 'is_empty', l: 'is empty' }, { v: 'is_not_empty', l: 'is not empty' }
];

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

const inputClass = "w-full text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";

export default function NodeEditor({ node, allNodes, onChange, onDelete, onDuplicate, onClose }) {
  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6">
        <div className="text-4xl mb-2">👈</div>
        <div className="text-sm font-medium">Click a step on the canvas to edit it</div>
        <div className="text-xs mt-1 text-slate-400">Or use the toolbar to add a new step</div>
      </div>
    );
  }

  const update = (patch) => onChange({ ...node.data, ...patch });
  const data = node.data;
  const type = data.type || 'menu';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{type} step</div>
          <div className="text-sm font-semibold text-slate-800">{data.name || node.id}</div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onDuplicate} title="Duplicate" className="p-1.5 rounded hover:bg-slate-200 text-slate-600">📋</button>
          {node.id !== 'start' && (
            <button onClick={onDelete} title="Delete" className="p-1.5 rounded hover:bg-red-100 text-red-600">🗑️</button>
          )}
          <button onClick={onClose} title="Close" className="p-1.5 rounded hover:bg-slate-200 text-slate-600">✕</button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Field label="Step name" hint="A friendly name (just for you)">
          <input
            type="text"
            className={inputClass}
            value={data.name || ''}
            placeholder={node.id}
            onChange={e => update({ name: e.target.value })}
          />
        </Field>

        {(type === 'menu' || type === 'input') && (
          <Field label="Message">
            <textarea
              className={inputClass}
              rows={4}
              value={data.message || ''}
              placeholder={type === 'menu' ? 'Hi! How can we help?' : 'What is your name?'}
              onChange={e => update({ message: e.target.value })}
            />
          </Field>
        )}

        {type === 'menu' && <MenuEditor data={data} update={update} allNodes={allNodes} />}
        {type === 'input' && <InputEditor data={data} update={update} allNodes={allNodes} />}
        {type === 'condition' && <ConditionEditor data={data} update={update} allNodes={allNodes} />}
        {type === 'action' && <ActionEditor data={data} update={update} allNodes={allNodes} />}
      </div>
    </div>
  );
}

// ─── Menu Editor ───────────────────────────────────────
function MenuEditor({ data, update, allNodes }) {
  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  const setButtons = (next) => update({ buttons: next });
  const addButton = () => setButtons([...buttons, { id: `btn_${Date.now()}`, label: '', action: 'next' }]);
  const updateBtn = (i, patch) => setButtons(buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  const removeBtn = (i) => setButtons(buttons.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= buttons.length) return;
    const copy = [...buttons];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setButtons(copy);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-700">
          Buttons {buttons.length > 3 && <span className="text-amber-600 ml-1">(shown as list on WhatsApp)</span>}
        </label>
        <button onClick={addButton} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded">+ Add button</button>
      </div>
      {buttons.length === 0 && (
        <div className="text-xs italic text-slate-400 border border-dashed border-slate-300 rounded p-3 text-center">
          No buttons yet — click "Add button"
        </div>
      )}
      {buttons.map((btn, i) => (
        <div key={i} className="border border-slate-200 rounded-md p-2 space-y-2 bg-slate-50">
          <div className="flex items-center gap-1">
            <input
              type="text"
              className={inputClass}
              placeholder="Button label"
              value={btn.label || ''}
              onChange={e => updateBtn(i, { label: e.target.value })}
              maxLength={20}
            />
            <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1.5 text-slate-500 disabled:opacity-30">↑</button>
            <button onClick={() => move(i, 1)} disabled={i === buttons.length - 1} className="px-1.5 text-slate-500 disabled:opacity-30">↓</button>
            <button onClick={() => removeBtn(i)} className="px-1.5 text-red-500">✕</button>
          </div>
          <select className={inputClass} value={btn.action || 'next'} onChange={e => updateBtn(i, { action: e.target.value })}>
            {BUTTON_ACTIONS.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>
          {btn.action === 'next' && (
            <select className={inputClass} value={btn.next || ''} onChange={e => updateBtn(i, { next: e.target.value })}>
              <option value="">— Select next step —</option>
              {allNodes.filter(n => n.id !== data.id).map(n => (
                <option key={n.id} value={n.id}>{n.data.name || n.id}</option>
              ))}
            </select>
          )}
          {btn.action === 'text' && (
            <textarea
              className={inputClass}
              rows={2}
              placeholder="Reply text"
              value={btn.response || ''}
              onChange={e => updateBtn(i, { response: e.target.value })}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Input Editor ───────────────────────────────────────
function InputEditor({ data, update, allNodes }) {
  return (
    <>
      <Field label="Variable name" hint="Snake_case. Used in conditions and templates.">
        <input
          type="text"
          className={inputClass}
          value={data.variable || ''}
          placeholder="customer_name"
          onChange={e => update({ variable: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
        />
      </Field>
      <Field label="Answer type">
        <select className={inputClass} value={data.input_type || 'text'} onChange={e => update({ input_type: e.target.value })}>
          {INPUT_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </Field>
      <Field label="Next step">
        <select className={inputClass} value={data.next || ''} onChange={e => update({ next: e.target.value })}>
          <option value="">— Select —</option>
          {allNodes.filter(n => n.id !== data.id).map(n => (
            <option key={n.id} value={n.id}>{n.data.name || n.id}</option>
          ))}
        </select>
      </Field>
    </>
  );
}

// ─── Condition Editor ───────────────────────────────────
function ConditionEditor({ data, update, allNodes }) {
  const rules = Array.isArray(data.rules) ? data.rules : [];
  const setRules = (next) => update({ rules: next });
  const addRule = () => setRules([...rules, { operator: 'equals', value: '', next: '' }]);

  return (
    <>
      <Field label="Variable to check">
        <input
          type="text"
          className={inputClass}
          value={data.variable || ''}
          placeholder="customer_name"
          onChange={e => update({ variable: e.target.value })}
          list="variables-list"
        />
      </Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-700">Rules</label>
          <button onClick={addRule} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded">+ Add rule</button>
        </div>
        {rules.map((rule, i) => (
          <div key={i} className="border border-slate-200 rounded p-2 space-y-2 bg-slate-50">
            <div className="flex items-center gap-1">
              <select className={inputClass} value={rule.operator || 'equals'} onChange={e => setRules(rules.map((r, idx) => idx === i ? { ...r, operator: e.target.value } : r))}>
                {OPERATORS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <button onClick={() => setRules(rules.filter((_, idx) => idx !== i))} className="px-1.5 text-red-500">✕</button>
            </div>
            {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
              <input
                type="text"
                className={inputClass}
                placeholder="value to compare"
                value={rule.value ?? ''}
                onChange={e => setRules(rules.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r))}
              />
            )}
            <select className={inputClass} value={rule.next || ''} onChange={e => setRules(rules.map((r, idx) => idx === i ? { ...r, next: e.target.value } : r))}>
              <option value="">— If true, go to —</option>
              {allNodes.filter(n => n.id !== data.id).map(n => (
                <option key={n.id} value={n.id}>{n.data.name || n.id}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <Field label="Else (no rule matched)">
        <select className={inputClass} value={data.else_next || ''} onChange={e => update({ else_next: e.target.value })}>
          <option value="">— None —</option>
          {allNodes.filter(n => n.id !== data.id).map(n => (
            <option key={n.id} value={n.id}>{n.data.name || n.id}</option>
          ))}
        </select>
      </Field>
    </>
  );
}

// ─── Action Editor ──────────────────────────────────────
function ActionEditor({ data, update, allNodes }) {
  const actionType = data.action_type || 'save_record';
  return (
    <>
      <Field label="What should happen?">
        <select className={inputClass} value={actionType} onChange={e => update({ action_type: e.target.value })}>
          {ACTION_TYPES.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
        </select>
      </Field>
      {actionType === 'save_record' && (
        <Field label="Record type">
          <input className={inputClass} value={data.record_type || 'lead'} onChange={e => update({ record_type: e.target.value })} />
        </Field>
      )}
      {actionType === 'set_variable' && (
        <>
          <Field label="Variable name">
            <input className={inputClass} value={data.set_var || ''} onChange={e => update({ set_var: e.target.value })} />
          </Field>
          <Field label="Value">
            <input className={inputClass} value={data.set_value || ''} onChange={e => update({ set_value: e.target.value })} />
          </Field>
        </>
      )}
      {actionType === 'send_followup' && (
        <>
          <Field label="Send after (minutes)">
            <input type="number" min={1} className={inputClass} value={data.delay_minutes || ''} onChange={e => update({ delay_minutes: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea rows={3} className={inputClass} value={data.followup_message || ''} onChange={e => update({ followup_message: e.target.value })} />
          </Field>
        </>
      )}
      <Field label="Confirmation message (optional)">
        <textarea rows={2} className={inputClass} value={data.message || ''} onChange={e => update({ message: e.target.value })} />
      </Field>
      <Field label="Next step (optional)">
        <select className={inputClass} value={data.next || ''} onChange={e => update({ next: e.target.value })}>
          <option value="">— None (end of flow) —</option>
          {allNodes.filter(n => n.id !== data.id).map(n => (
            <option key={n.id} value={n.id}>{n.data.name || n.id}</option>
          ))}
        </select>
      </Field>
    </>
  );
}
