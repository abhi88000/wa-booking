// ============================================================
// LabelsDrawer — Edit business labels (Doctor/Patient/Appointment).
// Apple-grade: live preview shows how every label looks in context.
// ============================================================
import { Ico } from './icons';

const PRESETS = [
  { label: 'Clinic',         staff: 'Doctor',  customer: 'Patient',  booking: 'Appointment' },
  { label: 'Salon / Spa',    staff: 'Stylist', customer: 'Client',   booking: 'Appointment' },
  { label: 'Fitness',        staff: 'Trainer', customer: 'Member',   booking: 'Session' },
  { label: 'Restaurant',     staff: 'Server',  customer: 'Guest',    booking: 'Reservation' },
  { label: 'Real Estate',    staff: 'Agent',   customer: 'Buyer',    booking: 'Viewing' },
  { label: 'Consulting',     staff: 'Advisor', customer: 'Client',   booking: 'Meeting' },
];

function FieldRow({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
      />
    </div>
  );
}

export default function LabelsDrawer({ open, onClose, labels, onChange }) {
  if (!open) return null;

  const staff = labels.staff || 'Doctor';
  const customer = labels.customer || 'Patient';
  const booking = labels.booking || 'Appointment';

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Ico.tag className="w-4 h-4 text-emerald-600" />
              Business labels
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Rename Doctor / Patient / Appointment to match your business</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
            <Ico.close className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Presets */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Quick presets</div>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => onChange({ staff: p.staff, customer: p.customer, booking: p.booking })}
                  className="text-left text-xs border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-lg p-2.5 transition"
                >
                  <div className="font-semibold text-slate-800">{p.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{p.staff} · {p.customer} · {p.booking}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-200" />

          {/* Custom */}
          <div className="space-y-3">
            <FieldRow
              label="Staff member"
              value={labels.staff}
              onChange={(v) => onChange({ ...labels, staff: v })}
              placeholder="Doctor"
            />
            <FieldRow
              label="Customer"
              value={labels.customer}
              onChange={(v) => onChange({ ...labels, customer: v })}
              placeholder="Patient"
            />
            <FieldRow
              label="Booking"
              value={labels.booking}
              onChange={(v) => onChange({ ...labels, booking: v })}
              placeholder="Appointment"
            />
          </div>

          {/* Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">How it looks</div>
            <ul className="text-xs text-slate-700 space-y-1.5">
              <li>Sidebar shows: <strong>{staff}s</strong>, <strong>{customer}s</strong>, <strong>{booking}s</strong></li>
              <li>Booking page title: <strong>{booking} Confirmation</strong></li>
              <li>Staff notification: <em>New {booking} booked by {customer}</em></li>
              <li>Reminder: <em>Your {booking} with {staff} is coming up</em></li>
            </ul>
          </div>

          <div className="text-[11px] text-slate-500 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 flex gap-2">
            <Ico.info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <span>Labels apply everywhere — dashboard sidebar, page titles, default bot messages, staff notifications.</span>
          </div>
        </div>
      </div>
    </>
  );
}
