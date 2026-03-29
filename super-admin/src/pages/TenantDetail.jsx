import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

export default function TenantDetail() {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('');

  useEffect(() => {
    api.getTenant(id)
      .then(({ data }) => { setTenant(data); setSelectedPlan(data.plan || 'trial'); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handlePlanUpdate = async () => {
    await api.updatePlan(id, { plan: selectedPlan });
    const { data } = await api.getTenant(id);
    setTenant(data);
    alert('Plan updated!');
  };

  const handleToggle = async () => {
    await api.toggleTenant(id);
    const { data } = await api.getTenant(id);
    setTenant(data);
  };

  if (loading) return <div className="text-gray-500 text-center py-20">Loading...</div>;
  if (!tenant) return <div className="text-red-500 text-center py-20">Tenant not found</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/tenants" className="text-gray-400 hover:text-gray-600">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900">{tenant.business_name}</h1>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${tenant.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {tenant.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
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
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">WhatsApp</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd><span className={`px-2 py-1 rounded-full text-xs font-medium 
                ${tenant.wa_status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {tenant.wa_status}
              </span></dd>
            </div>
            <div><dt className="text-gray-500">Phone Number</dt><dd className="font-medium">{tenant.wa_phone_number || '—'}</dd></div>
            <div><dt className="text-gray-500">Phone Number ID</dt><dd className="font-medium text-xs">{tenant.wa_phone_number_id || '—'}</dd></div>
            <div><dt className="text-gray-500">WABA ID</dt><dd className="font-medium text-xs">{tenant.wa_business_account_id || '—'}</dd></div>
            <div><dt className="text-gray-500">Access Token</dt><dd className="font-medium">{tenant.wa_access_token || '—'}</dd></div>
            <div><dt className="text-gray-500">Onboarding</dt><dd className="font-medium capitalize">{tenant.onboarding_status}</dd></div>
          </dl>
        </div>

        {/* Usage Stats */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
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

      {/* Plan Management */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Subscription Management</h2>
        <div className="flex items-center gap-4">
          <div>
            <label className="text-sm text-gray-500">Current Plan</label>
            <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
              className="ml-3 border rounded-lg px-3 py-2 text-sm">
              <option value="trial">Trial</option>
              <option value="starter">Starter (₹999/mo)</option>
              <option value="professional">Professional (₹2,499/mo)</option>
              <option value="enterprise">Enterprise (₹7,999/mo)</option>
            </select>
          </div>
          <button onClick={handlePlanUpdate}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
            Update Plan
          </button>
          <button onClick={handleToggle}
            className={`px-4 py-2 rounded-lg text-sm ${tenant.is_active 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
            {tenant.is_active ? 'Deactivate Tenant' : 'Activate Tenant'}
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Features</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(tenant.features || {}).map(([key, enabled]) => (
            <div key={key} className={`px-4 py-3 rounded-lg text-sm ${enabled ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
              {enabled ? '✅' : '❌'} {key.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
