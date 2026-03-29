import React, { useEffect, useState } from 'react';
import { Plus, Edit2, X } from 'lucide-react';
import { doctors } from '../api';

export default function Doctors() {
  const [doctorList, setDoctorList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', specialization: '', phone: '', email: '',
    consultation_fee: '', slot_duration: '30',
  });

  useEffect(() => { loadDoctors(); }, []);

  async function loadDoctors() {
    try {
      const data = await doctors.list();
      setDoctorList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openForm(doctor = null) {
    if (doctor) {
      setEditing(doctor.id);
      setForm({
        name: doctor.name, specialization: doctor.specialization || '',
        phone: doctor.phone || '', email: doctor.email || '',
        consultation_fee: doctor.consultation_fee || '', slot_duration: doctor.slot_duration || '30',
      });
    } else {
      setEditing(null);
      setForm({ name: '', specialization: '', phone: '', email: '', consultation_fee: '', slot_duration: '30' });
    }
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await doctors.update(editing, { ...form, is_active: true });
      } else {
        await doctors.create(form);
      }
      setShowForm(false);
      loadDoctors();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Doctors</h2>
          <p className="text-gray-500 mt-1">{doctorList.length} active doctors</p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Doctor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
          </div>
        ) : (
          doctorList.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{doc.specialization}</p>
                </div>
                <button onClick={() => openForm(doc)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <Edit2 className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fee</span>
                  <span className="font-medium">₹{doc.consultation_fee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Slot Duration</span>
                  <span className="font-medium">{doc.slot_duration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Today</span>
                  <span className="font-medium text-green-600">{doc.today_appointments || 0} appointments</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Doctor Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Doctor' : 'Add Doctor'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                <input type="text" value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fee (₹)</label>
                  <input type="number" value={form.consultation_fee}
                    onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slot (min)</label>
                  <input type="number" value={form.slot_duration}
                    onChange={(e) => setForm({ ...form, slot_duration: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>
              <button type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium text-sm">
                {editing ? 'Update Doctor' : 'Add Doctor'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
