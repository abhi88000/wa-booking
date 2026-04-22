import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useClinic } from '../ClinicContext';
import Icon from '../components/Icons';

// ── Helpers ───────────────────────────────────────────────
function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d), now = new Date(), tmr = new Date();
  tmr.setDate(now.getDate() + 1);
  if (dt.toDateString() === now.toDateString()) return 'Today';
  if (dt.toDateString() === tmr.toDateString()) return 'Tomorrow';
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
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

  const usagePct = data.limits ? Math.min(100, Math.round((data.limits.usedAppointmentsMonth / data.limits.maxAppointmentsMonth) * 100)) : 0;

  return (
    <div className="animate-fadeIn max-w-5xl">

      {/* ═══ Hero Banner ═══ */}
      <div className="relative overflow-hidden rounded-2xl mb-5 animate-slideUp"
        style={{ background: 'linear-gradient(135deg, #0a2e1f 0%, #134e3a 40%, #065f46 100%)' }}>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute top-4 right-20 w-2 h-2 bg-emerald-400/40 rounded-full" />
        <div className="absolute bottom-6 right-40 w-1.5 h-1.5 bg-emerald-300/30 rounded-full" />

        <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-emerald-300/70 text-xs font-medium tracking-wider uppercase mb-1">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Dashboard</h1>
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${hasFlow ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-xs text-emerald-200/80 font-medium">Bot {hasFlow ? 'Active' : 'Offline'}</span>
              </div>
              {conversations.lastMessage && (
                <span className="text-xs text-emerald-200/50">· Last message {timeAgo(conversations.lastMessage)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Usage ring */}
            {data.limits && (
              <div className="relative w-14 h-14 shrink-0">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                  <circle cx="28" cy="28" r="22" fill="none" stroke="#34d399" strokeWidth="4"
                    strokeDasharray={`${usagePct * 1.38} 138`} strokeLinecap="round"
                    className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-white">{usagePct}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Onboarding nudge (only when empty) ═══ */}
      {!hasFlow && !hasBooking && !hasRecords && (
        <div className="mb-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-xl border border-emerald-100 p-5 animate-slideUp" style={{ animationDelay: '60ms' }}>
          <h2 className="text-base font-bold text-gray-900 mb-1">Let's get your WhatsApp bot running!</h2>
          <p className="text-sm text-gray-600 mb-4">Pick a template to get started in seconds — no coding needed.</p>
          <Link to="/flow-builder" className="inline-flex px-4 py-2 text-sm font-semibold text-white rounded-lg transition hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
            Open Flow Builder →
          </Link>
        </div>
      )}

      {/* ═══ Stat Tiles ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        {[
          { icon: 'messageCircle', value: conversations.total || 0, label: 'Conversations', color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', link: '/inbox', show: true },
          { icon: 'inbox', value: conversations.today || 0, label: 'Today', color: 'from-blue-500 to-cyan-600', bg: 'bg-blue-50', link: '/inbox', show: true },
          { icon: 'calendar', value: data.stats.today, label: `${bookingLabel}s Today`, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', link: '/appointments', show: hasBooking },
          { icon: 'clock', value: data.stats.upcoming, label: 'Upcoming', color: 'from-purple-500 to-indigo-600', bg: 'bg-purple-50', link: '/appointments', show: hasBooking },
          { icon: 'users', value: data.stats.total_patients, label: `${customerLabel}s`, color: 'from-slate-500 to-gray-600', bg: 'bg-slate-50', link: '/patients', show: true },
          { icon: 'userCircle', value: data.stats.active_doctors, label: `${staffLabel}s`, color: 'from-rose-500 to-pink-600', bg: 'bg-rose-50', link: '/doctors', show: hasBooking },
          { icon: 'clipboard', value: data.records?.total || 0, label: 'Records', color: 'from-purple-500 to-violet-600', bg: 'bg-purple-50', link: '/flow-builder', show: hasRecords && !hasBooking },
          { icon: 'trendingUp', value: data.records?.thisMonth || 0, label: 'This Month', color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', link: '/flow-builder', show: hasRecords && !hasBooking },
        ].filter(s => s.show).map((s, i) => (
          <Link key={s.label} to={s.link}
            className="animate-slideUp bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            style={{ animationDelay: `${80 + i * 40}ms` }}>
            <div className="flex items-center justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                <Icon name={s.icon} className="w-4 h-4" />
              </div>
              {parseInt(s.value) > 0 && (
                <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${s.color}`} />
              )}
            </div>
            <p className="text-xl font-extrabold text-gray-900">{s.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* ═══ Main Grid ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-5">

        {/* Left column — Schedule (3/5) */}
        <div className="lg:col-span-3 space-y-3">
          {/* Today's appointments — only if has data or booking is active */}
          {hasBooking && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm animate-slideUp" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500" />
                  <h2 className="text-sm font-bold text-gray-900">Today's Schedule</h2>
                  {data.today.length > 0 && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">{data.today.length}</span>}
                </div>
                <Link to="/appointments" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View all →</Link>
              </div>
              {data.today.length > 0 ? (
                <div className="px-4 pb-3 divide-y divide-gray-50 max-h-60 overflow-y-auto">
                  {data.today.map(a => (
                    <div key={a.id} className="flex items-center gap-3 py-2.5 group">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-50 to-slate-100 border border-gray-100 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-gray-700 leading-none">{formatTime(a.start_time).split(' ')[0]}</span>
                        <span className="text-[8px] text-gray-400 uppercase">{formatTime(a.start_time).split(' ')[1]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-emerald-700 transition">{a.patient_name || 'Walk-in'}</p>
                        <p className="text-xs text-gray-400 truncate">{a.doctor_name}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 pb-4">
                  <div className="text-center py-6 bg-gray-50/50 rounded-lg">
                    <Icon name="calendar" className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                    <p className="text-xs text-gray-400">No {bookingLabel.toLowerCase()}s today</p>
                    <Link to="/appointments" className="text-[11px] text-emerald-600 font-medium hover:underline mt-1 inline-block">Create one →</Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upcoming */}
          {hasBooking && data.upcoming.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm animate-slideUp" style={{ animationDelay: '260ms' }}>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-400 to-indigo-500" />
                  <h2 className="text-sm font-bold text-gray-900">Coming Up</h2>
                </div>
              </div>
              <div className="px-4 pb-3 divide-y divide-gray-50 max-h-52 overflow-y-auto">
                {data.upcoming.map(a => (
                  <div key={a.id} className="flex items-center gap-3 py-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-blue-700 leading-none">{formatTime(a.start_time).split(' ')[0]}</span>
                      <span className="text-[8px] text-blue-400 uppercase">{formatTime(a.start_time).split(' ')[1]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.patient_name || 'Walk-in'}</p>
                      <p className="text-xs text-gray-400 truncate">{a.doctor_name} · {formatDate(a.appointment_date)}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Records overview */}
          {hasRecords && data.records.byType.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slideUp" style={{ animationDelay: '260ms' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-purple-400 to-violet-500" />
                <h2 className="text-sm font-bold text-gray-900">Records</h2>
                <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{data.records.total} total</span>
              </div>
              <div className="space-y-2.5">
                {data.records.byType.map(r => {
                  const pct = Math.round((r.count / data.records.total) * 100);
                  return (
                    <div key={r.record_type}>
                      <div className="flex justify-between items-center mb-1">
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

        {/* Right column — Activity Feed (2/5) */}
        <div className="lg:col-span-2 space-y-3">

          {/* Recent records */}
          {hasRecords && data.records.recent.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slideUp" style={{ animationDelay: '340ms' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
                <h2 className="text-sm font-bold text-gray-900">Latest Records</h2>
              </div>
              <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
                {data.records.recent.map(r => (
                  <div key={r.id} className="py-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <TypeBadge type={r.record_type} />
                      <span className="text-xs text-gray-400 truncate">{r.phone}</span>
                      <span className="text-[10px] text-gray-300 ml-auto shrink-0">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {r.data ? Object.entries(r.data).filter(([k]) => k !== 'phone').slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversation summary (fallback for no records, no booking) */}
          {!hasRecords && !hasBooking && (conversations.total || 0) > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slideUp" style={{ animationDelay: '240ms' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-400 to-cyan-500" />
                <h2 className="text-sm font-bold text-gray-900">Conversations</h2>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center py-3">
                <div>
                  <p className="text-xl font-extrabold text-gray-900">{conversations.total}</p>
                  <p className="text-[11px] text-gray-400">Total</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-gray-900">{conversations.today}</p>
                  <p className="text-[11px] text-gray-400">Today</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-emerald-600">{conversations.unread}</p>
                  <p className="text-[11px] text-gray-400">Unread</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Mobile usage bar ═══ */}
      {data.limits && (
        <div className="sm:hidden bg-white rounded-xl border border-gray-100 p-3 mt-2 animate-slideUp">
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-xs text-gray-500 font-medium">Monthly Usage</p>
            <p className="text-xs text-gray-400">{data.limits.usedAppointmentsMonth} / {data.limits.maxAppointmentsMonth}</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${usagePct}%`, background: 'linear-gradient(90deg, #25D366, #128C7E)' }} />
          </div>
        </div>
      )}
    </div>
  );
}
