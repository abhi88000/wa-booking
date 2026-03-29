import React, { useEffect, useState } from 'react';
import { Calendar, Users, Clock, CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import { dashboard } from '../api';

function StatCard({ icon: Icon, label, value, color, sub }) {
  const colorClasses = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const data = await dashboard.getStats();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <p className="text-red-700">{error}</p>
        <button onClick={loadStats} className="ml-auto text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Overview of your clinic's WhatsApp booking system</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Calendar}
          label="Today's Appointments"
          value={stats?.today_appointments || 0}
          color="green"
          sub={`Tomorrow: ${stats?.tomorrow_appointments || 0}`}
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={stats?.pending_count || 0}
          color="yellow"
          sub="Awaiting confirmation"
        />
        <StatCard
          icon={Users}
          label="Total Patients"
          value={stats?.total_patients || 0}
          color="blue"
          sub={`+${stats?.new_patients_7d || 0} this week`}
        />
        <StatCard
          icon={CreditCard}
          label="Revenue (30d)"
          value={`₹${Number(stats?.revenue_30d || 0).toLocaleString()}`}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Confirmed Upcoming</span>
              <span className="font-semibold text-green-600">{stats?.confirmed_count || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cancelled (30 days)</span>
              <span className="font-semibold text-red-600">{stats?.cancelled_30d || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">New Patients (7d)</span>
              <span className="font-semibold text-blue-600">{stats?.new_patients_7d || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">WhatsApp Webhook Active</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">n8n Workflows Running</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Database Connected</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Reminder CRON Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
