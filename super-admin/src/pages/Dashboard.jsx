import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getDashboard()
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-20">Loading dashboard...</div>;
  if (!stats) return <div className="text-red-500 text-center py-20">Failed to load dashboard</div>;

  const cards = [
    { label: 'Total Tenants', value: stats.total_tenants, link: '/tenants' },
    { label: 'Active Tenants', value: stats.active_tenants, link: '/tenants?status=active' },
    { label: 'Live (Active WA)', value: stats.live_tenants, link: '/tenants' },
    { label: 'New (30 days)', value: stats.new_tenants_30d, link: '/tenants' },
    { label: 'Appointments (24h)', value: stats.appointments_24h, link: '/analytics' },
  ];

  const ICONS = {
    'Total Tenants': 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    'Active Tenants': 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    'Live (Active WA)': 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
    'New (30 days)': 'M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
    'Appointments (24h)': 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-5">Platform Overview</h1>
      
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {cards.map(card => (
          <div key={card.label}
            onClick={() => navigate(card.link)}
            className="bg-white rounded-lg p-4 border border-gray-100 cursor-pointer hover:border-gray-300 hover:shadow-sm transition">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[card.label]} />
              </svg>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

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
