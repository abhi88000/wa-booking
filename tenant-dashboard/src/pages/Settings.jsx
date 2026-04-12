import { useState, useEffect } from 'react';
import api from '../api';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWaForm, setShowWaForm] = useState(false);
  const [savingWa, setSavingWa] = useState(false);
  const [waForm, setWaForm] = useState({
    phoneNumberId: '', businessAccountId: '', accessToken: '', displayPhone: ''
  });
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phone: '' });
  const [editingBranch, setEditingBranch] = useState(null);

  useEffect(() => {
    api.getSettings()
      .then(({ data }) => setSettings(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        business_name: settings.business_name,
        phone: settings.phone,
        address: settings.address,
        city: settings.city,
        timezone: settings.timezone,
        settings: settings.settings
      });
      alert('Settings saved!');
    } catch (err) {
      alert(err.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleWaConnect = async () => {
    setSavingWa(true);
    try {
      await api.updateWhatsApp(waForm);
      setSettings({ ...settings, wa_status: 'connected', wa_phone_number: waForm.displayPhone });
      setShowWaForm(false);
      setWaForm({ phoneNumberId: '', businessAccountId: '', accessToken: '', displayPhone: '' });
      alert('WhatsApp connected successfully!');
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.details || 'Connection failed');
    } finally { setSavingWa(false); }
  };

  if (loading) return <div className="text-gray-500 text-center py-20">Loading...</div>;
  if (!settings) return <div className="text-red-500 text-center py-20">Failed to load settings</div>;

  const s = settings.settings || {};

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Business Info */}
      <div className="bg-white rounded-lg shadow-sm p-6 border mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Business Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Business Name</label>
            <input value={settings.business_name} onChange={e => setSettings({...settings, business_name: e.target.value})}
              className="w-full border rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input value={settings.phone || ''} onChange={e => setSettings({...settings, phone: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input value={settings.city || ''} onChange={e => setSettings({...settings, city: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea value={settings.address || ''} onChange={e => setSettings({...settings, address: e.target.value})}
              className="w-full border rounded-lg px-4 py-2 text-sm outline-none" rows={2} />
          </div>
        </div>
      </div>

      {/* Branches / Locations */}
      <div className="bg-white rounded-lg shadow-sm p-6 border mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Branches / Locations</h2>
            <p className="text-xs text-gray-400 mt-0.5">Manage your clinic locations. Doctors can be assigned to specific branches.</p>
          </div>
          <button onClick={() => { setShowAddBranch(true); setEditingBranch(null); setBranchForm({ name: '', address: '', phone: '' }); }}
            className="text-sm bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-900">
            + Add Branch
          </button>
        </div>

        {/* Branch List */}
        {(s.branches || []).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No branches added yet. Add your first location above.</p>
        ) : (
          <div className="space-y-2">
            {(s.branches || []).map((branch, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-3 border border-gray-100 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{branch.name}</p>
                  <p className="text-xs text-gray-400">
                    {[branch.address, branch.phone].filter(Boolean).join(' · ') || 'No details added'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setEditingBranch(idx);
                    setBranchForm({ name: branch.name, address: branch.address || '', phone: branch.phone || '' });
                    setShowAddBranch(true);
                  }} className="text-xs text-gray-500 hover:text-gray-700">Edit</button>
                  <button onClick={() => {
                    const updated = (s.branches || []).filter((_, i) => i !== idx);
                    setSettings({ ...settings, settings: { ...s, branches: updated } });
                  }} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Branch Form */}
        {showAddBranch && (
          <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {editingBranch !== null ? 'Edit Branch' : 'Add New Branch'}
            </h3>
            <div className="space-y-3">
              <input placeholder="Branch name (e.g. Main Road Clinic)" value={branchForm.name}
                onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
              <input placeholder="Address (optional)" value={branchForm.address}
                onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
              <input placeholder="Phone (optional)" value={branchForm.phone}
                onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddBranch(false)}
                  className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
                <button onClick={() => {
                  if (!branchForm.name.trim()) return;
                  const branches = [...(s.branches || [])];
                  const entry = { name: branchForm.name.trim(), address: branchForm.address.trim(), phone: branchForm.phone.trim() };
                  if (editingBranch !== null) {
                    branches[editingBranch] = entry;
                  } else {
                    branches.push(entry);
                  }
                  setSettings({ ...settings, settings: { ...s, branches } });
                  setShowAddBranch(false);
                  setBranchForm({ name: '', address: '', phone: '' });
                  setEditingBranch(null);
                }}
                  className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900">
                  {editingBranch !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-3">Click "Save Settings" at the bottom to save your changes.</p>
      </div>

      {/* Booking Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6 border mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Booking Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Welcome Message</label>
            <textarea value={s.welcome_message || ''} rows={3}
              onChange={e => setSettings({...settings, settings: {...s, welcome_message: e.target.value}})}
              className="w-full border rounded-lg px-4 py-2 text-sm outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Booking Window (days ahead)</label>
              <input type="number" value={s.booking_window_days || 14}
                onChange={e => setSettings({...settings, settings: {...s, booking_window_days: parseInt(e.target.value)}})}
                className="w-full border rounded-lg px-4 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Bookings/Day</label>
              <input type="number" value={s.max_bookings_per_day || 50}
                onChange={e => setSettings({...settings, settings: {...s, max_bookings_per_day: parseInt(e.target.value)}})}
                className="w-full border rounded-lg px-4 py-2 text-sm outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="autoConfirm" checked={s.auto_confirm !== false}
              onChange={e => setSettings({...settings, settings: {...s, auto_confirm: e.target.checked}})}
              className="w-4 h-4 text-slate-700" />
            <label htmlFor="autoConfirm" className="text-sm">Auto-confirm appointments</label>
          </div>
        </div>
      </div>

      {/* Payment Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6 border mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Payment Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">UPI ID</label>
            <input value={s.upi_id || ''} placeholder="e.g. clinic@upi or 9876543210@paytm"
              onChange={e => setSettings({...settings, settings: {...s, upi_id: e.target.value}})}
              className="w-full border rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
            <p className="text-xs text-gray-400 mt-1">Patients will be able to pay via UPI after booking. Leave blank to disable.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">UPI Display Name</label>
            <input value={s.upi_display_name || ''} placeholder="e.g. Dr. Sharma Clinic"
              onChange={e => setSettings({...settings, settings: {...s, upi_display_name: e.target.value}})}
              className="w-full border rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
            <p className="text-xs text-gray-400 mt-1">Name shown to the patient in their UPI app</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="sendPaymentAfterBooking" checked={s.send_payment_after_booking === true}
              onChange={e => setSettings({...settings, settings: {...s, send_payment_after_booking: e.target.checked}})}
              className="w-4 h-4 text-slate-700" />
            <label htmlFor="sendPaymentAfterBooking" className="text-sm">Automatically send payment link after booking</label>
          </div>
        </div>
      </div>

      {/* WhatsApp Connection */}
      <div className="bg-white rounded-lg shadow-sm p-6 border mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">WhatsApp Connection</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-medium
            ${settings.wa_status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {settings.wa_status === 'connected' ? 'Connected' : 'Not Connected'}
          </span>
        </div>
        {settings.wa_status === 'connected' && settings.wa_phone_number && (
          <p className="text-sm text-gray-500 mb-4">Current number: {settings.wa_phone_number}</p>
        )}
        {!showWaForm ? (
          <button onClick={() => setShowWaForm(true)}
            className="text-sm text-slate-700 hover:underline">
            {settings.wa_status === 'connected' ? 'Update credentials' : 'Connect WhatsApp'}
          </button>
        ) : (
          <div className="space-y-3 mt-2">
            <p className="text-xs text-gray-500">
              Enter your WhatsApp Cloud API credentials from the <a href="https://developers.facebook.com" target="_blank" className="text-slate-700 underline">Meta Developer Portal</a>
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number ID</label>
              <input value={waForm.phoneNumberId} onChange={e => setWaForm({...waForm, phoneNumberId: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400"
                placeholder="e.g. 123456789012345" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Business Account ID</label>
              <input value={waForm.businessAccountId} onChange={e => setWaForm({...waForm, businessAccountId: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400"
                placeholder="e.g. 123456789012345" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Access Token</label>
              <input type="password" value={waForm.accessToken} onChange={e => setWaForm({...waForm, accessToken: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp Phone Number</label>
              <input value={waForm.displayPhone} onChange={e => setWaForm({...waForm, displayPhone: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 text-sm outline-none focus:border-slate-400"
                placeholder="e.g. +919876543210" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleWaConnect} disabled={savingWa}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {savingWa ? 'Verifying...' : 'Save & Verify'}
              </button>
              <button onClick={() => setShowWaForm(false)}
                className="text-gray-500 text-sm hover:text-gray-700">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="bg-white rounded-lg shadow-sm p-6 border mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Your Features</h2>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(settings.features || {}).map(([key, enabled]) => (
            <div key={key} className={`text-sm px-3 py-2 rounded ${enabled ? 'text-green-700' : 'text-gray-400'}`}>
              {key.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="bg-slate-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-900 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
