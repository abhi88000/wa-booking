import { useState, useEffect, useMemo, Fragment } from 'react';
import api from '../api';
import { useClinic } from '../ClinicContext';
import { fmtDate, fmt12 } from '../utils';

function dateBucket(val) {
  if (!val) return 'Other';
  const d = new Date(val);
  const now = new Date();
  const strip = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const today = strip(now);
  const target = strip(d);
  const diff = (target - today) / 86400000;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  // Same week (Mon-Sun)
  const dayOfWeek = today.getDay() || 7; // Mon=1
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - dayOfWeek + 1);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  if (target >= weekStart && target <= weekEnd) return 'This Week';
  // Last week
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
  if (target >= lastWeekStart && target < weekStart) return 'Last Week';
  // This month
  if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return 'This Month';
  // Last month
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear()) return 'Last Month';
  // Future (next week+)
  if (diff > 0) return 'Upcoming';
  return 'Older';
}

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [hideCancelled, setHideCancelled] = useState(true);
  const [compact, setCompact] = useState(true);
  const { clinic } = useClinic();

  const grouped = useMemo(() => {
    const map = new Map();
    for (const a of appointments) {
      const bucket = dateBucket(a.appointment_date);
      if (!map.has(bucket)) map.set(bucket, { label: bucket, items: [] });
      map.get(bucket).items.push(a);
    }
    return [...map.values()];
  }, [appointments]);

  useEffect(() => { load(); loadMeta(); }, []);
  useEffect(() => { load(); loadMeta(); }, [page, statusFilter, hideCancelled, clinic]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.getAppointments({ page, status: statusFilter || undefined, limit: 20, clinic: clinic !== 'all' ? clinic : undefined, hideCancelled: hideCancelled && !statusFilter ? true : undefined });
      setAppointments(data.appointments);
      setTotal(data.total);
    } catch (err) { /* load error silenced */ }
    finally { setLoading(false); }
  };
  const loadMeta = async () => {
    try {
      const [d, s] = await Promise.all([api.getDoctors(), api.getServices()]);
      let activeDocs = d.data.filter(doc => doc.is_active);
      if (clinic !== 'all') activeDocs = activeDocs.filter(doc => !doc.clinics?.length || doc.clinics.includes(clinic));
      setDoctors(activeDocs);
      setServices(s.data.filter(svc => svc.is_active !== false));
    } catch (err) { /* load error handled silently */ }
  };

  const updateStatus = async (id, status) => {
    if (!confirm(`Mark as ${status.replace('_', ' ')}?`)) return;
    await api.updateAppointmentStatus(id, status);
    load();
  };

  const STATUS_STYLE = {
    pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    confirmed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    completed: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
    cancelled: 'bg-red-50 text-red-600 ring-1 ring-red-200',
    no_show: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
    rescheduled: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  };

  const STATUS_DOT = {
    pending: 'bg-amber-400', confirmed: 'bg-emerald-400', completed: 'bg-sky-400',
    cancelled: 'bg-red-400', no_show: 'bg-gray-400', rescheduled: 'bg-violet-400',
  };

  const ActionButtons = ({ a }) => {
    const items = [];
    if (a.status === 'pending') {
      items.push({ label: 'Confirm', onClick: () => updateStatus(a.id, 'confirmed'), style: 'text-emerald-600 hover:bg-emerald-50' });
    }
    if (['pending', 'confirmed'].includes(a.status)) {
      items.push({ label: 'Complete', onClick: () => updateStatus(a.id, 'completed'), style: 'text-sky-600 hover:bg-sky-50' });
      items.push({ label: 'Reschedule', onClick: () => setRescheduleTarget(a), style: 'text-violet-600 hover:bg-violet-50' });
      items.push({ label: 'Cancel', onClick: () => setCancelTarget(a), style: 'text-red-500 hover:bg-red-50' });
      items.push({ label: 'No Show', onClick: () => updateStatus(a.id, 'no_show'), style: 'text-gray-500 hover:bg-gray-100' });
    }
    if (a.status === 'cancelled' || a.status === 'no_show') {
      items.push({ label: 'Restore', onClick: () => updateStatus(a.id, 'confirmed'), style: 'text-emerald-600 hover:bg-emerald-50' });
    }
    if (a.status === 'completed') {
      items.push({ label: 'Follow Up', onClick: () => setFollowUpTarget(a), style: 'text-indigo-600 hover:bg-indigo-50' });
    }
    if (items.length === 0) return null;
    const primary = items[0];
    const rest = items.slice(1);
    return (
      <div className="flex items-center gap-1">
        <button onClick={primary.onClick}
          className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${primary.style}`}>
          {primary.label}
        </button>
        {rest.length > 0 && (
          <div className="relative group">
            <button className="text-gray-400 hover:text-gray-600 px-1.5 py-1.5 rounded-md hover:bg-gray-100 text-sm leading-none">•••</button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[120px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              {rest.map(item => (
                <button key={item.label} onClick={item.onClick}
                  className={`block w-full text-left text-xs px-3 py-2 transition ${item.style}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Appointments ({total})</h1>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
          {!statusFilter && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={hideCancelled} onChange={e => { setHideCancelled(e.target.checked); setPage(1); }}
                className="rounded border-gray-300" />
              Hide cancelled
            </label>
          )}
          <button onClick={() => setShowCreate(true)}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900 whitespace-nowrap">
            + Book Appointment
          </button>
          <button onClick={() => setCompact(c => !c)} title={compact ? 'Comfortable view' : 'Compact view'}
            className="border border-gray-200 rounded-lg px-2.5 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
            {compact ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 5h16M4 10h16M4 15h16M4 20h16"/></svg>
            )}
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateAppointmentModal doctors={doctors} services={services}
          onClose={() => { setShowCreate(false); load(); }} />
      )}

      {/* Desktop Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hidden sm:block">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Patient</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Doctor / Service</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">When</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <Fragment key={group.label}>
                  <tr>
                    <td colSpan="5" className="px-5 pt-4 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">{group.label}</span>
                        <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded-full">{group.items.length}</span>
                        <div className="flex-1 h-px bg-gray-100 ml-1" />
                      </div>
                    </td>
                  </tr>
                  {group.items.map((a, i) => (
                    <tr key={a.id} className={`group hover:bg-slate-50/60 transition ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                      <td className={compact ? 'px-5 py-2' : 'px-5 py-3.5'}>
                        <p className="font-medium text-gray-900 text-[13px]">{a.patient_name || '—'}</p>
                        {!compact && <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{a.patient_phone}</p>}
                      </td>
                      <td className={compact ? 'px-5 py-2' : 'px-5 py-3.5'}>
                        <p className="text-gray-700 text-[13px]">{a.doctor_name}</p>
                        {!compact && a.service_name && <p className="text-[11px] text-gray-400 mt-0.5">{a.service_name}</p>}
                      </td>
                      <td className={compact ? 'px-5 py-2' : 'px-5 py-3.5'}>
                        <p className="text-gray-700 text-[13px]">
                          <span className="font-medium text-gray-900">{fmtDate(a.appointment_date, true)}</span>
                          <span className="text-gray-400 mx-1">·</span>
                          {fmt12(a.start_time)}
                        </p>
                      </td>
                      <td className={compact ? 'px-5 py-2' : 'px-5 py-3.5'}>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLE[a.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.status]}`} />
                          {a.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`${compact ? 'px-5 py-2' : 'px-5 py-3.5'} text-right`}>
                        <ActionButtons a={a} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-5 py-16 text-center">
                    <p className="text-gray-400 text-sm">No appointments found</p>
                    <p className="text-gray-300 text-xs mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-1">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
          </div>
        ) :
          grouped.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-2 pt-4 pb-2 px-1">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{group.label}</span>
                <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded-full">{group.items.length}</span>
                <div className="flex-1 h-px bg-gray-100 ml-1" />
              </div>
              <div className="space-y-2">
                {group.items.map(a => (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{a.patient_name || 'Patient'}</p>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{a.patient_phone}</p>
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_STYLE[a.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.status]}`} />
                        {a.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{fmt12(a.start_time)}</span>
                      <span className="text-gray-300">·</span>
                      <span>{a.doctor_name}</span>
                      {a.service_name && <><span className="text-gray-300">·</span><span>{a.service_name}</span></>}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <ActionButtons a={a} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        }
        {!loading && appointments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">No appointments found</p>
            <p className="text-gray-300 text-xs mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between mt-6 px-1">
          <p className="text-xs text-gray-400">
            {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total}
          </p>
          <div className="flex gap-1.5">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition">
              ← Prev
            </button>
            <button disabled={appointments.length < 20} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition">
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelTarget && (
        <CancelModal appointment={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={() => { setCancelTarget(null); load(); }} />
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <RescheduleModal appointment={rescheduleTarget} doctors={doctors}
          onClose={() => setRescheduleTarget(null)}
          onDone={() => { setRescheduleTarget(null); load(); }} />
      )}

      {/* Follow-Up Modal */}
      {followUpTarget && (
        <FollowUpModal appointment={followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          onDone={() => { setFollowUpTarget(null); setStatusFilter(''); setPage(1); load(); }} />
      )}
    </div>
  );
}

