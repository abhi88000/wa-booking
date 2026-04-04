import { useState, useEffect } from 'react';
import api from '../api';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);

  useEffect(() => { load(); loadMeta(); }, []);
  useEffect(() => { load(); }, [page, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.getAppointments({ page, status: statusFilter || undefined, limit: 20 });
      setAppointments(data.appointments);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadMeta = async () => {
    try {
      const [d, s] = await Promise.all([api.getDoctors(), api.getServices()]);
      setDoctors(d.data.filter(doc => doc.is_active));
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Appointments ({total})</h1>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
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
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden hidden sm:block">
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
                          <button onClick={() => updateStatus(a.id, 'no_show')}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                            No Show
                          </button>
                          <button onClick={() => updateStatus(a.id, 'cancelled')}
                            className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
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
            <div key={a.id} className="bg-white rounded-xl shadow-sm border p-4">
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
                <div className="flex gap-2 mt-3 flex-wrap">
                  {a.status === 'pending' && (
                    <button onClick={() => updateStatus(a.id, 'confirmed')}
                      className="text-xs px-3 py-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100">Confirm</button>
                  )}
                  <button onClick={() => updateStatus(a.id, 'completed')}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">Complete</button>
                  <button onClick={() => updateStatus(a.id, 'no_show')}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">No Show</button>
                  <button onClick={() => updateStatus(a.id, 'cancelled')}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100">Cancel</button>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 overflow-y-auto py-8">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg my-auto">
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
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
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
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Phone</label>
              <input placeholder="+91..." value={form.patientPhone}
                onChange={e => setForm({...form, patientPhone: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Doctor *</label>
              <select value={form.doctorId} onChange={e => setForm({...form, doctorId: e.target.value})} required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">Select Doctor</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Service</label>
              <select value={form.serviceId} onChange={e => setForm({...form, serviceId: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400">
                <option value="">None</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date *</label>
            <input type="date" value={form.appointmentDate} required
              onChange={e => setForm({...form, appointmentDate: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Time *</label>
              <input type="time" value={form.startTime} required
                onChange={e => handleDurationCalc(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End Time</label>
              <input type="time" value={form.endTime}
                onChange={e => setForm({...form, endTime: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes</label>
            <textarea rows={2} placeholder="Optional notes..." value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
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
