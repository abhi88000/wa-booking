import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function Health() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(null);
  const [resetModal, setResetModal] = useState(null);
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await api.getHealth();
      setData(res.data);
    } catch {
      showError('Failed to load health data');
    }
    setLoading(false);
  }, [showError]);

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  const handleValidateWA = async (tenantId) => {
    setValidating(tenantId);
    try {
      const res = await api.validateWA(tenantId);
      if (res.data.valid) {
        success(`WA token valid! ${res.data.details?.verified_name || ''}`);
      } else {
        showError(`WA token invalid: ${res.data.error}`);
      }
      load();
    } catch (err) {
      showError('Error validating: ' + (err.response?.data?.error || err.message));
    }
    setValidating(null);
  };

  const handleResetConversations = async () => {
    const tenantId = resetModal;
    setResetModal(null);
    try {
      const res = await api.resetConversations(tenantId);
      success(`Fixed ${res.data.fixed} stuck conversations`);
      load();
    } catch (err) {
      showError('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="bg-white border rounded-lg p-4 h-20 animate-pulse" />)}
      </div>
      {[1,2,3].map(i => <div key={i} className="bg-white border rounded-lg h-24 animate-pulse" />)}
    </div>
  );
  if (!data) return <div className="text-red-500">Failed to load health data</div>;

  const { summary, tenants } = data;
  const critical = tenants.filter(t => t.status === 'critical');
  const warnings = tenants.filter(t => t.status === 'warning');
  const healthy = tenants.filter(t => t.status === 'healthy');

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold text-gray-900">System Health</h1>
        <button onClick={load} aria-label="Refresh health data"
          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm transition flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total Tenants" value={summary.total} color="gray" icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
        <SummaryCard label="Healthy" value={summary.healthy} color="green" icon="M5 13l4 4L19 7" />
        <SummaryCard label="Warnings" value={summary.warning} color="yellow" icon="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <SummaryCard label="Critical" value={summary.critical} color="red" icon="M6 18L18 6M6 6l12 12" />
      </div>

      {critical.length > 0 && (
        <Section title="Critical" subtitle="These tenants need immediate attention" color="red" icon="⚠">
          {critical.map(t => (
            <TenantHealthCard key={t.tenantId} tenant={t} 
              onValidateWA={handleValidateWA} 
              onResetConversations={(id) => setResetModal(id)}
              validating={validating}
              onNavigate={() => navigate(`/tenants/${t.tenantId}`)} />
          ))}
        </Section>
      )}

      {warnings.length > 0 && (
        <Section title="Warnings" subtitle="May need attention soon" color="yellow" icon="⚡">
          {warnings.map(t => (
            <TenantHealthCard key={t.tenantId} tenant={t}
              onValidateWA={handleValidateWA}
              onResetConversations={(id) => setResetModal(id)}
              validating={validating}
              onNavigate={() => navigate(`/tenants/${t.tenantId}`)} />
          ))}
        </Section>
      )}

      <Section title="Healthy" subtitle={`${healthy.length} tenants running fine`} color="green" icon="✓">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {healthy.map(t => (
            <div key={t.tenantId} role="button" tabIndex={0}
              className="flex items-center justify-between bg-white border rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-50"
              onClick={() => navigate(`/tenants/${t.tenantId}`)}
              onKeyDown={e => e.key === 'Enter' && navigate(`/tenants/${t.tenantId}`)}>
              <div>
                <span className="font-medium">{t.name}</span>
                <span className="text-gray-400 text-sm ml-2">{t.plan}</span>
              </div>
              <span className="text-green-500 text-sm flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                All good
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Reset Confirmation Modal */}
      <Modal open={!!resetModal} onClose={() => setResetModal(null)} title="Reset Conversations">
        <p className="text-sm text-gray-600 mb-4">
          This will reset all stuck conversations for this tenant. Active conversations will be unaffected.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setResetModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={handleResetConversations}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600">
            Reset Conversations
          </button>
        </div>
      </Modal>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }) {
  const colors = {
    gray: 'border-gray-200 text-gray-800',
    green: 'border-green-200 text-green-800',
    yellow: 'border-yellow-200 text-yellow-800',
    red: 'border-red-200 text-red-800',
  };
  const iconColors = { gray: 'text-gray-400', green: 'text-green-500', yellow: 'text-yellow-500', red: 'text-red-500' };
  return (
    <div className={`bg-white border ${colors[color]} rounded-lg p-4 text-center`}>
      <svg className={`w-5 h-5 mx-auto mb-1 ${iconColors[color]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function Section({ title, subtitle, color, icon, children }) {
  const borderColors = { red: 'border-red-300', yellow: 'border-yellow-300', green: 'border-green-300' };
  return (
    <div className={`mb-8 border-l-4 ${borderColors[color]} pl-4`}>
      <h2 className="text-lg font-bold flex items-center gap-2">
        <span aria-hidden="true">{icon}</span> {title}
      </h2>
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
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${issue.level === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`} aria-hidden="true"></span>
            <span className="sr-only">{issue.level}:</span>
            <span>{issue.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
