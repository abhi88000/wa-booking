// ============================================================
// Node Editor - Side Panel for the Selected Node
// ============================================================
import { useState } from 'react';
import { Ico } from './icons';
import { BUTTON_ACTION_META, ACTION_TYPE_META, COLOR_CLASSES } from './actionMeta';
import { STEP_GUIDE } from './stepGuidance';

// Maps booking-related button actions to the relevant system message id
const BTN_ACTION_TO_MSG = {
  booking_flow: 'booking_confirmation',
  booking_cancel: 'cancel_confirmation',
  booking_status: 'upcoming_appointments',
};

function StepHint({ type }) {
  const guide = STEP_GUIDE[type];
  const [open, setOpen] = useState(false);
  if (!guide) return null;
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-100 transition">
        <div className="flex items-center gap-2 min-w-0">
          <Ico.info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[11px] text-slate-600"><strong className="font-semibold">{guide.title}</strong> — {guide.short}</span>
        </div>
        {open ? <Ico.up className="w-3 h-3 text-slate-400" /> : <Ico.down className="w-3 h-3 text-slate-400" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-200 bg-white space-y-2">
          <div className="text-[11px] text-slate-500 italic">{guide.when}</div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Examples</div>
            <ul className="space-y-1">
              {guide.examples.map((ex, i) => (
                <li key={i} className="text-[11px] text-slate-700 leading-relaxed">
                  <strong className="font-semibold text-slate-800">{ex.name}.</strong> {ex.text}
                </li>
              ))}
            </ul>
          </div>
          {guide.tip && (
            <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 flex gap-1.5">
              <Ico.sparkles className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{guide.tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const INPUT_TYPES = [
  { v: 'text', l: 'Text' }, { v: 'number', l: 'Number' }, { v: 'email', l: 'Email' },
  { v: 'phone', l: 'Phone' }, { v: 'date', l: 'Date' }, { v: 'rating', l: 'Rating 1-5' },
  { v: 'yes_no', l: 'Yes / No' }
];

const BUTTON_ACTION_ORDER = ['next', 'text', 'booking_flow', 'booking_status', 'booking_cancel', 'ai'];

const OPERATORS = [
  { v: 'equals', l: 'equals' }, { v: 'not_equals', l: 'does not equal' },
  { v: 'contains', l: 'contains' },
  { v: 'greater_than', l: 'greater than' }, { v: 'less_than', l: 'less than' },
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

export default function NodeEditor({ node, allNodes, onChange, onDelete, onDuplicate, onClose, onOpenMessage }) {
  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6">
        <Ico.pointer className="w-10 h-10 mb-3 text-slate-300" />
        <div className="text-sm font-medium">Click a step on the canvas to edit it</div>
        <div className="text-xs mt-1 text-slate-400">Or use the toolbar above to add a new step</div>
      </div>
    );
  }

  const update = (patch) => onChange({ ...node.data, ...patch });
  const data = node.data;
  const type = data.type || 'menu';
  const NodeIco = { menu: Ico.message, input: Ico.question, condition: Ico.branch, action: Ico.bolt }[type] || Ico.message;
  const headColor = { menu: 'text-blue-600', input: 'text-purple-600', condition: 'text-amber-600', action: 'text-emerald-600' }[type];

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <NodeIco className={`w-5 h-5 shrink-0 ${headColor}`} />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{type} step</div>
            <div className="text-sm font-semibold text-slate-800 truncate">{data.name || node.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onDuplicate} title="Duplicate" className="p-1.5 rounded hover:bg-slate-200 text-slate-600">
            <Ico.copy className="w-4 h-4" />
          </button>
          {node.id !== 'start' && (
            <button onClick={onDelete} title="Delete" className="p-1.5 rounded hover:bg-red-100 text-red-600">
              <Ico.trash className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} title="Close" className="p-1.5 rounded hover:bg-slate-200 text-slate-600">
            <Ico.close className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <StepHint type={type} />

        <Field label="Step name" hint="A friendly name for your reference">
          <input
            type="text"
            className={inputClass}
            value={data.name || ''}
            placeholder={node.id}
            onChange={e => update({ name: e.target.value })}
          />
        </Field>

        {(type === 'menu' || type === 'input') && (
          <Field label="Message sent to customer">
            <textarea
              className={inputClass}
              rows={4}
              value={data.message || ''}
              placeholder={type === 'menu' ? 'Hi! How can we help?' : 'What is your name?'}
              onChange={e => update({ message: e.target.value })}
            />
          </Field>
        )}

        {type === 'menu' && <MenuEditor data={data} update={update} allNodes={allNodes} onOpenMessage={onOpenMessage} />}
        {type === 'input' && <InputEditor data={data} update={update} allNodes={allNodes} />}
        {type === 'condition' && <ConditionEditor data={data} update={update} allNodes={allNodes} />}
        {type === 'action' && <ActionEditor data={data} update={update} allNodes={allNodes} />}
      </div>
    </div>
  );
}

// --- Menu Editor ---------------------------------------
function MenuEditor({ data, update, allNodes, onOpenMessage }) {
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
        <button onClick={addButton} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded inline-flex items-center gap-1">
          <Ico.plus className="w-3 h-3" /> Add button
        </button>
      </div>
      {buttons.length === 0 && (
        <div className="text-xs italic text-slate-400 border border-dashed border-slate-300 rounded p-3 text-center">
          No buttons yet - click "Add button"
        </div>
      )}
      {buttons.map((btn, i) => {
        const meta = BUTTON_ACTION_META[btn.action] || BUTTON_ACTION_META.next;
        return (
          <div key={i} className="border border-slate-200 rounded-md p-2.5 space-y-2 bg-slate-50">
            <div className="flex items-center gap-1">
              <input
                type="text"
                className={inputClass}
                placeholder="Button label (what customer sees)"
                value={btn.label || ''}
                onChange={e => updateBtn(i, { label: e.target.value })}
                maxLength={20}
              />
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-slate-500 disabled:opacity-30 hover:bg-slate-200 rounded">
                <Ico.up className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === buttons.length - 1} className="p-1 text-slate-500 disabled:opacity-30 hover:bg-slate-200 rounded">
                <Ico.down className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => removeBtn(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                <Ico.trash className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">When tapped, this button will:</label>
              <select className={inputClass} value={btn.action || 'next'} onChange={e => updateBtn(i, { action: e.target.value })}>
                {BUTTON_ACTION_ORDER.map(key => {
                  const m = BUTTON_ACTION_META[key];
                  return <option key={key} value={key}>{m.label}</option>;
                })}
              </select>
              {meta.desc && (
                <div className={`mt-1.5 text-[11px] rounded border px-2 py-1 ${COLOR_CLASSES[meta.color] || COLOR_CLASSES.slate}`}>
                  <div className="flex items-start gap-1.5">
                    <meta.Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{meta.desc}</span>
                  </div>
                </div>
              )}
              {BTN_ACTION_TO_MSG[btn.action] && onOpenMessage && (
                <button
                  type="button"
                  onClick={() => onOpenMessage(BTN_ACTION_TO_MSG[btn.action])}
                  className="mt-1.5 text-[11px] text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                >
                  <Ico.message className="w-3 h-3" /> Customise the message customers receive
                  <Ico.arrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {btn.action === 'next' && (
              <Field label="Go to step">
                <select className={inputClass} value={btn.next || ''} onChange={e => updateBtn(i, { next: e.target.value })}>
                  <option value="">-- Select next step --</option>
                  {allNodes.filter(n => n.id !== data.id).map(n => (
                    <option key={n.id} value={n.id}>{n.data.name || n.id}</option>
                  ))}
                </select>
              </Field>
            )}
            {btn.action === 'text' && (
              <Field label="Reply message">
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="Thanks! We'll get back to you."
                  value={btn.response || ''}
                  onChange={e => updateBtn(i, { response: e.target.value })}
                />
              </Field>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Input Editor --------------------------------------
function InputEditor({ data, update, allNodes }) {
  return (
    <>
      <Field label="Variable name" hint="snake_case. Used in conditions and message templates like {{customer_name}}">
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
          <option value="">-- Select --</option>
          {allNodes.filter(n => n.id !== data.id).map(n => (
            <option key={n.id} value={n.id}>{n.data.name || n.id}</option>
          ))}
        </select>
      </Field>
    </>
  );
}

// --- Condition Editor ----------------------------------
function ConditionEditor({ data, update, allNodes }) {
  const rules = Array.isArray(data.rules) ? data.rules : [];
  const setRules = (next) => update({ rules: next });
  const addRule = () => setRules([...rules, { operator: 'equals', value: '', next: '' }]);

  return (
    <>
      <Field label="Variable to check" hint="Use a variable saved by an earlier Question step">
        <input
          type="text"
          className={inputClass}
          value={data.variable || ''}
          placeholder="customer_name"
          onChange={e => update({ variable: e.target.value })}
        />
      </Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-700">Rules (first match wins)</label>
          <button onClick={addRule} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded inline-flex items-center gap-1">
            <Ico.plus className="w-3 h-3" /> Add rule
          </button>
        </div>
        {rules.map((rule, i) => (
          <div key={i} className="border border-slate-200 rounded p-2 space-y-2 bg-slate-50">
            <div className="flex items-center gap-1">
              <select className={inputClass} value={rule.operator || 'equals'} onChange={e => setRules(rules.map((r, idx) => idx === i ? { ...r, operator: e.target.value } : r))}>
                {OPERATORS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <button onClick={() => setRules(rules.filter((_, idx) => idx !== i))} className="p-1 text-red-500 hover:bg-red-50 rounded">
                <Ico.trash className="w-3.5 h-3.5" />
              </button>
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
              <option value="">-- If true, go to --</option>
              {allNodes.filter(n => n.id !== data.id).map(n => (
                <option key={n.id} value={n.id}>{n.data.name || n.id}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <Field label="Else (no rule matched)">
        <select className={inputClass} value={data.else_next || ''} onChange={e => update({ else_next: e.target.value })}>
          <option value="">-- None --</option>
          {allNodes.filter(n => n.id !== data.id).map(n => (
            <option key={n.id} value={n.id}>{n.data.name || n.id}</option>
          ))}
        </select>
      </Field>
    </>
  );
}

// --- Action Editor -------------------------------------
function ActionEditor({ data, update, allNodes }) {
  const actionType = data.action_type || 'save_record';
  const meta = ACTION_TYPE_META[actionType] || ACTION_TYPE_META.save_record;
  return (
    <>
      <Field label="What should happen?">
        <select className={inputClass} value={actionType} onChange={e => update({ action_type: e.target.value })}>
          {Object.entries(ACTION_TYPE_META).map(([key, m]) => (
            <option key={key} value={key}>{m.label}</option>
          ))}
        </select>
        <div className="mt-1.5 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
          <div className="flex items-start gap-1.5">
            <meta.Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{meta.desc}</span>
          </div>
        </div>
      </Field>
      {actionType === 'save_record' && (
        <Field label="Record type" hint="e.g. lead, order, feedback, registration">
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
          <Field label="Follow-up message">
            <textarea rows={3} className={inputClass} value={data.followup_message || ''} onChange={e => update({ followup_message: e.target.value })} />
          </Field>
        </>
      )}
      <Field label="Confirmation message (optional)">
        <textarea rows={2} className={inputClass} value={data.message || ''} onChange={e => update({ message: e.target.value })} />
      </Field>
      <Field label="Next step (optional)">
        <select className={inputClass} value={data.next || ''} onChange={e => update({ next: e.target.value })}>
          <option value="">-- None (end of flow) --</option>
          {allNodes.filter(n => n.id !== data.id).map(n => (
            <option key={n.id} value={n.id}>{n.data.name || n.id}</option>
          ))}
        </select>
      </Field>
    </>
  );
}
