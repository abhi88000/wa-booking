import { Handle, Position } from '@xyflow/react';

const COLOR_MAP = {
  blue:    { head: 'bg-blue-50 border-blue-200',       ring: 'border-blue-200',    iconBg: 'bg-blue-100 text-blue-700' },
  purple:  { head: 'bg-purple-50 border-purple-200',   ring: 'border-purple-200',  iconBg: 'bg-purple-100 text-purple-700' },
  amber:   { head: 'bg-amber-50 border-amber-200',     ring: 'border-amber-200',   iconBg: 'bg-amber-100 text-amber-700' },
  emerald: { head: 'bg-emerald-50 border-emerald-200', ring: 'border-emerald-200', iconBg: 'bg-emerald-100 text-emerald-700' }
};

export function NodeShell({ Icon, title, subtitle, color, selected, children }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div
      className={`rounded-xl border-2 bg-white shadow-md min-w-[260px] max-w-[320px] overflow-hidden transition-all ${
        selected ? 'ring-2 ring-offset-2 ring-emerald-500 border-emerald-500' : c.ring
      }`}
    >
      <div className={`px-3 py-2 flex items-center gap-2.5 border-b ${c.head}`}>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${c.iconBg}`}>
          {Icon ? <Icon className="w-4 h-4" /> : null}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{title}</div>
          {subtitle && <div className="text-sm font-medium text-slate-800 truncate">{subtitle}</div>}
        </div>
      </div>
      <div className="px-3 py-2 text-sm text-slate-700">{children}</div>
    </div>
  );
}

export function TargetHandle() {
  return <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white" />;
}

export function SourceHandle({ id, position = Position.Bottom, style }) {
  return (
    <Handle
      type="source"
      position={position}
      id={id}
      className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      style={style}
    />
  );
}
