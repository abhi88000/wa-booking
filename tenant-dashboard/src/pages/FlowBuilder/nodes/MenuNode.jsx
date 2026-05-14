import { Position } from '@xyflow/react';
import { NodeShell, TargetHandle, SourceHandle } from './NodeShell';
import { Ico } from '../icons';
import { BUTTON_ACTION_META, COLOR_CLASSES } from '../actionMeta';

export default function MenuNode({ data, selected, id }) {
  const buttons = Array.isArray(data.buttons) ? data.buttons : [];
  const isStart = id === 'start';
  return (
    <NodeShell
      Icon={Ico.message}
      title={isStart ? 'Start \u2022 Menu' : 'Menu'}
      subtitle={data.name || id}
      color="blue"
      selected={selected}
    >
      {!isStart && <TargetHandle />}
      <div className="text-xs text-slate-600 line-clamp-3 whitespace-pre-wrap mb-2">
        {data.message || <span className="italic text-slate-400">No message yet</span>}
      </div>
      {buttons.length === 0 ? (
        <div className="text-xs italic text-slate-400 border border-dashed border-slate-200 rounded px-2 py-1 text-center">No buttons</div>
      ) : (
        <div className="space-y-1">
          {buttons.map((b, i) => {
            const meta = BUTTON_ACTION_META[b.action] || BUTTON_ACTION_META.next;
            const badgeColor = COLOR_CLASSES[meta.color] || COLOR_CLASSES.slate;
            const BadgeIcon = meta.Icon;
            return (
              <div
                key={i}
                className="relative bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                title={meta.desc}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-800">{b.label || b.id || 'Button'}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${badgeColor}`}>
                    {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
                    <span>{meta.label}</span>
                  </span>
                </div>
                {b.action === 'next' && (
                  <SourceHandle
                    id={`btn-${i}`}
                    position={Position.Right}
                    style={{ top: '50%', right: -6 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </NodeShell>
  );
}
