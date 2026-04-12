import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

// ── Time Helpers ──────────────────────────────────────────
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getCurrentTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' });
}

// ── Status Badge ──────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    completed: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    cancelled: 'bg-red-50 text-red-700 ring-red-600/20',
    no_show: 'bg-gray-50 text-gray-600 ring-gray-500/20',
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ring-1 ring-inset ${styles[status] || styles.pending}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [clock, setClock] = useState(getCurrentTime());

  useEffect(() => {
    api.getDashboard()
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(getCurrentTime()), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
    </div>
  );
  if (!data) return <div className="text-red-500 text-center py-20">Failed to load dashboard</div>;

  const cards = [
    {
      key: 'today',
      label: "Today's Appointments",
      value: data.stats.today,
      icon: '📅',
      color: 'from-slate-600 to-slate-800',
      link: '/appointments',
      items: data.today,
    },
    {
      key: 'upcoming',
      label: 'Upcoming',
      value: data.stats.upcoming,
      icon: '⏳',
      color: 'from-blue-500 to-blue-700',
      link: '/appointments',
      items: data.upcoming,
    },
    {
      key: 'patients',
      label: 'Total Patients',
      value: data.stats.total_patients,
      icon: '👥',
      color: 'from-emerald-500 to-emerald-700',
      link: '/patients',
      items: null,
    },
    {
      key: 'doctors',
      label: 'Active Doctors',
      value: data.stats.active_doctors || 0,
      icon: '👨‍⚕️',
      color: 'from-purple-500 to-purple-700',
      link: '/doctors',
      items: null,
    },
  ];

  const toggleCard = (key) => {
    setExpandedCard(expandedCard === key ? null : key);
  };

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{getGreeting()} 👋</h1>
          <p className="text-sm text-gray-500 mt-1">Here's what's happening today</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">{clock}</p>
          <p className="text-xs text-gray-400">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card, i) => (
          <div key={card.key} className="animate-slideUp" style={{ animationDelay: `${i * 80}ms` }}>
            <div
              onClick={() => card.items ? toggleCard(card.key) : null}
              className={`bg-gradient-to-br ${card.color} rounded-xl p-5 text-white shadow-lg 
                transition-all duration-300 hover:shadow-xl hover:scale-[1.02] 
                ${card.items ? 'cursor-pointer' : ''} 
                ${expandedCard === card.key ? 'ring-2 ring-white/50 scale-[1.02]' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/70">{card.label}</p>
                  <p className="text-3xl font-bold mt-2">{card.value}</p>
                </div>
                <span className="text-2xl">{card.icon}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Link to={card.link} className="text-xs text-white/70 hover:text-white transition-colors" onClick={e => e.stopPropagation()}>
                  View all →
                </Link>
                {card.items && (
                  <span className="text-xs text-white/60">
                    {expandedCard === card.key ? '▲ Collapse' : '▼ Expand'}
                  </span>
                )}
              </div>
            </div>

            {/* Expanded Card Data */}
            {expandedCard === card.key && card.items && (
              <div className="mt-2 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-slideDown">
                {card.items.length > 0 ? (
                  <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                    {card.items.map(a => (
                      <div key={a.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="font-medium text-sm text-gray-900">{a.patient_name || 'Patient'}</p>
                          <p className="text-xs text-gray-500">
                            {a.doctor_name} • {formatDate(a.appointment_date)} at {formatTime(a.start_time)}
                          </p>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-4 text-sm text-gray-400 text-center">No appointments</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Usage Bar */}
      {data.limits && (
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 mb-6 animate-slideUp" style={{ animationDelay: '320ms' }}>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium text-gray-700">Monthly Usage</p>
            <p className="text-xs text-gray-500">
              {data.limits.usedAppointmentsMonth} / {data.limits.maxAppointmentsMonth} appointments
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-slate-500 to-slate-700 h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, (data.limits.usedAppointmentsMonth / data.limits.maxAppointmentsMonth) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 animate-slideUp" style={{ animationDelay: '400ms' }}>
        <div className="flex justify-between items-center p-6 pb-0">
          <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
          <Link to="/appointments" className="text-sm text-slate-600 hover:text-slate-800 font-medium transition-colors">
            View all →
          </Link>
        </div>
        <div className="p-6 pt-4">
          {data.today && data.today.length > 0 ? (
            <div className="space-y-3">
              {data.today.map((a, i) => (
                <div key={a.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200 animate-slideUp"
                  style={{ animationDelay: `${450 + i * 60}ms` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-slate-600">{formatTime(a.start_time).split(' ')[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{a.patient_name || 'Patient'}</p>
                    <p className="text-xs text-gray-500 truncate">{a.doctor_name}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-gray-400 text-sm">No appointments today — enjoy the break!</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 animate-slideUp" style={{ animationDelay: '500ms' }}>
        <div className="flex justify-between items-center p-6 pb-0">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
          <Link to="/appointments" className="text-sm text-slate-600 hover:text-slate-800 font-medium transition-colors">
            View all →
          </Link>
        </div>
        <div className="p-6 pt-4">
          {data.upcoming && data.upcoming.length > 0 ? (
            <div className="space-y-3">
              {data.upcoming.map((a, i) => (
                <div key={a.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200 animate-slideUp"
                  style={{ animationDelay: `${550 + i * 60}ms` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center shrink-0">
                    <div className="text-center leading-tight">
                      <p className="text-[10px] font-semibold text-blue-600">{formatDate(a.appointment_date)}</p>
                      <p className="text-xs font-bold text-blue-700">{formatTime(a.start_time).split(' ')[0]}</p>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{a.patient_name || 'Patient'}</p>
                    <p className="text-xs text-gray-500 truncate">{a.doctor_name}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 text-sm py-8">No upcoming appointments</p>
          )}
        </div>
      </div>
    </div>
  );
}
