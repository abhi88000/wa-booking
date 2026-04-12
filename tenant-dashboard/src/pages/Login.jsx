import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState(null);
  const [user, setUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.login(email, password);

      // Multiple branches — show picker
      if (data.requiresBranchSelection) {
        setBranches(data.tenants);
        setUser(data.user);
        setLoading(false);
        return;
      }

      completLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  const selectBranch = async (tenantId) => {
    setLoading(true); setError('');
    try {
      const { data } = await api.login(email, password, tenantId);
      completLogin(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to select branch');
    } finally { setLoading(false); }
  };

  const completLogin = (data) => {
    localStorage.setItem('tenant_info', JSON.stringify(data.tenant));
    if (data.tenants) localStorage.setItem('tenant_branches', JSON.stringify(data.tenants));
    if (data.user) localStorage.setItem('tenant_user', JSON.stringify(data.user));
    onLogin(data.token);
  };

  // Branch selection screen
  if (branches) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow-md p-6 sm:p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Select Branch</h1>
            <p className="text-gray-400 mt-1 text-sm">Welcome back, {user?.name || email}</p>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          <div className="space-y-2">
            {branches.map(b => (
              <button key={b.id} onClick={() => selectBranch(b.id)} disabled={loading}
                className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center justify-between group">
                <div>
                  <p className="font-medium text-gray-900">{b.businessName}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>
          <button onClick={() => { setBranches(null); setUser(null); }}
            className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 transition">
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-md p-6 sm:p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500 mt-2 text-sm">Sign in to manage your appointments</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-slate-400 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-slate-400 outline-none" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-slate-800 text-white py-3 rounded-lg font-medium hover:bg-slate-900 disabled:opacity-50 transition">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/signup" className="text-slate-700 hover:underline font-medium">Sign up</Link>
        </p>
        <p className="text-center mt-3 text-xs text-gray-400">
          Forgot your password?{' '}
          <a href="mailto:support@futurezminds.in" className="text-slate-600 hover:underline">Contact support</a>
        </p>
      </div>
    </div>
  );
}
