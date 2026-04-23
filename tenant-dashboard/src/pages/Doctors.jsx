import { useState, useEffect } from 'react';
import api from '../api';
import { useClinic } from '../ClinicContext';
import AvailabilityEditor from './AvailabilityEditor';

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editingAvail, setEditingAvail] = useState(null);
  const [filter, setFilter] = useState('active');
  const [form, setForm] = useState({ name: '', specialization: '', phone: '', email: '', consultationFee: 0, slotDuration: 20, clinics: [] });
  const [clinics, setClinics] = useState([]);
  const { clinic: selectedClinic } = useClinic();

  useEffect(() => { load(); loadClinics(); }, []);

  const load = async () => {
    try {
      const { data } = await api.getDoctors();
      setDoctors(data);
    } catch (err) { /* silenced */ }
    finally { setLoading(false); }
  };

  const loadClinics = async () => {
    try {
      const { data } = await api.getSettings();
      setClinics(data?.settings?.branches || []);
    } catch (err) { /* silenced */ }
  };

  const openAdd = () => {
    setEditingDoc(null);
    setForm({ name: '', specialization: '', phone: '', email: '', consultationFee: 0, slotDuration: 20, clinics: [] });
    setShowAdd(true);
  };

  const openEdit = (doc) => {
    setEditingDoc(doc);
    setForm({
      name: doc.name, specialization: doc.specialization || '',
      phone: doc.phone || '', email: doc.email || '',
      consultationFee: Number(doc.consultation_fee) || 0,
      slotDuration: doc.slot_duration || 20,
      clinics: doc.clinics || []
    });
    setShowAdd(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDoc) {
        await api.updateDoctor(editingDoc.id, form);
      } else {
        await api.addDoctor(form);
      }
      setShowAdd(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Remove "${doc.name}"? This will cancel all their future appointments.`)) return;
    try {
      await api.deleteDoctor(doc.id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const toggleActive = async (doc) => {
    await api.updateDoctor(doc.id, { isActive: !doc.is_active });
    load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Doctors</h1>
        <div className="flex flex-wrap gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <button onClick={openAdd}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900">
            + Add Doctor
          </button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingDoc ? 'Edit Doctor' : 'Add Doctor'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" required />
              <input placeholder="Specialization" value={form.specialization} onChange={e => setForm({...form, specialization: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
              {clinics.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Assign to Clinics</label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {clinics.map((c, i) => {
                      const label = c.address ? `${c.name} — ${c.address}` : c.name;
                      const checked = form.clinics.includes(label);
                      return (
                        <label key={i} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                          <input type="checkbox" checked={checked}
                            onChange={() => setForm({...form, clinics: checked ? form.clinics.filter(cl => cl !== label) : [...form.clinics, label]})}
                            className="rounded border-gray-300 text-slate-800 focus:ring-slate-500" />
                          <span className="text-sm text-gray-700">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
                <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Fee</label>
                  <input type="number" value={form.consultationFee} onChange={e => setForm({...form, consultationFee: parseInt(e.target.value)})}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Slot Duration (min)</label>
                  <input type="number" value={form.slotDuration} onChange={e => setForm({...form, slotDuration: parseInt(e.target.value)})}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">
                  {editingDoc ? 'Save Changes' : 'Add Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Availability Editor Modal */}
      {editingAvail && (
        <AvailabilityEditor doctorId={editingAvail.id} doctorName={editingAvail.name}
          doctorClinics={editingAvail.clinics || []}
          onClose={() => { setEditingAvail(null); load(); }} />
      )}

      {/* Doctor Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="text-gray-500 col-span-3 text-center py-10">Loading...</div> :
          doctors
            .filter(doc => filter === 'all' ? true : filter === 'active' ? doc.is_active : !doc.is_active)
            .filter(doc => selectedClinic === 'all' ? true : !doc.clinics?.length || doc.clinics.includes(selectedClinic))
            .length === 0 ? (
            <div className="text-gray-400 col-span-3 text-center py-10 text-sm">No {filter} doctors found</div>
          ) :
          doctors
            .filter(doc => filter === 'all' ? true : filter === 'active' ? doc.is_active : !doc.is_active)
            .filter(doc => selectedClinic === 'all' ? true : !doc.clinics?.length || doc.clinics.includes(selectedClinic))
            .map(doc => (
            <div key={doc.id} className={`bg-white rounded-lg shadow-sm p-5 border ${!doc.is_active ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                  <p className="text-sm text-gray-500">{doc.specialization || 'General'}</p>
                  {doc.clinics?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {doc.clinics.map((cl, i) => (
                        <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">{cl}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => toggleActive(doc)}
                  className={`text-xs px-2 py-1 rounded ${doc.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {doc.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-500">
                {doc.consultation_fee > 0 && <p>Fee: ₹{doc.consultation_fee}</p>}
                <p>Slot: {doc.slot_duration} min</p>
                {doc.phone && <p>{doc.phone}</p>}
              </div>
              {doc.availability && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1">Schedule:</p>
                  <div className="flex flex-wrap gap-1">
                    {doc.availability.filter(Boolean).map((a, i) => (
                      <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded capitalize">
                        {a.day?.substring(0, 3)} {a.start_time?.substring(0,5)}-{a.end_time?.substring(0,5)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setEditingAvail(doc)}
                className="mt-4 w-full text-center text-sm text-slate-700 border border-slate-300 rounded-lg py-2 hover:bg-slate-100">
                Manage Schedule
              </button>
              <div className="flex gap-2 mt-2">
                <button onClick={() => openEdit(doc)}
                  className="flex-1 text-center text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">
                  Edit
                </button>
                <button onClick={() => handleDelete(doc)}
                  className="flex-1 text-center text-xs text-red-500 border border-red-200 rounded-lg py-1.5 hover:bg-red-50">
                  Remove
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

