import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../api';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics()
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-20">Loading analytics...</div>;
  if (!data) return <div className="text-red-500 text-center py-20">Failed to load analytics</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signups */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
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

        {/* Plan Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Plan Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.planDistribution} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={80} label>
                {data.planDistribution.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Monthly Revenue</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.revenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={m => new Date(m).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })} fontSize={12} />
              <YAxis tickFormatter={v => `₹${v}`} />
              <Tooltip formatter={v => `₹${Number(v).toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Tenants */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Top Tenants (30 Days)</h2>
          <div className="space-y-3">
            {data.topTenants && data.topTenants.length > 0 ? data.topTenants.map((t, i) => (
              <div key={i} className="flex justify-between items-center">
                <div>
                  <span className="text-gray-400 text-sm mr-2">#{i + 1}</span>
                  <span className="font-medium text-sm">{t.business_name}</span>
                  {t.city && <span className="text-xs text-gray-400 ml-2">{t.city}</span>}
                </div>
                <span className="text-sm font-semibold text-indigo-600">{t.appointments} appts</span>
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
