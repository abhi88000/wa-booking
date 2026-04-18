import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useClinic } from '../ClinicContext';

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

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
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
function StatCard({ icon, value, label, accent, link, delay }) {
  return (
    <Link to={link} className="animate-slideUp bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all group" style={{ animationDelay: `${delay}ms` }}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm mb-3 ${accent}`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5 group-hover:text-gray-500 transition">{label}</p>
    </Link>
  );
}

// ── Quick Action ──────────────────────────────────────────
function QuickAction({ icon, label, desc, to, color, delay }) {
  return (
    <Link to={to} className="animate-slideUp flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-gray-200 hover:shadow-sm transition-all group" style={{ animationDelay: `${delay}ms` }}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { clinic } = useClinic();

  useEffect(() => {
    setLoading(true);
    api.getDashboard(clinic).then(({ data }) => setData(data)).catch(console.error).finally(() => setLoading(false));
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
  const hasConversations = (data.conversations?.total || 0) > 0;

  return (
    <div className="animate-fadeIn max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">{getGreeting()} 👋</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {data.limits && (
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400">{data.limits.usedAppointmentsMonth} / {data.limits.maxAppointmentsMonth} {bookingLabel.toLowerCase()}s this month</p>
            <div className="w-32 bg-gray-100 rounded-full h-1.5 mt-1">
              <div className="h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, Math.round((data.limits.usedAppointmentsMonth / data.limits.maxAppointmentsMonth) * 100))}%`, background: 'linear-gradient(90deg, #25D366, #128C7E)' }} />
            </div>
          </div>
        )}
      </div>

      {/* No bot setup — onboarding nudge */}
      {!hasFlow && !hasBooking && !hasRecords && (
        <div className="mb-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 p-5 animate-slideUp">
          <h2 className="text-base font-bold text-gray-900 mb-1">🚀 Let's get your WhatsApp bot running!</h2>
          <p className="text-sm text-gray-600 mb-4">Pick a template to get started in seconds — no coding needed.</p>
          <div className="flex gap-2">
            <Link to="/flow-builder" className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}>
              Open Flow Builder →
            </Link>
            <Link to="/settings" className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              Settings
            </Link>
          </div>
        </div>
      )}

      {/* Stat Cards — adaptive based on what tenant uses */}
      <div className={`grid gap-3 mb-6 ${hasBooking ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {/* Always show conversations */}
        <StatCard icon="💬" value={data.conversations?.total || 0} label="Total Conversations" accent="bg-emerald-50" link="/inbox" delay={0} />
        <StatCard icon="📩" value={data.conversations?.today || 0} label="Conversations Today" accent="bg-blue-50" link="/inbox" delay={60} />

        {/* Records or appointment stats depending on usage */}
        {hasRecords ? (
          <>
            <StatCard icon="📋" value={data.records?.total || 0} label="Records Collected" accent="bg-purple-50" link="/flow-builder" delay={120} />
            <StatCard icon="📈" value={data.records?.thisMonth || 0} label="This Month" accent="bg-amber-50" link="/flow-builder" delay={180} />
          </>
        ) : hasBooking ? (
          <>
            <StatCard icon="📅" value={data.stats.today} label={`Today's ${bookingLabel}s`} accent="bg-emerald-50" link="/appointments" delay={120} />
            <StatCard icon="⏳" value={data.stats.upcoming} label={`Upcoming ${bookingLabel}s`} accent="bg-blue-50" link="/appointments" delay={180} />
          </>
        ) : (
          <>
            <StatCard icon="👥" value={data.stats.total_patients} label={`${customerLabel}s`} accent="bg-purple-50" link="/patients" delay={120} />
            <StatCard icon="🤖" value={hasFlow ? 'Active' : 'Off'} label="Bot Status" accent={hasFlow ? 'bg-emerald-50' : 'bg-red-50'} link="/flow-builder" delay={180} />
          </>
        )}
      </div>

      {/* Booking stats row (only if they use booking system) */}
      {hasBooking && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon="📅" value={data.stats.today} label={`${bookingLabel}s Today`} accent="bg-slate-50" link="/appointments" delay={240} />
          <StatCard icon="⏳" value={data.stats.upcoming} label={`Upcoming`} accent="bg-slate-50" link="/appointments" delay={300} />
          <StatCard icon="👥" value={data.stats.total_patients} label={`${customerLabel}s`} accent="bg-slate-50" link="/patients" delay={360} />
          <StatCard icon="🧑‍⚕️" value={data.stats.active_doctors} label={`${staffLabel}s`} accent="bg-slate-50" link="/doctors" delay={420} />
        </div>
      )}

      {/* Middle section: Records by type + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">

        {/* Records by type */}
        {hasRecords && data.records.byType.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slideUp" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">📊 Records Overview</h2>
              <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{data.records.total} total</span>
            </div>
            <div className="space-y-2">
              {data.records.byType.map(r => {
                const pct = Math.round((r.count / data.records.total) * 100);
                return (
                  <div key={r.record_type}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-700 capitalize">{r.record_type}s</span>
                      <span className="text-xs text-gray-400">{r.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #25D366, #128C7E)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Today's appointments */}
        {hasBooking && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slideUp" style={{ animationDelay: '360ms' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">📅 Today's {bookingLabel}s</h2>
              <Link to="/appointments" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View all →</Link>
            </div>
            {data.today.length > 0 ? (
              <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
                {data.today.map(a => (
                  <div key={a.id} className="flex items-center gap-3 py-2.5">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-slate-500">{formatTime(a.start_time).split(' ')[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.patient_name || 'Walk-in'}</p>
                      <p className="text-xs text-gray-400 truncate">{a.doctor_name}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-gray-400">No {bookingLabel.toLowerCase()}s today</p>
              </div>
            )}
          </div>
        )}

        {/* Recent records (if no booking, show this on the other side) */}
        {hasRecords && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slideUp" style={{ animationDelay: '420ms' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">🕐 Recent Records</h2>
              <span className="text-[10px] text-gray-400">{data.records.thisMonth} this month</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {data.records.recent.map(r => (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <TypeBadge type={r.record_type} />
                      <span className="text-xs text-gray-400">{r.phone}</span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {r.data ? Object.entries(r.data).filter(([k]) => k !== 'phone').slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusBadge status={r.status} />
                    <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(r.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conversations card (if no records and no booking, show it) */}
        {!hasRecords && !hasBooking && hasConversations && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-slideUp" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">💬 Conversations</h2>
              <Link to="/inbox" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Open Inbox →</Link>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center py-4">
              <div>
                <p className="text-xl font-bold text-gray-900">{data.conversations.total}</p>
                <p className="text-xs text-gray-400">Total</p>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{data.conversations.today}</p>
                <p className="text-xs text-gray-400">Today</p>
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-600">{data.conversations.unread}</p>
                <p className="text-xs text-gray-400">Unread</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upcoming appointments */}
      {hasBooking && data.upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6 animate-slideUp" style={{ animationDelay: '480ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">⏳ Upcoming {bookingLabel}s</h2>
            <Link to="/appointments" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {data.upcoming.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2.5">
                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-500">{formatTime(a.start_time).split(' ')[0]}</span>
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

      {/* Quick Actions */}
      <div className="mb-2 animate-slideUp" style={{ animationDelay: '540ms' }}>
        <h2 className="text-sm font-bold text-gray-900 mb-2">⚡ Quick Actions</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <QuickAction icon="🤖" label="Flow Builder" desc="Design your WhatsApp bot" to="/flow-builder" color="bg-emerald-50" delay={600} />
        <QuickAction icon="💬" label="Inbox" desc={`${data.conversations?.unread || 0} unread`} to="/inbox" color="bg-blue-50" delay={660} />
        {hasBooking && <QuickAction icon="📅" label={`${bookingLabel}s`} desc={`${data.stats.upcoming} upcoming`} to="/appointments" color="bg-purple-50" delay={720} />}
        <QuickAction icon="👥" label={`${customerLabel}s`} desc={`${data.stats.total_patients} total`} to="/patients" color="bg-amber-50" delay={hasBooking ? 780 : 720} />
        {hasBooking && <QuickAction icon="🧑‍⚕️" label={`${staffLabel} List`} desc={`${data.stats.active_doctors} active`} to="/doctors" color="bg-rose-50" delay={840} />}
        <QuickAction icon="⚙️" label="Settings" desc="Business & WhatsApp config" to="/settings" color="bg-slate-50" delay={hasBooking ? 900 : 780} />
      </div>

      {/* Mobile usage bar */}
      {data.limits && (
        <div className="sm:hidden bg-white rounded-xl border border-gray-100 p-3 mt-4 animate-slideUp">
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-xs text-gray-500 font-medium">Monthly Usage</p>
            <p className="text-xs text-gray-400">{data.limits.usedAppointmentsMonth} / {data.limits.maxAppointmentsMonth}</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.round((data.limits.usedAppointmentsMonth / data.limits.maxAppointmentsMonth) * 100))}%`, background: 'linear-gradient(90deg, #25D366, #128C7E)' }} />
          </div>
        </div>
      )}
    </div>
  );
}
