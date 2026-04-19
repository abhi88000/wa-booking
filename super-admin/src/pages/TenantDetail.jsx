import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [waConfig, setWaConfig] = useState({ wa_phone_number: '', wa_phone_number_id: '', wa_business_account_id: '', wa_access_token: '' });
  const [savingWA, setSavingWA] = useState(false);
  const [waMsg, setWaMsg] = useState('');
  const [deleting, setDeleting] = useState(false);

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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleToggle = async () => {
    await api.toggleTenant(id);
    const { data } = await api.getTenant(id);
    setTenant(data);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setResetMsg('Password must be at least 8 characters');
      return;
    }
    try {
      const { data } = await api.resetPassword(id, newPassword);
      setResetMsg(`Password reset for ${data.email}`);
      setNewPassword('');
    } catch (err) {
      setResetMsg(err.response?.data?.error || 'Reset failed');
    }
  };

  const handleSaveWAConfig = async () => {
    setSavingWA(true);
    setWaMsg('');
    try {
      const payload = {};
      if (waConfig.wa_phone_number) payload.wa_phone_number = waConfig.wa_phone_number;
      if (waConfig.wa_phone_number_id) payload.wa_phone_number_id = waConfig.wa_phone_number_id;
      if (waConfig.wa_business_account_id) payload.wa_business_account_id = waConfig.wa_business_account_id;
      if (waConfig.wa_access_token) payload.wa_access_token = waConfig.wa_access_token;
      if (Object.keys(payload).length === 0) { setWaMsg('No changes'); setSavingWA(false); return; }
      await api.updateWAConfig(id, payload);
      setWaMsg('WhatsApp config updated');
      const { data } = await api.getTenant(id);
      setTenant(data);
      setWaConfig(c => ({ ...c, wa_access_token: '' }));
    } catch (err) {
      setWaMsg(err.response?.data?.error || 'Failed to update');
    } finally { setSavingWA(false); }
  };

  const handleDeleteTenant = async () => {
    const name = tenant.business_name;
    const confirm1 = window.confirm(`Delete tenant "${name}"? This will permanently remove ALL their data.`);
    if (!confirm1) return;
    const confirm2 = window.prompt(`Type "${name}" to confirm deletion:`);
    if (confirm2 !== name) { alert('Name did not match. Deletion cancelled.'); return; }
    setDeleting(true);
    try {
      await api.deleteTenant(id);
      alert(`Tenant "${name}" deleted successfully.`);
      navigate('/tenants');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete tenant');
      setDeleting(false);
    }
  };

  if (loading) return <div className="text-gray-500 text-center py-20">Loading...</div>;
  if (!tenant) return <div className="text-red-500 text-center py-20">Tenant not found</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/tenants" className="text-gray-400 hover:text-gray-600">&larr; Back</Link>
        <h1 className="text-lg font-semibold text-gray-900">{tenant.business_name}</h1>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${tenant.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {tenant.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Info */}
        <div className="bg-white rounded-lg shadow-none p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Business Info</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-gray-500">Type</dt><dd className="font-medium capitalize">{tenant.business_type}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{tenant.email}</dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{tenant.phone || '—'}</dd></div>
            <div><dt className="text-gray-500">City</dt><dd className="font-medium">{tenant.city || '—'}</dd></div>
            <div><dt className="text-gray-500">Slug</dt><dd className="font-medium">{tenant.slug}</dd></div>
            <div><dt className="text-gray-500">Timezone</dt><dd className="font-medium">{tenant.timezone}</dd></div>
            <div><dt className="text-gray-500">Joined</dt><dd className="font-medium">{new Date(tenant.created_at).toLocaleString()}</dd></div>
          </dl>
        </div>

        {/* WhatsApp Config */}
        <div className="bg-white rounded-lg shadow-none p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">WhatsApp</h2>
          <dl className="space-y-3 text-sm mb-4">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd><span className={`px-2 py-1 rounded-full text-xs font-medium 
                ${tenant.wa_status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {tenant.wa_status}
              </span></dd>
            </div>
            <div><dt className="text-gray-500">Onboarding</dt><dd className="font-medium capitalize">{tenant.onboarding_status}</dd></div>
          </dl>

          <hr className="my-4 border-gray-100" />
          <h3 className="text-sm font-medium text-gray-700 mb-3">Configure Credentials</h3>
          {waMsg && <p className="text-xs text-slate-600 mb-2">{waMsg}</p>}
          <div className="space-y-2">
            <input type="text" placeholder="Phone Number (e.g. +91...)" value={waConfig.wa_phone_number}
              onChange={e => setWaConfig({ ...waConfig, wa_phone_number: e.target.value })}
              className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gray-400" />
            <input type="text" placeholder="Phone Number ID" value={waConfig.wa_phone_number_id}
              onChange={e => setWaConfig({ ...waConfig, wa_phone_number_id: e.target.value })}
              className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gray-400" />
            <input type="text" placeholder="WABA ID" value={waConfig.wa_business_account_id}
              onChange={e => setWaConfig({ ...waConfig, wa_business_account_id: e.target.value })}
              className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gray-400" />
            <input type="password" placeholder="Access Token (leave empty to keep current)"
              value={waConfig.wa_access_token}
              onChange={e => setWaConfig({ ...waConfig, wa_access_token: e.target.value })}
              className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gray-400" />
            <button onClick={handleSaveWAConfig} disabled={savingWA}
              className="bg-slate-800 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-slate-900 disabled:opacity-50">
              {savingWA ? 'Saving...' : 'Save WA Config'}
            </button>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="bg-white rounded-lg shadow-none p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Usage</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Appointments</span>
              <span className="text-xl font-bold">{tenant.total_appointments}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Patients</span>
              <span className="text-xl font-bold">{tenant.total_patients}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Active Doctors</span>
              <span className="text-xl font-bold">{tenant.active_doctors}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 bg-white rounded-lg shadow-none p-6 border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button onClick={handleToggle}
            className={`px-4 py-2 rounded-lg text-sm ${tenant.is_active 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
            {tenant.is_active ? 'Deactivate Tenant' : 'Activate Tenant'}
          </button>
          <button onClick={handleDeleteTenant} disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete Tenant'}
          </button>
        </div>
      </div>

      {/* Reset Password */}
      <div className="mt-6 bg-white rounded-lg shadow-none p-6 border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Reset User Password</h2>
        {resetMsg && <p className="text-sm mb-3 text-slate-700">{resetMsg}</p>}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
            placeholder="Enter new password (min 8 chars)"
            className="border rounded-lg px-4 py-2 text-sm w-full sm:w-72 outline-none focus:border-gray-400" />
          <button onClick={handleResetPassword}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900">
            Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}
