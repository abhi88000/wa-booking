import { NodeShell, TargetHandle, SourceHandle } from './NodeShell';

export default function InputNode({ data, selected }) {
  return (
    <NodeShell
      icon="✏️"
      title="Ask a question"
      subtitle={data.name || data.variable || data.id}
      color="purple"
      selected={selected}
    >
      <TargetHandle />
      <div className="text-xs text-slate-600 line-clamp-2 mb-2">
        {data.message || <span className="italic text-slate-400">No question yet</span>}
      </div>
      <div className="text-[11px] inline-flex items-center gap-1 bg-purple-50 text-purple-700 rounded px-1.5 py-0.5">
        <span>📥</span>
        <span>{data.variable || 'unnamed'}</span>
        <span className="text-purple-400">·</span>
        <span className="uppercase tracking-wide">{data.input_type || 'text'}</span>
      </div>
      <SourceHandle id="next" />
    </NodeShell>
  );
}
