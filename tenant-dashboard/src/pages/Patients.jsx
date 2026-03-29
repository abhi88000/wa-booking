import { useState, useEffect } from 'react';
import api from '../api';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.getPatients({ search: search || undefined });
      setPatients(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Patients</h1>

      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Search</button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Appointments</th>
                <th className="px-4 py-3 font-medium">Last Visit</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {patients.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name || '—'}</td>
                  <td className="px-4 py-3">{p.phone}</td>
                  <td className="px-4 py-3">{p.email || '—'}</td>
                  <td className="px-4 py-3">{p.total_appointments}</td>
                  <td className="px-4 py-3">{p.last_visit || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400">No patients found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
