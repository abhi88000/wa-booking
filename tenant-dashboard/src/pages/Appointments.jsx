import { useState, useEffect } from 'react';
import api from '../api';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [page, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.getAppointments({ page, status: statusFilter || undefined });
      setAppointments(data.appointments);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id, status) => {
    if (!confirm(`Mark as ${status}?`)) return;
    await api.updateAppointmentStatus(id, status);
    load();
  };

  const STATUS_COLOR = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-100 text-gray-500',
    rescheduled: 'bg-purple-100 text-purple-700',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Appointments ({total})</h1>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
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
                  <td className="px-4 py-3">{a.appointment_date}</td>
                  <td className="px-4 py-3">{a.start_time}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[a.status]}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
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
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
