import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const WA_BADGE = {
  connected: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  disconnected: 'bg-gray-100 text-gray-500',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [page, statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.getTenants({ page, search: search || undefined, status: statusFilter || undefined });
      setTenants(data.tenants);
      setTotal(data.total);
    } catch (err) {
      // silenced
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const handleToggle = async (id) => {
    await api.toggleTenant(id);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Tenants ({total})</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-none p-4 mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center border border-gray-100">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 border rounded-lg px-4 py-2 text-sm focus:border-gray-400 outline-none" />
          <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900">
            Search
          </button>
        </form>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-lg shadow-none border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Appointments</th>
                <th className="px-4 py-3 font-medium">Activity (7d)</th>
                <th className="px-4 py-3 font-medium">Last Activity</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/tenants/${t.id}`} className="text-slate-700 hover:underline font-medium">
                      {t.business_name}
                    </Link>
                    <div className="text-xs text-gray-400">{t.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${WA_BADGE[t.wa_status] || WA_BADGE.disconnected}`}>
                      {t.wa_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{t.total_appointments}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${parseInt(t.appointments_7d) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {t.appointments_7d || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {t.last_appointment_at ? timeAgo(t.last_appointment_at) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(t.id)}
                      className={`text-xs px-3 py-1 rounded ${t.is_active 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                        : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                      {t.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > 25 && (
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-t">
            <span className="text-sm text-gray-500">Page {page}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50">Previous</button>
              <button onClick={() => setPage(p => p + 1)} disabled={tenants.length < 25}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : tenants.map(t => (
          <div key={t.id} className="bg-white rounded-lg shadow-none border border-gray-100 p-4">
            <div className="flex justify-between items-start">
              <div>
                <Link to={`/tenants/${t.id}`} className="text-slate-700 font-medium hover:underline">
                  {t.business_name}
                </Link>
                <p className="text-xs text-gray-400">{t.email}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${WA_BADGE[t.wa_status] || WA_BADGE.disconnected}`}>
                {t.wa_status}
              </span>
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span>{t.total_appointments} appts</span>
              <span>{t.appointments_7d || 0} this week</span>
              <span>{t.last_appointment_at ? timeAgo(t.last_appointment_at) : 'No activity'}</span>
            </div>
            <button onClick={() => handleToggle(t.id)}
              className={`mt-3 text-xs px-3 py-1.5 rounded ${t.is_active 
                ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {t.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
