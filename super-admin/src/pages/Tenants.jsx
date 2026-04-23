import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';
import { TableSkeleton } from '../components/Skeleton';

const WA_BADGE = {
  connected: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  disconnected: 'bg-gray-100 text-gray-500',
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'just now';
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
  const debounce = useRef(null);
  const { error: showError, success } = useToast();

  const load = useCallback(async (s = search) => {
    setLoading(true);
    try {
      const { data } = await api.getTenants({ page, search: s || undefined, status: statusFilter || undefined });
      setTenants(data.tenants);
      setTotal(data.total);
    } catch {
      showError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, showError]);

  useEffect(() => { load(); }, [load]);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); load(val); }, 400);
  };

  const handleToggle = async (id) => {
    try {
      await api.toggleTenant(id);
      success('Tenant status updated');
      load();
    } catch {
      showError('Failed to toggle tenant');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Tenants ({total})</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center border border-gray-100">
        <div className="flex-1 relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={e => handleSearchChange(e.target.value)}
            aria-label="Search tenants"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-gray-400 outline-none" />
          {search && (
            <button onClick={() => handleSearchChange('')} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="Filter by status"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-gray-400 outline-none">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block">
        {loading ? <TableSkeleton rows={5} cols={7} /> : tenants.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 p-12 text-center">
            <p className="text-gray-400 text-sm">{search ? 'No tenants match your search' : 'No tenants yet'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-sm" aria-label="Tenants">
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
                      <span className={`text-sm font-medium ${Number(t.appointments_7d) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
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

            {/* Pagination */}
            {total > 25 && (
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-t">
                <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 25)}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1 rounded border text-sm disabled:opacity-50 hover:bg-gray-100">Previous</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={tenants.length < 25}
                    className="px-3 py-1 rounded border text-sm disabled:opacity-50 hover:bg-gray-100">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 h-28 animate-pulse" />)}
          </div>
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">{search ? 'No matches' : 'No tenants yet'}</p>
          </div>
        ) : tenants.map(t => (
          <div key={t.id} className="bg-white rounded-lg border border-gray-100 p-4">
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
