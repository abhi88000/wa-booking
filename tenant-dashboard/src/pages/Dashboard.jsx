import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-20">Loading...</div>;
  if (!data) return <div className="text-red-500 text-center py-20">Failed to load dashboard</div>;

  const cards = [
    { label: "Today's Appointments", value: data.stats.today, color: 'text-indigo-600' },
    { label: 'Upcoming', value: data.stats.upcoming, color: 'text-blue-600' },
    { label: 'Total Patients', value: data.stats.total_patients, color: 'text-green-600' },
    { label: 'Revenue (Month)', value: `₹${Number(data.stats.month_revenue || 0).toLocaleString()}`, color: 'text-purple-600' },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">
          Plan: <span className="font-medium text-indigo-600 capitalize">{data.plan}</span>
          {' • '}
          {data.limits.usedAppointmentsMonth}/{data.limits.maxAppointmentsMonth} appointments used
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Today's Appointments */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Today's Schedule</h2>
          <Link to="/appointments" className="text-indigo-600 text-sm hover:underline">View all →</Link>
        </div>
        {data.today && data.today.length > 0 ? (
          <div className="divide-y">
            {data.today.map(a => (
              <div key={a.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{a.patient_name || 'Patient'}</p>
                  <p className="text-xs text-gray-500">{a.doctor_name} • {a.start_time}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium
                  ${a.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                    a.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No appointments today</p>
        )}
      </div>

      {/* Upcoming */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold mb-4">Upcoming Appointments</h2>
        {data.upcoming && data.upcoming.length > 0 ? (
          <div className="divide-y">
            {data.upcoming.map(a => (
              <div key={a.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{a.patient_name || 'Patient'}</p>
                  <p className="text-xs text-gray-500">
                    {a.doctor_name} • {a.appointment_date} at {a.start_time}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium
                  ${a.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No upcoming appointments</p>
        )}
      </div>
    </div>
  );
}
