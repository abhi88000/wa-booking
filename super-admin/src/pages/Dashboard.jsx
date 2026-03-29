import { useState, useEffect } from 'react';
import api from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(({ data }) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-20">Loading dashboard...</div>;
  if (!stats) return <div className="text-red-500 text-center py-20">Failed to load dashboard</div>;

  const cards = [
    { label: 'Total Tenants', value: stats.total_tenants, color: 'bg-indigo-500', icon: '🏢' },
    { label: 'Active Tenants', value: stats.active_tenants, color: 'bg-green-500', icon: '✅' },
    { label: 'Live (Active WA)', value: stats.live_tenants, color: 'bg-emerald-500', icon: '📱' },
    { label: 'New (30 days)', value: stats.new_tenants_30d, color: 'bg-blue-500', icon: '🆕' },
    { label: 'Paid Subscriptions', value: stats.paid_subs, color: 'bg-purple-500', icon: '💳' },
    { label: 'Trial Users', value: stats.trial_subs, color: 'bg-yellow-500', icon: '⏳' },
    { label: 'MRR (₹)', value: `₹${Number(stats.mrr || 0).toLocaleString()}`, color: 'bg-pink-500', icon: '💰' },
    { label: 'Appointments (24h)', value: stats.appointments_24h, color: 'bg-teal-500', icon: '📅' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <span className="text-2xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex gap-3">
          <a href="/tenants" className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-100 transition">
            View All Tenants →
          </a>
          <a href="/analytics" className="bg-purple-50 text-purple-700 px-4 py-2 rounded-lg hover:bg-purple-100 transition">
            Platform Analytics →
          </a>
        </div>
      </div>
    </div>
  );
}
