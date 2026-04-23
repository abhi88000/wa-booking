import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [waConfig, setWaConfig] = useState({ wa_phone_number: '', wa_phone_number_id: '', wa_business_account_id: '', wa_access_token: '' });
  const [savingWA, setSavingWA] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [tab, setTab] = useState('info');

  useEffect(() => {
    api.getTenant(id)
      .then(({ data }) => {
        setTenant(data);
        setWaConfig({
          wa_phone_number: data.wa_phone_number || '',
          wa_phone_number_id: data.wa_phone_number_id || '',
          wa_business_account_id: data.wa_business_account_id || '',
          wa_access_token: ''
        });
      })
      .catch(() => showError('Failed to load tenant'))
      .finally(() => setLoading(false));
  }, [id, showError]);

  const handleToggle = async () => {
    try {
      await api.toggleTenant(id);
      const { data } = await api.getTenant(id);
      setTenant(data);
      success(`Tenant ${data.is_active ? 'activated' : 'deactivated'}`);
    } catch { showError('Failed to toggle tenant'); }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }
    try {
      const { data } = await api.resetPassword(id, newPassword);
      success(`Password reset for ${data.email}`);
      setNewPassword('');
    } catch (err) {
      showError(err.response?.data?.error || 'Reset failed');
    }
  };

  const handleSaveWAConfig = async () => {
    setSavingWA(true);
    try {
      const payload = {};
      if (waConfig.wa_phone_number) payload.wa_phone_number = waConfig.wa_phone_number;
      if (waConfig.wa_phone_number_id) payload.wa_phone_number_id = waConfig.wa_phone_number_id;
      if (waConfig.wa_business_account_id) payload.wa_business_account_id = waConfig.wa_business_account_id;
      if (waConfig.wa_access_token) payload.wa_access_token = waConfig.wa_access_token;
      if (Object.keys(payload).length === 0) { showError('No changes to save'); setSavingWA(false); return; }
      await api.updateWAConfig(id, payload);
      success('WhatsApp config updated');
      const { data } = await api.getTenant(id);
      setTenant(data);
      setWaConfig(c => ({ ...c, wa_access_token: '' }));
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to update');
    } finally { setSavingWA(false); }
  };

  const handleDeleteTenant = async () => {
    if (deleteConfirm !== tenant.business_name) {
      showError('Business name does not match');
      return;
    }
    setDeleting(true);
    try {
      await api.deleteTenant(id);
      success(`Tenant "${tenant.business_name}" deleted`);
      navigate('/tenants');
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to delete tenant');
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="bg-white rounded-lg border border-gray-100 h-40 animate-pulse" />)}
    </div>
  );
  if (!tenant) return <div className="text-red-500 text-center py-20">Tenant not found</div>;

  const tabs = [
    { key: 'info', label: 'Business Info' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'usage', label: 'Usage & Actions' },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/tenants" className="text-gray-400 hover:text-gray-600" aria-label="Back to tenants">&larr;</Link>
        <h1 className="text-lg font-semibold text-gray-900">{tenant.business_name}</h1>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${tenant.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {tenant.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit" role="tablist">
        {tabs.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm transition ${tab === t.key ? 'bg-white text-gray-900 font-medium shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Business Info Tab */}
      {tab === 'info' && (
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Business Info</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[
              ['Type', tenant.business_type, 'capitalize'],
              ['Email', tenant.email],
              ['Phone', tenant.phone || '—'],
              ['City', tenant.city || '—'],
              ['Slug', tenant.slug],
              ['Timezone', tenant.timezone],
              ['Joined', new Date(tenant.created_at).toLocaleString()],
            ].map(([label, val, cls]) => (
              <div key={label}>
                <dt className="text-gray-500">{label}</dt>
                <dd className={`font-medium ${cls || ''}`}>{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* WhatsApp Tab */}
      {tab === 'whatsapp' && (
        <div className="bg-white rounded-lg p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-semibold text-gray-900">WhatsApp Configuration</h2>
            <span className={`px-2 py-1 rounded-full text-xs font-medium 
              ${tenant.wa_status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {tenant.wa_status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-1">Onboarding: <span className="capitalize font-medium text-gray-600">{tenant.onboarding_status}</span></p>
          <hr className="my-4 border-gray-100" />
          <div className="space-y-3 max-w-lg">
            <div>
              <label htmlFor="wa-phone" className="block text-xs text-gray-500 mb-1">Phone Number</label>
              <input id="wa-phone" type="text" placeholder="+91..." value={waConfig.wa_phone_number}
                onChange={e => setWaConfig({ ...waConfig, wa_phone_number: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" />
            </div>
            <div>
              <label htmlFor="wa-pnid" className="block text-xs text-gray-500 mb-1">Phone Number ID</label>
              <input id="wa-pnid" type="text" placeholder="Phone Number ID" value={waConfig.wa_phone_number_id}
                onChange={e => setWaConfig({ ...waConfig, wa_phone_number_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" />
            </div>
            <div>
              <label htmlFor="wa-waba" className="block text-xs text-gray-500 mb-1">WABA ID</label>
              <input id="wa-waba" type="text" placeholder="WABA ID" value={waConfig.wa_business_account_id}
                onChange={e => setWaConfig({ ...waConfig, wa_business_account_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" />
            </div>
            <div>
              <label htmlFor="wa-token" className="block text-xs text-gray-500 mb-1">Access Token</label>
              <input id="wa-token" type="password" placeholder="Leave empty to keep current"
                value={waConfig.wa_access_token}
                onChange={e => setWaConfig({ ...waConfig, wa_access_token: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" />
            </div>
            <button onClick={handleSaveWAConfig} disabled={savingWA}
              className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900 disabled:opacity-50">
              {savingWA ? 'Saving...' : 'Save WA Config'}
            </button>
          </div>
        </div>
      )}

      {/* Usage & Actions Tab */}
      {tab === 'usage' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Usage</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                ['Total Appointments', tenant.total_appointments],
                ['Total Patients', tenant.total_patients],
                ['Active Doctors', tenant.active_doctors],
              ].map(([label, val]) => (
                <div key={label} className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{val}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button onClick={handleToggle}
                className={`px-4 py-2 rounded-lg text-sm ${tenant.is_active 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                {tenant.is_active ? 'Deactivate Tenant' : 'Activate Tenant'}
              </button>
              <button onClick={() => { setDeleteModal(true); setDeleteConfirm(''); }}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700">
                Delete Tenant
              </button>
            </div>
          </div>

          {/* Reset Password */}
          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-4">Reset User Password</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 chars)" autoComplete="new-password"
                className="border border-gray-200 rounded-lg px-4 py-2 text-sm w-full sm:w-72 outline-none focus:border-gray-400" />
              <button onClick={handleResetPassword}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900">
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Tenant">
        <p className="text-sm text-gray-600 mb-4">
          This will permanently delete <strong>{tenant.business_name}</strong> and all their data. This cannot be undone.
        </p>
        <div className="mb-4">
          <label htmlFor="delete-confirm" className="block text-xs text-gray-500 mb-1">
            Type <strong>{tenant.business_name}</strong> to confirm
          </label>
          <input id="delete-confirm" type="text" value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={handleDeleteTenant} disabled={deleting || deleteConfirm !== tenant.business_name}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete Forever'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
