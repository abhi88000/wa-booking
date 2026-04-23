import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';
import { CardSkeleton } from '../components/Skeleton';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { error: showError } = useToast();

  const load = useCallback(() => {
    api.getDashboard()
      .then(({ data }) => setStats(data))
      .catch(() => showError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [showError]);

  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i); }, [load]);

  const cards = stats ? [
    { label: 'Total Tenants', value: stats.total_tenants, prev: stats.total_tenants_prev, link: '/tenants', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Active Tenants', value: stats.active_tenants, prev: stats.active_tenants_prev, link: '/tenants', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Live (Active WA)', value: stats.live_tenants, prev: stats.live_tenants_prev, link: '/tenants', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
    { label: 'New (30 days)', value: stats.new_tenants_30d, prev: stats.new_tenants_30d_prev, link: '/tenants', icon: 'M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Appointments (24h)', value: stats.appointments_24h, prev: stats.appointments_24h_prev, link: '/analytics', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold text-gray-900">Platform Overview</h1>
        <button onClick={load} className="text-xs text-gray-400 hover:text-gray-600 transition" aria-label="Refresh dashboard">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {loading ? <CardSkeleton count={5} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {cards.map(card => {
            const diff = card.prev != null ? card.value - card.prev : null;
            return (
              <div key={card.label}
                role="button" tabIndex={0}
                onClick={() => navigate(card.link)}
                onKeyDown={e => e.key === 'Enter' && navigate(card.link)}
                className="bg-white rounded-lg p-4 border border-gray-100 cursor-pointer hover:border-gray-300 hover:shadow-sm transition">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                  </svg>
                  <p className="text-xs text-gray-500">{card.label}</p>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  {diff != null && diff !== 0 && (
                    <span className={`text-xs font-medium mb-1 ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {diff > 0 ? '↑' : '↓'} {Math.abs(diff)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Activity */}
      {stats?.recent_signups?.length > 0 && (
        <div className="bg-white rounded-lg p-5 border border-gray-100 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent Signups</h2>
          <div className="space-y-2">
            {stats.recent_signups.slice(0, 5).map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-900">{t.business_name}</span>
                  <span className="text-gray-400 ml-2 text-xs">{t.email}</span>
                </div>
                <span className="text-xs text-gray-400">{timeAgo(t.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg p-5 border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/tenants')} className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition">
            View Tenants
          </button>
          <button onClick={() => navigate('/health')} className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition">
            System Health
          </button>
          <button onClick={() => navigate('/analytics')} className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition">
            Analytics
          </button>
          <button onClick={() => navigate('/invite-codes')} className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition">
            Invite Codes
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
