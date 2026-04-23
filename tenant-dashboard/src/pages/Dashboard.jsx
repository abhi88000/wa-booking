import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useClinic } from '../ClinicContext';
import Icon from '../components/Icons';
import { fmt12 as formatTime } from '../utils';

// ── Helpers ───────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d), now = new Date(), tmr = new Date();
  tmr.setDate(now.getDate() + 1);
  if (dt.toDateString() === now.toDateString()) return 'Today';
  if (dt.toDateString() === tmr.toDateString()) return 'Tomorrow';
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function timeAgo(d) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Status Badge ──────────────────────────────────────────
function StatusBadge({ status }) {
  const s = {
    confirmed: 'bg-emerald-50 text-emerald-700', pending: 'bg-amber-50 text-amber-700',
    completed: 'bg-slate-100 text-slate-600', cancelled: 'bg-red-50 text-red-600',
    no_show: 'bg-gray-100 text-gray-500', new: 'bg-blue-50 text-blue-700',
    contacted: 'bg-purple-50 text-purple-700', resolved: 'bg-emerald-50 text-emerald-700',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded font-medium whitespace-nowrap ${s[status] || s.pending}`}>{status?.replace(/_/g, ' ')}</span>;
}

// ── Record Type Badge ─────────────────────────────────────
function TypeBadge({ type }) {
  const colors = {
    lead: 'bg-emerald-50 text-emerald-600', order: 'bg-blue-50 text-blue-600',
    feedback: 'bg-amber-50 text-amber-600', inquiry: 'bg-purple-50 text-purple-600',
    registration: 'bg-rose-50 text-rose-600',
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${colors[type] || 'bg-gray-50 text-gray-600'}`}>{type}</span>;
}

// ── Stat Card ─────────────────────────────────────────────
const statStyles = [
  { gradient: 'from-emerald-500 to-teal-500', light: 'bg-emerald-50', ring: 'ring-emerald-100' },
  { gradient: 'from-blue-500 to-cyan-500', light: 'bg-blue-50', ring: 'ring-blue-100' },
  { gradient: 'from-violet-500 to-purple-500', light: 'bg-violet-50', ring: 'ring-violet-100' },
  { gradient: 'from-amber-500 to-orange-500', light: 'bg-amber-50', ring: 'ring-amber-100' },
  { gradient: 'from-slate-500 to-gray-600', light: 'bg-slate-50', ring: 'ring-slate-100' },
  { gradient: 'from-rose-500 to-pink-500', light: 'bg-rose-50', ring: 'ring-rose-100' },
];

