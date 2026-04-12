import { useState, useEffect } from 'react';
import api from '../api';
import { useClinic } from '../ClinicContext';

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
  const { clinic } = useClinic();

  useEffect(() => { load(); loadMeta(); }, []);
  useEffect(() => { load(); loadMeta(); }, [page, statusFilter, clinic]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.getAppointments({ page, status: statusFilter || undefined, limit: 20, clinic: clinic !== 'all' ? clinic : undefined });
      setAppointments(data.appointments);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadMeta = async () => {
    try {
      const [d, s] = await Promise.all([api.getDoctors(), api.getServices()]);
      let activeDocs = d.data.filter(doc => doc.is_active);
      if (clinic !== 'all') activeDocs = activeDocs.filter(doc => !doc.clinic || doc.clinic === clinic);
      setDoctors(activeDocs);
      setServices(s.data.filter(svc => svc.is_active !== false));
    } catch (err) { console.error(err); }
  };

  const updateStatus = async (id, status) => {
    if (!confirm(`Mark as ${status.replace('_', ' ')}?`)) return;
    await api.updateAppointmentStatus(id, status);
    load();
  };

  const STATUS_COLOR = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-200 text-gray-600',
    rescheduled: 'bg-purple-100 text-purple-700',
  };

  const ActionButtons = ({ a }) => (
    <div className="flex gap-1 flex-wrap">
      {a.status === 'pending' && (
        <button onClick={() => updateStatus(a.id, 'confirmed')}
          className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100">
          Confirm
        </button>
      )}
      {['pending', 'confirmed'].includes(a.status) && (
        <>
          <button onClick={() => updateStatus(a.id, 'completed')}
            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
            Complete
          </button>
          <button onClick={() => setRescheduleTarget(a)}
            className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100">
            Reschedule
          </button>
          <button onClick={() => setCancelTarget(a)}
            className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">
            Cancel
          </button>
          <button onClick={() => updateStatus(a.id, 'no_show')}
            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
            No Show
          </button>
        </>
      )}
    </div>
  );

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
          <button onClick={() => setShowCreate(true)}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900 whitespace-nowrap">
            + Book Appointment
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateAppointmentModal doctors={doctors} services={services}
          onClose={() => { setShowCreate(false); load(); }} />
      )}

      {/* Desktop Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden hidden sm:block">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {appointments.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.patient_name || '—'}</div>
                    <div className="text-xs text-gray-400">{a.patient_phone}</div>
                  </td>
                  <td className="px-4 py-3">{a.doctor_name}</td>
                  <td className="px-4 py-3">{a.service_name || '—'}</td>
                  <td className="px-4 py-3">{a.appointment_date?.substring(0, 10)}</td>
                  <td className="px-4 py-3">{a.start_time?.substring(0, 5)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[a.status]}`}>
                      {a.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionButtons a={a} />
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-400">No appointments found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> :
          appointments.map(a => (
            <div key={a.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">{a.patient_name || 'Patient'}</p>
                  <p className="text-xs text-gray-400">{a.patient_phone}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status]}`}>
                  {a.status?.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-500 space-y-0.5">
                <p>{a.doctor_name} {a.service_name ? `- ${a.service_name}` : ''}</p>
                <p>{a.appointment_date?.substring(0, 10)} at {a.start_time?.substring(0, 5)}</p>
              </div>
              {['pending', 'confirmed'].includes(a.status) && (
                <div className="mt-3">
                  <ActionButtons a={a} />
                </div>
              )}
            </div>
          ))
        }
        {!loading && appointments.length === 0 && (
          <div className="text-center text-gray-400 py-8">No appointments found</div>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-50">Previous</button>
          <span className="px-4 py-2 text-sm text-gray-500">Page {page}</span>
          <button disabled={appointments.length < 20} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-50">Next</button>
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
    </div>
  );
}

function CreateAppointmentModal({ doctors, services, onClose }) {
  const [form, setForm] = useState({
    doctorId: '', serviceId: '', patientPhone: '', patientName: '',
    appointmentDate: '', startTime: '', endTime: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');

  const searchPatients = async (q) => {
    setPatientSearch(q);
    if (q.length >= 2) {
      try {
        const { data } = await api.getPatients({ search: q });
        setPatients(data);
      } catch (err) { console.error(err); }
    } else {
      setPatients([]);
    }
  };

  const selectPatient = (p) => {
    setForm({ ...form, patientPhone: p.phone, patientName: p.name, patientId: p.id });
    setPatientSearch(p.name + ' (' + p.phone + ')');
    setPatients([]);
  };

  const handleDurationCalc = (startTime) => {
    if (!startTime || !form.doctorId) return;
    const doc = doctors.find(d => d.id === parseInt(form.doctorId));
    const dur = doc?.slot_duration || 20;
    const [h, m] = startTime.split(':').map(Number);
    const totalMin = h * 60 + m + dur;
    const endH = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const endM = String(totalMin % 60).padStart(2, '0');
    setForm(f => ({ ...f, startTime, endTime: `${endH}:${endM}` }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.doctorId || !form.appointmentDate || !form.startTime) {
      alert('Doctor, date and start time are required');
      return;
    }
    setSaving(true);
    try {
      await api.createAppointment({
        doctorId: parseInt(form.doctorId),
        serviceId: form.serviceId ? parseInt(form.serviceId) : null,
        patientId: form.patientId || null,
        patientPhone: form.patientPhone,
        patientName: form.patientName,
        appointmentDate: form.appointmentDate,
        startTime: form.startTime,
        endTime: form.endTime,
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
              <select value={form.doctorId} onChange={e => setForm({...form, doctorId: e.target.value})} required
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
            <input type="date" value={form.appointmentDate} required
              onChange={e => setForm({...form, appointmentDate: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Time *</label>
              <input type="time" value={form.startTime} required
                onChange={e => handleDurationCalc(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End Time</label>
              <input type="time" value={form.endTime}
                onChange={e => setForm({...form, endTime: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes</label>
            <textarea rows={2} placeholder="Optional notes..." value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
            <button type="submit" disabled={saving}
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
          {appointment.patient_name || 'Patient'} — {appointment.doctor_name} on {appointment.appointment_date?.substring(0, 10)} at {appointment.start_time?.substring(0, 5)}
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
  const [form, setForm] = useState({
    appointmentDate: '',
    startTime: '',
    endTime: '',
    comment: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleDurationCalc = (startTime) => {
    if (!startTime) return;
    const doc = doctors.find(d => d.id === appointment.doctor_id);
    const dur = doc?.slot_duration || 20;
    const [h, m] = startTime.split(':').map(Number);
    const totalMin = h * 60 + m + dur;
    const endH = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const endM = String(totalMin % 60).padStart(2, '0');
    setForm(f => ({ ...f, startTime, endTime: `${endH}:${endM}` }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.appointmentDate || !form.startTime || !form.endTime) {
      setError('Date and time are required');
      return;
    }
    setSaving(true); setError('');
    try {
      await api.rescheduleAppointment(appointment.id, {
        appointmentDate: form.appointmentDate,
        startTime: form.startTime,
        endTime: form.endTime,
        comment: form.comment || undefined
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reschedule');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Reschedule Appointment</h2>
        <p className="text-sm text-gray-500 mb-4">
          {appointment.patient_name || 'Patient'} — {appointment.doctor_name} 
          <span className="text-gray-400"> (currently {appointment.appointment_date?.substring(0, 10)} at {appointment.start_time?.substring(0, 5)})</span>
        </p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-3 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">New Date</label>
            <input type="date" value={form.appointmentDate} required
              onChange={e => setForm({...form, appointmentDate: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Time</label>
              <input type="time" value={form.startTime} required
                onChange={e => handleDurationCalc(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End Time</label>
              <input type="time" value={form.endTime}
                onChange={e => setForm({...form, endTime: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Note to patient (sent via WhatsApp)</label>
            <textarea rows={2} placeholder="e.g. Doctor's schedule changed..."
              value={form.comment} onChange={e => setForm({...form, comment: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Back</button>
            <button type="submit" disabled={saving}
              className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900 disabled:opacity-50">
              {saving ? 'Rescheduling...' : 'Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
