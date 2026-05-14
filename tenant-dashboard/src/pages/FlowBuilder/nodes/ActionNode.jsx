import { NodeShell, TargetHandle, SourceHandle } from './NodeShell';

const ACTION_LABEL = {
  save_record: '💾 Save to dashboard',
  notify_admin: '🔔 Notify admin',
  set_variable: '🏷️ Set variable',
  send_followup: '⏰ Schedule follow-up'
};

export default function ActionNode({ data, selected }) {
  const actionType = data.action_type || 'save_record';
  return (
    <NodeShell
      icon="⚙️"
      title="Action"
      subtitle={data.name || data.id}
      color="emerald"
      selected={selected}
    >
      <TargetHandle />
      <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 inline-block">
        {ACTION_LABEL[actionType] || actionType}
      </div>
      {data.message && (
        <div className="mt-2 text-xs text-slate-500 line-clamp-2">{data.message}</div>
      )}
      <SourceHandle id="next" />
    </NodeShell>
  );
}
