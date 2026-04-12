import { useState, useEffect } from 'react';
import api from '../api';

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', price: 0 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.getServices();
      setServices(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: 0 });
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '', price: Number(s.price) });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateService(editing.id, form);
      } else {
        await api.addService(form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Deactivate "${s.name}"?`)) return;
    await api.deleteService(s.id);
    load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Services</h1>
        <button onClick={openAdd}
          className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900">
          + Add Service
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Service' : 'Add Service'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Service Name</label>
                <input placeholder="e.g. General Consultation" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" required />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Description</label>
                <textarea placeholder="Brief description..." value={form.description} rows={2}
                  onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Price</label>
                <input type="number" min="0" value={form.price}
                  onChange={e => setForm({...form, price: parseInt(e.target.value) || 0})}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900">
                  {editing ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Services Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
          <>
            {/* Desktop Table */}
            <table className="w-full text-sm hidden sm:table">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {services.map(s => (
                  <tr key={s.id} className={`hover:bg-gray-50 ${s.is_active === false ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{s.description || '—'}</td>
                    <td className="px-4 py-3">{Number(s.price) > 0 ? `₹${s.price}` : 'Free'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(s)} className="text-slate-700 hover:underline text-xs">Edit</button>
                        {s.is_active !== false && (
                          <button onClick={() => handleDelete(s)} className="text-red-500 hover:underline text-xs">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-400">No services yet. Add your first service.</td></tr>
                )}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y">
              {services.map(s => (
                <div key={s.id} className={`p-4 ${s.is_active === false ? 'opacity-50' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.description || 'No description'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span>{Number(s.price) > 0 ? `₹${s.price}` : 'Free'}</span>
                  </div>
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => openEdit(s)} className="text-slate-700 text-xs hover:underline">Edit</button>
                    {s.is_active !== false && (
                      <button onClick={() => handleDelete(s)} className="text-red-500 text-xs hover:underline">Delete</button>
                    )}
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <div className="p-8 text-center text-gray-400">No services yet. Add your first service.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
