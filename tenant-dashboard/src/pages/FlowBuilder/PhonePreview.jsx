// ============================================================
// PhonePreview — WhatsApp-style preview of the selected step.
// Shows how the message and buttons appear on a real phone.
// ============================================================
import { Ico } from './icons';

function formatText(text) {
  // *bold* and _italic_ for WhatsApp markdown
  const parts = [];
  let key = 0;
  let last = 0;
  const re = /(\*[^*\n]+\*|_[^_\n]+_)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('*')) parts.push(<strong key={key++}>{tok.slice(1, -1)}</strong>);
    else parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MessageBubble({ children }) {
  return (
    <div className="flex justify-start mb-1.5">
      <div className="bg-white rounded-lg rounded-tl-sm shadow-sm px-3 py-2 max-w-[85%] text-[13px] text-slate-900 whitespace-pre-wrap leading-relaxed">
        {children}
        <div className="text-[10px] text-slate-500 mt-1 text-right">10:24 AM</div>
      </div>
    </div>
  );
}

function CustomerBubble({ children }) {
  return (
    <div className="flex justify-end mb-1.5">
      <div className="bg-[#dcf8c6] rounded-lg rounded-tr-sm shadow-sm px-3 py-2 max-w-[85%] text-[13px] text-slate-900">
        {children}
        <div className="text-[10px] text-slate-500 mt-1 text-right">10:25 AM ✓✓</div>
      </div>
    </div>
  );
}

function renderStep(node) {
  if (!node) return null;
  const data = node.data || {};
  const type = data.type;

  if (type === 'menu') {
    const buttons = Array.isArray(data.buttons) ? data.buttons : [];
    const useList = buttons.length > 3;
    return (
      <>
        <MessageBubble>{formatText(data.message || '(no message)')}</MessageBubble>
        {buttons.length > 0 && (
          <div className="flex justify-start">
            <div className="w-[85%] space-y-1">
              {useList ? (
                <button className="w-full bg-white rounded-lg shadow-sm text-[13px] text-emerald-600 font-medium py-2 border border-slate-100 flex items-center justify-center gap-1.5">
                  <Ico.layout className="w-3.5 h-3.5" /> See {buttons.length} options
                </button>
              ) : (
                buttons.slice(0, 3).map((b, i) => (
                  <button key={i} className="w-full bg-white rounded-lg shadow-sm text-[13px] text-emerald-600 font-medium py-2 border border-slate-100">
                    {b.label || '(button)'}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  if (type === 'input') {
    return (
      <>
        <MessageBubble>{formatText(data.message || '(question)')}</MessageBubble>
        <CustomerBubble><em className="text-slate-500">{data.input_type === 'rating' ? '5' : data.input_type === 'yes_no' ? 'Yes' : 'Sample answer'}</em></CustomerBubble>
      </>
    );
  }

  if (type === 'condition') {
    return (
      <div className="text-center text-[11px] text-slate-500 italic py-4">
        Bot checks: if <strong className="font-mono">{data.variable || '?'}</strong> matches a rule, jump to next step.
        <div className="mt-1 text-slate-400">No message is sent at this step.</div>
      </div>
    );
  }

  if (type === 'action') {
    return (
      <div className="text-center text-[11px] text-slate-500 italic py-4">
        <Ico.bolt className="w-4 h-4 inline mr-1 text-emerald-500" />
        Background: {data.action_type || 'action'} runs silently.
        <div className="mt-1 text-slate-400">Customer sees nothing at this step.</div>
      </div>
    );
  }

  return null;
}

export default function PhonePreview({ node, businessName = 'Your Business' }) {
  return (
    <div className="h-full flex flex-col bg-slate-100 p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
        <Ico.phone className="w-3.5 h-3.5" /> Preview
      </div>
      <div className="flex-1 flex items-start justify-center overflow-hidden">
        <div className="w-full max-w-[280px] bg-black rounded-[2rem] p-2 shadow-xl">
          <div className="bg-[#e5ddd5] rounded-[1.5rem] overflow-hidden flex flex-col" style={{ height: '500px', backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)', backgroundSize: '16px 16px' }}>
            {/* Header */}
            <div className="bg-[#075e54] text-white px-3 py-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-300 flex items-center justify-center text-emerald-900 text-xs font-bold">
                {(businessName[0] || 'B').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold truncate">{businessName}</div>
                <div className="text-[10px] opacity-80">online</div>
              </div>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3">
              {node ? (
                renderStep(node)
              ) : (
                <div className="text-center text-[12px] text-slate-500 mt-12 px-4">
                  <Ico.pointer className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  Click a step on the canvas to preview it here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
