import { useState, useEffect } from 'react';
import api from '../api';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  if (loading) return <div className="text-gray-500 text-center py-20">Loading...</div>;
  if (!settings) return <div className="text-red-500 text-center py-20">Failed to load settings</div>;

  const s = settings.settings || {};

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Business Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 border mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Business Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Business Name</label>
            <input value={settings.business_name} onChange={e => setSettings({...settings, business_name: e.target.value})}
              className="w-full border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
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

      {/* Booking Settings */}
      <div className="bg-white rounded-xl shadow-sm p-6 border mb-6">
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
              className="w-4 h-4 text-indigo-600" />
            <label htmlFor="autoConfirm" className="text-sm">Auto-confirm appointments</label>
          </div>
        </div>
      </div>

      {/* WhatsApp Status */}
      <div className="bg-white rounded-xl shadow-sm p-6 border mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">WhatsApp Connection</h2>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium
            ${settings.wa_status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {settings.wa_status === 'connected' ? '✅ Connected' : '⚠️ Not Connected'}
          </span>
          {settings.wa_phone_number && (
            <span className="text-sm text-gray-500">{settings.wa_phone_number}</span>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="bg-white rounded-xl shadow-sm p-6 border mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Your Features</h2>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(settings.features || {}).map(([key, enabled]) => (
            <div key={key} className={`text-sm px-3 py-2 rounded ${enabled ? 'text-green-700' : 'text-gray-400'}`}>
              {enabled ? '✅' : '🔒'} {key.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
