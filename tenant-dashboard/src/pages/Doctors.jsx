import { useState, useEffect } from 'react';
import api from '../api';

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', specialization: '', phone: '', email: '', consultationFee: 0, slotDuration: 30 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.getDoctors();
      setDoctors(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.addDoctor(form);
      setShowAdd(false);
      setForm({ name: '', specialization: '', phone: '', email: '', consultationFee: 0, slotDuration: 30 });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add doctor');
    }
  };

  const toggleActive = async (doc) => {
    await api.updateDoctor(doc.id, { isActive: !doc.is_active });
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
        <button onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          + Add Doctor
        </button>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add Doctor</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 text-sm" required />
              <input placeholder="Specialization" value={form.specialization} onChange={e => setForm({...form, specialization: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  className="border rounded-lg px-4 py-2 text-sm" />
                <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="border rounded-lg px-4 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Fee (₹)</label>
                  <input type="number" value={form.consultationFee} onChange={e => setForm({...form, consultationFee: parseInt(e.target.value)})}
                    className="w-full border rounded-lg px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Slot Duration (min)</label>
                  <input type="number" value={form.slotDuration} onChange={e => setForm({...form, slotDuration: parseInt(e.target.value)})}
                    className="w-full border rounded-lg px-4 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Add Doctor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="text-gray-500 col-span-3 text-center py-10">Loading...</div> :
          doctors.map(doc => (
            <div key={doc.id} className={`bg-white rounded-xl shadow-sm p-5 border ${!doc.is_active ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                  <p className="text-sm text-gray-500">{doc.specialization || 'General'}</p>
                </div>
                <button onClick={() => toggleActive(doc)}
                  className={`text-xs px-2 py-1 rounded ${doc.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {doc.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-500">
                {doc.consultation_fee > 0 && <p>Fee: ₹{doc.consultation_fee}</p>}
                <p>Slot: {doc.slot_duration} min</p>
                {doc.phone && <p>📱 {doc.phone}</p>}
              </div>
              {doc.availability && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1">Availability:</p>
                  <div className="flex flex-wrap gap-1">
                    {doc.availability.filter(Boolean).map((a, i) => (
                      <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded capitalize">
                        {a.day?.substring(0, 3)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
