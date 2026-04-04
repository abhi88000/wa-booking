import { useState, useEffect } from 'react';
import api from '../api';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });


  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.getPatients({ search: search || undefined });
      setPatients(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => { e.preventDefault(); load(); };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '' });
    setShowAdd(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name || '', phone: p.phone || '', email: p.email || '' });
    setShowAdd(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updatePatient(editing.id, form);
      } else {
        await api.addPatient(form);
      }
      setShowAdd(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const viewDetail = async (p) => {
    setDetail(p);
    try {
      const { data } = await api.getPatient(p.id);
      setDetailData(data);
    } catch (err) { console.error(err); }
  };

  const STATUS_COLOR = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-200 text-gray-600',
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Patients</h1>
        <button onClick={openAdd}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          + Add Patient
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Search</button>
      </form>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Patient' : 'Add Patient'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <input placeholder="Patient name" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Phone</label>
                <input placeholder="+91..." value={form.phone}
                  onChange={e => setForm({...form, phone: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Email</label>
                <input type="email" placeholder="Optional" value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
                  {editing ? 'Save' : 'Add Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => { setDetail(null); setDetailData(null); }}>
          <div className="bg-white w-full sm:w-[420px] h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">{detail.name || 'Patient'}</h2>
              <button onClick={() => { setDetail(null); setDetailData(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Phone</span>
                  <span className="font-medium">{detail.phone}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium">{detail.email || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Appointments</span>
                  <span className="font-medium">{detail.total_appointments || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Last Visit</span>
                  <span className="font-medium">{detail.last_visit || 'Never'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Joined</span>
                  <span className="font-medium">{new Date(detail.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <button onClick={() => { setDetail(null); openEdit(detail); }}
                  className="w-full text-center text-sm text-indigo-600 border border-indigo-200 rounded-lg py-2 hover:bg-indigo-50">
                  Edit
                </button>
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mb-3">Appointment History</h3>
              {detailData?.appointments ? (
                <div className="space-y-2">
                  {detailData.appointments.map(a => (
                    <div key={a.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium">{a.doctor_name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] || 'bg-gray-100 text-gray-500'}`}>
                          {a.status?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {a.appointment_date?.substring(0, 10)} at {a.start_time?.substring(0, 5)}
                        {a.service_name ? ` - ${a.service_name}` : ''}
                      </p>
                    </div>
                  ))}
                  {detailData.appointments.length === 0 && (
                    <p className="text-sm text-gray-400">No appointments yet</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Loading...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Patient Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
          <>
            {/* Desktop */}
            <table className="w-full text-sm hidden sm:table">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Appointments</th>
                  <th className="px-4 py-3 font-medium">Last Visit</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {patients.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button onClick={() => viewDetail(p)} className="font-medium text-indigo-600 hover:underline">{p.name || '—'}</button>
                    </td>
                    <td className="px-4 py-3">{p.phone}</td>
                    <td className="px-4 py-3 text-gray-500">{p.email || '—'}</td>
                    <td className="px-4 py-3">{p.total_appointments}</td>
                    <td className="px-4 py-3 text-gray-500">{p.last_visit || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(p)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                        <button onClick={() => viewDetail(p)} className="text-xs text-gray-500 hover:underline">Details</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400">No patients found</td></tr>
                )}
              </tbody>
            </table>

            {/* Mobile */}
            <div className="sm:hidden divide-y">
              {patients.map(p => (
                <div key={p.id} className="p-4" onClick={() => viewDetail(p)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{p.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{p.phone} {p.email ? `- ${p.email}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-indigo-600">{p.total_appointments} appts</p>
                      <p className="text-xs text-gray-400">{p.last_visit || 'No visits'}</p>
                    </div>
                  </div>
                </div>
              ))}
              {patients.length === 0 && (
                <div className="p-8 text-center text-gray-400">No patients found</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
