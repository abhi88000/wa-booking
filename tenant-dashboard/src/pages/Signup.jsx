import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Signup({ onLogin }) {
  const [form, setForm] = useState({
    businessName: '', businessType: 'clinic', ownerName: '',
    email: '', phone: '', password: '', city: '', inviteCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.signup(form);
      localStorage.setItem('tenant_info', JSON.stringify(data.tenant));
      onLogin(data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded-xl shadow-md p-6 sm:p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-gray-500 mt-2 text-sm">Set up your appointment booking system</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invite Code</label>
            <input name="inviteCode" value={form.inviteCode} onChange={handleChange}
              placeholder="e.g. FZM-8K2X-NP4R-2026"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400 text-sm" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input name="businessName" value={form.businessName} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
              <select name="businessType" value={form.businessType} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400 text-sm">
                <option value="clinic">Clinic</option>
                <option value="dental">Dental</option>
                <option value="salon">Salon</option>
                <option value="spa">Spa</option>
                <option value="consulting">Consulting</option>
                <option value="veterinary">Veterinary</option>
                <option value="physiotherapy">Physiotherapy</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name</label>
            <input name="ownerName" value={form.ownerName} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400 text-sm" required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400 text-sm"
                minLength={8} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input name="city" value={form.city} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-400 text-sm" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-slate-800 text-white py-3 rounded-lg font-medium hover:bg-slate-900 disabled:opacity-50 transition text-sm">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-slate-700 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
