import { Position } from '@xyflow/react';
import { NodeShell, TargetHandle, SourceHandle } from './NodeShell';

export default function ConditionNode({ data, selected }) {
  const rules = Array.isArray(data.rules) ? data.rules : [];
  return (
    <NodeShell
      icon="🔀"
      title="If / Else"
      subtitle={data.variable ? `check: ${data.variable}` : (data.name || data.id)}
      color="amber"
      selected={selected}
    >
      <TargetHandle />
      {rules.length === 0 && !data.else_next && (
        <div className="text-xs italic text-slate-400">No rules yet</div>
      )}
      <div className="space-y-1">
        {rules.map((r, i) => (
          <div key={i} className="relative bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs">
            <span className="font-medium">{r.operator || 'equals'}</span>{' '}
            <span className="font-mono text-amber-700">{String(r.value ?? '')}</span>
            <SourceHandle id={`rule-${i}`} position={Position.Right} style={{ top: '50%', right: -6 }} />
          </div>
        ))}
        <div className="relative bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-500">
          else (any other value)
          <SourceHandle id="else" position={Position.Right} style={{ top: '50%', right: -6 }} />
        </div>
      </div>
    </NodeShell>
  );
}