function CreateAppointmentModal({ doctors, services, onClose }) {
  const [form, setForm] = useState({
    doctorId: '', serviceId: '', patientPhone: '', patientName: '',
    appointmentDate: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [noSlotMsg, setNoSlotMsg] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const searchPatients = async (q) => {
    setPatientSearch(q);
    if (q.length >= 2) {
      try {
        const { data } = await api.getPatients({ search: q });
        setPatients(data.patients || data);
      } catch (err) { /* search error silenced */ }
    } else {
      setPatients([]);
    }
  };

  const selectPatient = (p) => {
    setForm({ ...form, patientPhone: p.phone, patientName: p.name, patientId: p.id });
    setPatientSearch(p.name + ' (' + p.phone + ')');
    setPatients([]);
  };

  const fetchSlots = async (dateVal) => {
    setForm(f => ({ ...f, appointmentDate: dateVal }));
    setSelectedSlot(null);
    setSlots([]);
    setNoSlotMsg('');
    if (!dateVal || !form.doctorId) return;
    setLoadingSlots(true);
    try {
      const res = await api.getDoctorSlots(form.doctorId, dateVal);
      if (res.data.slots.length === 0) {
        setNoSlotMsg(res.data.message || 'No available slots on this date');
      } else {
        setSlots(res.data.slots);
      }
    } catch (err) {
      setNoSlotMsg('Failed to load slots');
    } finally { setLoadingSlots(false); }
  };

  const handleDoctorChange = (doctorId) => {
    setForm(f => ({ ...f, doctorId }));
    setSelectedSlot(null);
    setSlots([]);
    setNoSlotMsg('');
    // Re-fetch slots if date already selected
    if (form.appointmentDate && doctorId) {
      setLoadingSlots(true);
      api.getDoctorSlots(doctorId, form.appointmentDate)
        .then(res => {
          if (res.data.slots.length === 0) setNoSlotMsg(res.data.message || 'No slots');
          else setSlots(res.data.slots);
        })
        .catch(() => setNoSlotMsg('Failed to load slots'))
        .finally(() => setLoadingSlots(false));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.doctorId || !form.appointmentDate || !selectedSlot) {
      alert('Doctor, date and time slot are required');
      return;
    }
    setSaving(true);
    try {
      await api.createAppointment({
        doctorId: form.doctorId,
        serviceId: form.serviceId || null,
        patientId: form.patientId || null,
        patientPhone: form.patientPhone,
        patientName: form.patientName,
        appointmentDate: form.appointmentDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        notes: form.notes,
        status: 'confirmed'
      });
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg my-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Book Appointment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Patient Search */}
          <div className="relative">
            <label className="text-xs text-gray-500 block mb-1">Patient</label>
            <input placeholder="Search by name or phone..." value={patientSearch}
              onChange={e => searchPatients(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
            {patients.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {patients.map(p => (
                  <div key={p.id} onClick={() => selectPatient(p)}
                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                    <span className="font-medium">{p.name}</span> <span className="text-gray-400">{p.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Or enter name</label>
              <input placeholder="Patient name" value={form.patientName}
                onChange={e => setForm({...form, patientName: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Phone</label>
              <input placeholder="+91..." value={form.patientPhone}
                onChange={e => setForm({...form, patientPhone: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Doctor *</label>
              <select value={form.doctorId} onChange={e => handleDoctorChange(e.target.value)} required
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400">
                <option value="">Select Doctor</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Service</label>
              <select value={form.serviceId} onChange={e => setForm({...form, serviceId: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400">
                <option value="">None</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date *</label>
            <input type="date" value={form.appointmentDate} min={today} required
              onChange={e => fetchSlots(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
            {!form.doctorId && form.appointmentDate && (
              <p className="text-xs text-amber-600 mt-1">Select a doctor first to see available slots</p>
            )}
          </div>

          {loadingSlots && <p className="text-sm text-gray-400">Loading slots...</p>}
          {noSlotMsg && <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">{noSlotMsg}</p>}

          {slots.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 block mb-2">Available Slots *</label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {slots.map(s => (
                  <button type="button" key={s.startTime}
                    onClick={() => setSelectedSlot(s)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all
                      ${selectedSlot?.startTime === s.startTime
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-slate-400'}`}>
                    {fmt12(s.startTime)}
                  </button>
                ))}
              </div>
              {selectedSlot && (
                <p className="text-xs text-gray-500 mt-2">
                  Selected: {fmt12(selectedSlot.startTime)} – {fmt12(selectedSlot.endTime)}
                </p>
              )}
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes</label>
            <textarea rows={2} placeholder="Optional notes..." value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
            <button type="submit" disabled={saving || !selectedSlot}
              className="bg-slate-800 text-white px-6 py-2 rounded-lg text-sm hover:bg-slate-900 disabled:opacity-50">
              {saving ? 'Booking...' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CancelModal({ appointment, onClose, onDone }) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    setSaving(true); setError('');
    try {
      await api.updateAppointmentStatus(appointment.id, 'cancelled', comment || undefined);
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Cancel Appointment</h2>
        <p className="text-sm text-gray-500 mb-4">
          {appointment.patient_name || 'Patient'} — {appointment.doctor_name} on {fmtDate(appointment.appointment_date)} at {fmt12(appointment.start_time)}
        </p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-3 text-sm">{error}</div>}
        <div className="mb-4">
          <label className="text-xs text-gray-500 block mb-1">Reason / Comments (sent to patient via WhatsApp)</label>
          <textarea rows={3} placeholder="e.g. Doctor is unavailable due to emergency..."
            value={comment} onChange={e => setComment(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Back</button>
          <button onClick={handleCancel} disabled={saving}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Cancelling...' : 'Cancel Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({ appointment, doctors, onClose, onDone }) {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [noSlotMsg, setNoSlotMsg] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const fetchSlots = async (dateVal) => {
    setDate(dateVal);
    setSelectedSlot(null);
    setSlots([]);
    setNoSlotMsg('');
    if (!dateVal) return;
    setLoadingSlots(true);
    try {
      const res = await api.getDoctorSlots(appointment.doctor_id, dateVal);
      const data = res.data;
      if (data.slots.length === 0) {
        setNoSlotMsg(data.message || 'No available slots on this date');
      } else {
        setSlots(data.slots);
      }
    } catch (err) {
      setNoSlotMsg('Failed to load slots');
    } finally { setLoadingSlots(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !selectedSlot) { setError('Pick a date and time slot'); return; }
    setSaving(true); setError('');
    try {
      await api.rescheduleAppointment(appointment.id, {
        appointmentDate: date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        comment: comment || undefined
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reschedule');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Reschedule Appointment</h2>
        <p className="text-sm text-gray-500 mb-4">
          {appointment.patient_name || 'Patient'} — {appointment.doctor_name}
          <span className="text-gray-400"> (currently {fmtDate(appointment.appointment_date)} at {fmt12(appointment.start_time)})</span>
        </p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-3 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">New Date</label>
            <input type="date" value={date} min={today} required
              onChange={e => fetchSlots(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>

          {loadingSlots && <p className="text-sm text-gray-400">Loading slots...</p>}

          {noSlotMsg && <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">{noSlotMsg}</p>}

          {slots.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 block mb-2">Available Slots</label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {slots.map(s => (
                  <button type="button" key={s.startTime}
                    onClick={() => setSelectedSlot(s)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all
                      ${selectedSlot?.startTime === s.startTime
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-slate-400'}`}>
                    {fmt12(s.startTime)}
                  </button>
                ))}
              </div>
              {selectedSlot && (
                <p className="text-xs text-gray-500 mt-2">
                  Selected: {fmt12(selectedSlot.startTime)} – {fmt12(selectedSlot.endTime)}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Note to patient (sent via WhatsApp)</label>
            <textarea rows={2} placeholder="e.g. Doctor's schedule changed..."
              value={comment} onChange={e => setComment(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Back</button>
            <button type="submit" disabled={saving || !selectedSlot}
              className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900 disabled:opacity-50">
              {saving ? 'Rescheduling...' : 'Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FollowUpModal({ appointment, onClose, onDone }) {
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [noSlotMsg, setNoSlotMsg] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const fetchSlots = async (dateVal) => {
    setDate(dateVal);
    setSelectedSlot(null);
    setSlots([]);
    setNoSlotMsg('');
    if (!dateVal) return;
    setLoadingSlots(true);
    try {
      const res = await api.getDoctorSlots(appointment.doctor_id, dateVal);
      const data = res.data;
      if (data.slots.length === 0) {
        setNoSlotMsg(data.message || 'No available slots on this date');
      } else {
        setSlots(data.slots);
      }
    } catch (err) {
      setNoSlotMsg('Failed to load slots');
    } finally { setLoadingSlots(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !selectedSlot) { setError('Pick a date and time slot'); return; }
    setSaving(true); setError('');
    try {
      await api.createFollowUp(appointment.id, {
        appointmentDate: date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        notes: notes || undefined
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule follow-up');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Schedule Follow-Up</h2>
        <p className="text-sm text-gray-500 mb-4">
          {appointment.patient_name || 'Patient'} — {appointment.doctor_name}
          <span className="text-gray-400"> (completed {fmtDate(appointment.appointment_date)})</span>
        </p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-3 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Follow-Up Date</label>
            <input type="date" value={date} min={today} required
              onChange={e => fetchSlots(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>

          {loadingSlots && <p className="text-sm text-gray-400">Loading slots...</p>}

          {noSlotMsg && <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">{noSlotMsg}</p>}

          {slots.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 block mb-2">Available Slots</label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {slots.map(s => (
                  <button type="button" key={s.startTime}
                    onClick={() => setSelectedSlot(s)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all
                      ${selectedSlot?.startTime === s.startTime
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-slate-400'}`}>
                    {fmt12(s.startTime)}
                  </button>
                ))}
              </div>
              {selectedSlot && (
                <p className="text-xs text-gray-500 mt-2">
                  Selected: {fmt12(selectedSlot.startTime)} – {fmt12(selectedSlot.endTime)}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes (optional)</label>
            <textarea rows={2} placeholder="e.g. Check healing progress..."
              value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Back</button>
            <button type="submit" disabled={saving || !selectedSlot}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Scheduling...' : 'Schedule Follow-Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
