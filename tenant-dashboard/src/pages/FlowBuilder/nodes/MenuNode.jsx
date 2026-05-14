import { Position } from '@xyflow/react';
import { NodeShell, TargetHandle, SourceHandle } from './NodeShell';

export default function MenuNode({ data, selected, id }) {
  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  const isStart = id === 'start';
  return (
    <NodeShell
      icon="💬"
      title={isStart ? 'Start • Menu' : 'Menu'}
      subtitle={data.name || id}
      color="blue"
      selected={selected}
    >
      {!isStart && <TargetHandle />}
      <div className="text-xs text-slate-600 line-clamp-3 whitespace-pre-wrap mb-2">
        {data.message || <span className="italic text-slate-400">No message yet</span>}
      </div>
      {buttons.length === 0 ? (
        <div className="text-xs italic text-slate-400">No buttons</div>
      ) : (
        <div className="space-y-1">
          {buttons.map((b, i) => (
            <div
              key={i}
              className="relative bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs flex items-center justify-between"
            >
              <span className="truncate">{b.label || b.id || 'Button'}</span>
              <span className="text-[10px] uppercase text-slate-400 ml-2">
                {b.action === 'next' ? '→' : b.action || 'next'}
              </span>
              {b.action === 'next' && (
                <SourceHandle
                  id={`btn-${i}`}
                  position={Position.Right}
                  style={{ top: '50%', right: -6 }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </NodeShell>
  );
}
