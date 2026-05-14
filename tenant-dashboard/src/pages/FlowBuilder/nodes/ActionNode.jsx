import { NodeShell, TargetHandle, SourceHandle } from './NodeShell';
import { Ico } from '../icons';
import { ACTION_TYPE_META } from '../actionMeta';

export default function ActionNode({ data, selected }) {
  const actionType = data.action_type || 'save_record';
  const meta = ACTION_TYPE_META[actionType] || ACTION_TYPE_META.save_record;
  const MetaIcon = meta.Icon;
  return (
    <NodeShell
      Icon={Ico.bolt}
      title="Action"
      subtitle={data.name || data.id}
      color="emerald"
      selected={selected}
    >
      <TargetHandle />
      <div
        className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1"
        title={meta.desc}
      >
        {MetaIcon && <MetaIcon className="w-3.5 h-3.5" />}
        <span className="font-medium">{meta.label}</span>
      </div>
      {data.message && (
        <div className="mt-2 text-xs text-slate-500 line-clamp-2">{data.message}</div>
      )}
      <SourceHandle id="next" />
    </NodeShell>
  );
}
