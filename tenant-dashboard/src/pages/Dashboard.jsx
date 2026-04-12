import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

// ── SVG Icons ─────────────────────────────────────────────
const icons = {
  calendar: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  doctor: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  ),
  chevronUp: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  ),
  arrowRight: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  ),
  empty: (
    <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
  ),
};

// ── Helpers ───────────────────────────────────────────────
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
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getCurrentTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZoneName: 'short' });
}

// ── Status Badge ──────────────────────────────────────────
function StatusBadge({ status }) {
  const styles = {
    confirmed: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    completed: 'bg-slate-100 text-slate-600',
    cancelled: 'bg-red-50 text-red-600',
    no_show: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded font-medium whitespace-nowrap ${styles[status] || styles.pending}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

// ── Appointment Row ───────────────────────────────────────
function AppointmentRow({ a, showDate }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
        <span className="text-[11px] font-semibold text-slate-500 leading-none">{formatTime(a.start_time).split(' ')[0]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{a.patient_name || 'Walk-in'}</p>
        <p className="text-xs text-gray-400 truncate">
          {a.doctor_name}{showDate ? ` · ${formatDate(a.appointment_date)}` : ''}
        </p>
      </div>
      <StatusBadge status={a.status} />
    </div>
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

  useEffect(() => {
    const t = setInterval(() => setClock(getCurrentTime()), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="text-center py-20">
      <p className="text-sm text-red-500">Failed to load dashboard</p>
    </div>
  );

  const cards = [
    { key: 'today', label: 'Today', value: data.stats.today, icon: icons.calendar, accent: 'text-slate-600 bg-slate-50', link: '/appointments', items: data.today },
    { key: 'upcoming', label: 'Upcoming', value: data.stats.upcoming, icon: icons.clock, accent: 'text-blue-600 bg-blue-50', link: '/appointments', items: data.upcoming },
    { key: 'patients', label: 'Patients', value: data.stats.total_patients, icon: icons.users, accent: 'text-emerald-600 bg-emerald-50', link: '/patients', items: null },
    { key: 'doctors', label: 'Doctors', value: data.stats.active_doctors || 0, icon: icons.doctor, accent: 'text-violet-600 bg-violet-50', link: '/doctors', items: null },
  ];

  const toggleCard = (key) => setExpandedCard(expandedCard === key ? null : key);

  const usagePercent = data.limits
    ? Math.min(100, Math.round((data.limits.usedAppointmentsMonth / data.limits.maxAppointmentsMonth) * 100))
    : 0;

  return (
    <div className="animate-fadeIn max-w-5xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{getGreeting()}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {clock}
          </p>
        </div>
        {data.limits && (
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">{data.limits.usedAppointmentsMonth} / {data.limits.maxAppointmentsMonth} this month</p>
            <div className="w-28 bg-gray-100 rounded-full h-1.5 mt-1">
              <div className="bg-slate-400 h-1.5 rounded-full transition-all duration-700" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map((card, i) => (
          <div key={card.key} className="animate-slideUp" style={{ animationDelay: `${i * 60}ms` }}>
            <button
              onClick={() => card.items ? toggleCard(card.key) : null}
              className={`w-full text-left bg-white rounded-lg border p-4 transition-all duration-200
                ${card.items ? 'cursor-pointer hover:border-gray-300' : ''}
                ${expandedCard === card.key ? 'border-gray-300 shadow-sm' : 'border-gray-100'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center ${card.accent}`}>
                  {card.icon}
                </div>
                {card.items && (
                  <span className="text-gray-300">
                    {expandedCard === card.key ? icons.chevronUp : icons.chevronDown}
                  </span>
                )}
              </div>
              <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-400">{card.label}</p>
                <Link to={card.link} className="text-gray-300 hover:text-gray-500 transition-colors" onClick={e => e.stopPropagation()}>
                  {icons.arrowRight}
                </Link>
              </div>
            </button>

            {expandedCard === card.key && card.items && (
              <div className="mt-1.5 bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden animate-slideDown">
                {card.items.length > 0 ? (
                  <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto px-3">
                    {card.items.map(a => (
                      <AppointmentRow key={a.id} a={a} showDate={card.key === 'upcoming'} />
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-3 text-xs text-gray-400 text-center">Nothing here</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile usage bar */}
      {data.limits && (
        <div className="sm:hidden bg-white rounded-lg border border-gray-100 p-3 mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-xs text-gray-500">Monthly usage</p>
            <p className="text-xs text-gray-400">{data.limits.usedAppointmentsMonth} / {data.limits.maxAppointmentsMonth}</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-slate-400 h-1.5 rounded-full transition-all duration-700" style={{ width: `${usagePercent}%` }} />
          </div>
        </div>
      )}

      {/* Two-column on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Today */}
        <div className="bg-white rounded-lg border border-gray-100 animate-slideUp" style={{ animationDelay: '260ms' }}>
          <div className="flex justify-between items-center px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-gray-800">Today</h2>
            <Link to="/appointments" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
              All {icons.arrowRight}
            </Link>
          </div>
          <div className="px-4 pb-4">
            {data.today && data.today.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {data.today.map(a => <AppointmentRow key={a.id} a={a} showDate={false} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8">
                {icons.empty}
                <p className="text-xs text-gray-400 mt-2">No appointments today</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming */}
        <div className="bg-white rounded-lg border border-gray-100 animate-slideUp" style={{ animationDelay: '320ms' }}>
          <div className="flex justify-between items-center px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-gray-800">Upcoming</h2>
            <Link to="/appointments" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
              All {icons.arrowRight}
            </Link>
          </div>
          <div className="px-4 pb-4">
            {data.upcoming && data.upcoming.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {data.upcoming.map(a => <AppointmentRow key={a.id} a={a} showDate={true} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8">
                {icons.empty}
                <p className="text-xs text-gray-400 mt-2">No upcoming appointments</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
