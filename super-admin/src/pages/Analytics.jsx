import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import { useToast } from '../components/Toast';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { error: showError } = useToast();

  useEffect(() => {
    api.getAnalytics()
      .then(({ data }) => setData(data))
      .catch(() => showError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [showError]);

  if (loading) return (
    <div className="space-y-6">
      <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1,2].map(i => <div key={i} className="bg-white rounded-lg border border-gray-100 h-80 animate-pulse" />)}
      </div>
    </div>
  );
  if (!data) return <div className="text-red-500 text-center py-20">Failed to load analytics</div>;

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-5">Platform Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signups */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">New Signups (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.signups}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} fontSize={12} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="signups" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Tenants */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Top Tenants (30 Days)</h2>
          <div className="space-y-3">
            {data.topTenants && data.topTenants.length > 0 ? data.topTenants.map((t, i) => (
              <div key={i} className="flex justify-between items-center">
                <div>
                  <span className="text-gray-400 text-sm mr-2">#{i + 1}</span>
                  <span className="font-medium text-sm">{t.business_name}</span>
                  {t.city && <span className="text-xs text-gray-400 ml-2">{t.city}</span>}
                </div>
                <span className="text-sm font-semibold text-slate-700">{t.appointments} appts</span>
              </div>
            )) : (
              <p className="text-gray-400 text-sm">No appointment data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
