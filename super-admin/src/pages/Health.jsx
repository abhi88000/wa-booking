import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Health() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(null); // tenantId being validated
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getHealth();
      setData(res.data);
    } catch (err) {
      // silenced
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleValidateWA = async (tenantId) => {
    setValidating(tenantId);
    try {
      const res = await api.validateWA(tenantId);
      alert(res.data.valid 
        ? `WA token is valid! ${JSON.stringify(res.data.details?.verified_name || '')}` 
        : `WA token invalid: ${res.data.error}`);
      load(); // refresh
    } catch (err) {
      alert('Error validating: ' + (err.response?.data?.error || err.message));
    }
    setValidating(null);
  };

  const handleResetConversations = async (tenantId) => {
    if (!confirm('Reset all stuck conversations for this tenant?')) return;
    try {
      const res = await api.resetConversations(tenantId);
      alert(`Fixed ${res.data.fixed} stuck conversations`);
      load();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading health data...</div>;
  if (!data) return <div className="text-red-500">Failed to load health data</div>;

  const { summary, tenants } = data;
  const critical = tenants.filter(t => t.status === 'critical');
  const warnings = tenants.filter(t => t.status === 'warning');
  const healthy = tenants.filter(t => t.status === 'healthy');

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold text-gray-900">System Health</h1>
        <button onClick={load} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm transition">
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total Tenants" value={summary.total} color="gray" />
        <SummaryCard label="Healthy" value={summary.healthy} color="green" />
        <SummaryCard label="Warnings" value={summary.warning} color="yellow" />
        <SummaryCard label="Critical" value={summary.critical} color="red" />
      </div>

      {/* Critical Issues (show first) */}
      {critical.length > 0 && (
        <Section title="Critical" subtitle="These tenants need immediate attention" color="red">
          {critical.map(t => (
            <TenantHealthCard key={t.tenantId} tenant={t} 
              onValidateWA={handleValidateWA} 
              onResetConversations={handleResetConversations}
              validating={validating}
              onNavigate={() => navigate(`/tenants/${t.tenantId}`)} />
          ))}
        </Section>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Section title="Warnings" subtitle="May need attention soon" color="yellow">
          {warnings.map(t => (
            <TenantHealthCard key={t.tenantId} tenant={t}
              onValidateWA={handleValidateWA}
              onResetConversations={handleResetConversations}
              validating={validating}
              onNavigate={() => navigate(`/tenants/${t.tenantId}`)} />
          ))}
        </Section>
      )}

      {/* Healthy */}
      <Section title="Healthy" subtitle={`${healthy.length} tenants running fine`} color="green">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {healthy.map(t => (
            <div key={t.tenantId} 
              className="flex items-center justify-between bg-white border rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/tenants/${t.tenantId}`)}>
              <div>
                <span className="font-medium">{t.name}</span>
                <span className="text-gray-400 text-sm ml-2">{t.plan}</span>
              </div>
              <span className="text-green-500 text-sm">All good</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  const colors = {
    gray: 'border-gray-200 text-gray-800',
    green: 'border-green-200 text-green-800',
    yellow: 'border-yellow-200 text-yellow-800',
    red: 'border-red-200 text-red-800',
  };
  return (
    <div className={`bg-white border ${colors[color]} rounded-lg p-4 text-center`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function Section({ title, subtitle, color, children }) {
  const borderColors = { red: 'border-red-300', yellow: 'border-yellow-300', green: 'border-green-300' };
  return (
    <div className={`mb-8 border-l-4 ${borderColors[color]} pl-4`}>
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="text-gray-500 text-sm mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

function TenantHealthCard({ tenant, onValidateWA, onResetConversations, validating, onNavigate }) {
  const t = tenant;
  return (
    <div className="bg-white border rounded-lg p-4 mb-3 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-sm cursor-pointer hover:text-slate-600" onClick={onNavigate}>
            {t.name}
          </h3>
          <p className="text-gray-500 text-sm">{t.email} &middot; {t.plan} &middot; WA: {t.waStatus}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onValidateWA(t.tenantId)}
            disabled={validating === t.tenantId}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">
            {validating === t.tenantId ? 'Checking...' : 'Test WA'}
          </button>
          <button onClick={() => onResetConversations(t.tenantId)}
            className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200">
            Reset Chats
          </button>
        </div>
      </div>

      {/* Issues */}
      <div className="mt-3 space-y-1">
        {t.issues.map((issue, i) => (
          <div key={i} className={`text-sm flex items-center gap-2 ${
            issue.level === 'critical' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${issue.level === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
            <span>{issue.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
