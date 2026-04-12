import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

export default function TenantDetail() {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [savingFeatures, setSavingFeatures] = useState(false);

  // Module definitions � the 4 core WhatsApp solutions
  const MODULES = [
    { key: 'booking', label: 'Appointment Booking', desc: 'Menu-driven doctor/service/date/time booking' },
    { key: 'payment_collection', label: 'Payments & Invoicing', desc: 'Send payment links, collect payments via WhatsApp' },
    { key: 'ai_chatbot', label: 'AI Chatbot', desc: 'GPT-powered assistant for FAQs and queries' },
    { key: 'broadcast', label: 'Broadcast & Marketing', desc: 'Bulk template messages, promos, announcements' },
  ];

  // Extra feature flags
  const EXTRA_FEATURES = [
    { key: 'multi_doctor', label: 'Multi Doctor' },
    { key: 'reminders', label: 'Reminders' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'custom_branding', label: 'Custom Branding' },
  ];

  useEffect(() => {
    api.getTenant(id)
      .then(({ data }) => setTenant(data))
      .catch(console.error)
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

  const handleFeatureToggle = async (key) => {
    const current = tenant.features || {};
    const updated = { [key]: !current[key] };
    setSavingFeatures(true);
    try {
      const { data } = await api.updateFeatures(id, updated);
      setTenant({ ...tenant, features: data.features });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update feature');
    } finally { setSavingFeatures(false); }
  };

  if (loading) return <div className="text-gray-500 text-center py-20">Loading...</div>;
  if (!tenant) return <div className="text-red-500 text-center py-20">Tenant not found</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/tenants" className="text-gray-400 hover:text-gray-600">? Back</Link>
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
            <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{tenant.phone || '�'}</dd></div>
            <div><dt className="text-gray-500">City</dt><dd className="font-medium">{tenant.city || '�'}</dd></div>
            <div><dt className="text-gray-500">Slug</dt><dd className="font-medium">{tenant.slug}</dd></div>
            <div><dt className="text-gray-500">Timezone</dt><dd className="font-medium">{tenant.timezone}</dd></div>
            <div><dt className="text-gray-500">Joined</dt><dd className="font-medium">{new Date(tenant.created_at).toLocaleString()}</dd></div>
          </dl>
        </div>

        {/* WhatsApp Config */}
        <div className="bg-white rounded-lg shadow-none p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">WhatsApp</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd><span className={`px-2 py-1 rounded-full text-xs font-medium 
                ${tenant.wa_status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {tenant.wa_status}
              </span></dd>
            </div>
            <div><dt className="text-gray-500">Phone Number</dt><dd className="font-medium">{tenant.wa_phone_number || '�'}</dd></div>
            <div><dt className="text-gray-500">Phone Number ID</dt><dd className="font-medium text-xs">{tenant.wa_phone_number_id || '�'}</dd></div>
            <div><dt className="text-gray-500">WABA ID</dt><dd className="font-medium text-xs">{tenant.wa_business_account_id || '�'}</dd></div>
            <div><dt className="text-gray-500">Access Token</dt><dd className="font-medium">{tenant.wa_access_token || '�'}</dd></div>
            <div><dt className="text-gray-500">Onboarding</dt><dd className="font-medium capitalize">{tenant.onboarding_status}</dd></div>
          </dl>
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
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Max Doctors</span>
              <span className="text-sm">{tenant.max_doctors}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Max Appts/Month</span>
              <span className="text-sm">{tenant.max_appointments_month}</span>
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
        </div>
      </div>

      {/* Features */}
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

      {/* WhatsApp Modules */}
      <div className="mt-6 bg-white rounded-lg shadow-none p-6 border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-1">WhatsApp Modules</h2>
        <p className="text-xs text-gray-400 mb-4">Toggle which solutions this tenant can use</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MODULES.map(mod => {
            const enabled = tenant.features?.[mod.key] === true;
            return (
              <div key={mod.key} className={`flex items-center justify-between p-4 rounded-lg border ${enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div>
                  <p className={`text-sm font-medium ${enabled ? 'text-green-800' : 'text-gray-500'}`}>{mod.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{mod.desc}</p>
                </div>
                <button onClick={() => handleFeatureToggle(mod.key)} disabled={savingFeatures}
                  className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Extra Features */}
      <div className="mt-6 bg-white rounded-lg shadow-none p-6 border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Additional Features</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {EXTRA_FEATURES.map(feat => {
            const enabled = tenant.features?.[feat.key] === true;
            return (
              <div key={feat.key} className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-50">
                <span className={`text-sm ${enabled ? 'text-green-700' : 'text-gray-400'}`}>{feat.label}</span>
                <button onClick={() => handleFeatureToggle(feat.key)} disabled={savingFeatures}
                  className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