// ── Main ──────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { clinic } = useClinic();

  useEffect(() => {
    setLoading(true);
    api.getDashboard(clinic).then(({ data }) => {
      setData(data);
      if (data.flowStatus?.labels) {
        localStorage.setItem('tenant_labels', JSON.stringify(data.flowStatus.labels));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [clinic]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-6 h-6 border-2 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  if (!data) return <div className="text-center py-20"><p className="text-sm text-red-500">Failed to load dashboard</p></div>;

  const labels = data.flowStatus?.labels || {};
  const staffLabel = labels.staff || 'Staff';
  const customerLabel = labels.customer || 'Customer';
  const bookingLabel = labels.booking || 'Booking';
  const hasBooking = parseInt(data.stats.active_doctors) > 0;
  const hasRecords = (data.records?.total || 0) > 0;
  const hasFlow = data.flowStatus?.hasFlow;
  const conversations = data.conversations || {};

  const stats = [
    { icon: 'messageCircle', value: conversations.total || 0, label: 'Conversations', link: '/inbox', show: true },
    { icon: 'inbox', value: conversations.today || 0, label: 'Today', link: '/inbox', show: true },
    { icon: 'calendar', value: data.stats.today, label: `${bookingLabel}s Today`, link: '/appointments', show: hasBooking },
    { icon: 'clock', value: data.stats.upcoming, label: 'Upcoming', link: '/appointments', show: hasBooking },
    { icon: 'users', value: data.stats.total_patients, label: `${customerLabel}s`, link: '/patients', show: true },
    { icon: 'userCircle', value: data.stats.active_doctors, label: `${staffLabel}s`, link: '/doctors', show: hasBooking },
    { icon: 'clipboard', value: data.records?.total || 0, label: 'Records', link: '/flow-builder', show: hasRecords && !hasBooking },
    { icon: 'trendingUp', value: data.records?.thisMonth || 0, label: 'This Month', link: '/flow-builder', show: hasRecords && !hasBooking },
  ].filter(s => s.show);

  return (
    <div className="animate-fadeIn max-w-[1080px]">

      {/* ═══ Onboarding nudge (only when empty) ═══ */}
      {!hasFlow && !hasBooking && !hasRecords && (
        <div className="mb-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100/60 p-6 animate-slideUp">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Get started with your WhatsApp bot</h2>
          <p className="text-sm text-gray-500 mb-5">Choose a template and go live in minutes — no coding needed.</p>
          <Link to="/flow-builder" className="inline-flex px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200" style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
            Open Flow Builder →
          </Link>
        </div>
      )}

      {/* ═══ Stat Cards ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {stats.map((s, i) => {
          const style = statStyles[i % statStyles.length];
          return (
            <Link key={s.label} to={s.link}
              className="animate-slideUp group relative bg-white rounded-2xl border border-gray-100/80 p-4 hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300"
              style={{ animationDelay: `${i * 50}ms` }}>
              {/* top accent line */}
              <div className={`absolute top-0 left-4 right-4 h-[2px] rounded-b bg-gradient-to-r ${style.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className={`w-9 h-9 rounded-xl ${style.light} ring-1 ${style.ring} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                <Icon name={s.icon} className="w-[18px] h-[18px]" />
              </div>
              <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">{s.label}</p>
            </Link>
          );
        })}
      </div>

      {/* ═══ Content Grid ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left column (3/5) */}
        <div className="lg:col-span-3 space-y-4">

          {/* Today's Schedule */}
          {hasBooking && (
            <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm animate-slideUp" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500" />
                  <h2 className="text-[15px] font-bold text-gray-900">Today's Schedule</h2>
                  {data.today.length > 0 && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold ring-1 ring-emerald-100">{data.today.length}</span>
                  )}
                </div>
                <Link to="/appointments" className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold transition-colors">View all →</Link>
              </div>
              {data.today.length > 0 ? (
                <div className="px-5 pb-4 divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {data.today.map(a => (
                    <div key={a.id} className="flex items-center gap-3 py-3 group">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-50 to-slate-100 border border-gray-100 flex flex-col items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-gray-700 leading-none">{formatTime(a.start_time).split(' ')[0]}</span>
                        <span className="text-[8px] text-gray-400 uppercase mt-0.5">{formatTime(a.start_time).split(' ')[1]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-emerald-700 transition-colors">{a.patient_name || 'Walk-in'}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{a.doctor_name}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 pb-5">
                  <div className="text-center py-8 bg-gray-50/60 rounded-xl">
                    <Icon name="calendar" className="w-7 h-7 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No {bookingLabel.toLowerCase()}s today</p>
                    <Link to="/appointments" className="text-xs text-emerald-600 font-semibold hover:underline mt-1.5 inline-block">Create one →</Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upcoming */}
          {hasBooking && data.upcoming.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm animate-slideUp" style={{ animationDelay: '260ms' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-400 to-indigo-500" />
                  <h2 className="text-[15px] font-bold text-gray-900">Coming Up</h2>
                </div>
              </div>
              <div className="px-5 pb-4 divide-y divide-gray-50 max-h-56 overflow-y-auto">
                {data.upcoming.map(a => (
                  <div key={a.id} className="flex items-center gap-3 py-2.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-700 leading-none">{formatTime(a.start_time).split(' ')[0]}</span>
                      <span className="text-[8px] text-blue-400 uppercase mt-0.5">{formatTime(a.start_time).split(' ')[1]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.patient_name || 'Walk-in'}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{a.doctor_name} · {formatDate(a.appointment_date)}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Records overview */}
          {hasRecords && data.records.byType.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm p-5 animate-slideUp" style={{ animationDelay: '260ms' }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-purple-400 to-violet-500" />
                <h2 className="text-[15px] font-bold text-gray-900">Records</h2>
                <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full font-medium">{data.records.total} total</span>
              </div>
              <div className="space-y-3">
                {data.records.byType.map(r => {
                  const pct = Math.round((r.count / data.records.total) * 100);
                  return (
                    <div key={r.record_type}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-medium text-gray-700 capitalize">{r.record_type}s</span>
                        <span className="text-xs text-gray-400">{r.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #8b5cf6, #6d28d9)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column (2/5) */}
        <div className="lg:col-span-2 space-y-4">

          {/* Recent records */}
          {hasRecords && data.records.recent.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm p-5 animate-slideUp" style={{ animationDelay: '340ms' }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
                <h2 className="text-[15px] font-bold text-gray-900">Latest Records</h2>
              </div>
              <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
                {data.records.recent.map(r => (
                  <div key={r.id} className="py-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <TypeBadge type={r.record_type} />
                      <span className="text-xs text-gray-400 truncate">{r.phone}</span>
                      <span className="text-[10px] text-gray-300 ml-auto shrink-0">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-1">
                      {r.data ? Object.entries(r.data).filter(([k]) => k !== 'phone').slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversation summary (fallback for no records, no booking) */}
          {!hasRecords && !hasBooking && (conversations.total || 0) > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm p-5 animate-slideUp" style={{ animationDelay: '240ms' }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-400 to-cyan-500" />
                <h2 className="text-[15px] font-bold text-gray-900">Conversations</h2>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center py-2">
                <div>
                  <p className="text-2xl font-extrabold text-gray-900">{conversations.total}</p>
                  <p className="text-xs text-gray-400 mt-1">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-gray-900">{conversations.today}</p>
                  <p className="text-xs text-gray-400 mt-1">Today</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-emerald-600">{conversations.unread}</p>
                  <p className="text-xs text-gray-400 mt-1">Unread</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
