import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import api from './api';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Doctors from './pages/Doctors';
import Services from './pages/Services';
import Patients from './pages/Patients';
import Settings from './pages/Settings';

function App() {
  const [token, setToken] = useState(localStorage.getItem('tenant_token'));

  const handleLogin = (newToken) => {
    localStorage.setItem('tenant_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('tenant_token');
    localStorage.removeItem('tenant_info');
    localStorage.removeItem('tenant_branches');
    localStorage.removeItem('tenant_user');
    setToken(null);
  };

  const handleBranchSwitch = (newToken, tenantInfo, branches) => {
    localStorage.setItem('tenant_token', newToken);
    localStorage.setItem('tenant_info', JSON.stringify(tenantInfo));
    if (branches) localStorage.setItem('tenant_branches', JSON.stringify(branches));
    setToken(newToken);
    window.location.href = '/';
  };

  if (!token) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/signup" element={<Signup onLogin={handleLogin} />} />
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen">
        <Sidebar onLogout={handleLogout} onBranchSwitch={handleBranchSwitch} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 ml-0 sm:ml-64 pt-18 sm:pt-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/services" element={<Services />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Sidebar({ onLogout, onBranchSwitch }) {
  const location = useLocation();
  const tenantInfo = JSON.parse(localStorage.getItem('tenant_info') || '{}');
  const branches = JSON.parse(localStorage.getItem('tenant_branches') || '[]');
  const userInfo = JSON.parse(localStorage.getItem('tenant_user') || '{}');
  const [open, setOpen] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [switching, setSwitching] = useState(false);
  
  const links = [
    { to: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { to: '/appointments', label: 'Appointments', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', feature: 'booking' },
    { to: '/doctors', label: 'Doctors', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', feature: 'booking' },
    { to: '/services', label: 'Services', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', feature: 'booking' },
    { to: '/patients', label: 'Patients', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { to: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  const features = tenantInfo.features || {};
  const visibleLinks = links.filter(l => !l.feature || features[l.feature] === true);
  const hasBranches = branches.length > 1;

  const switchBranch = async (branchId) => {
    if (branchId === tenantInfo.id) { setShowBranches(false); return; }
    setSwitching(true);
    try {
      const { data } = await api.switchBranch(branchId, userInfo.email);
      setShowBranches(false);
      onBranchSwitch(data.token, data.tenant, data.tenants);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to switch');
    } finally { setSwitching(false); }
  };

  return (
    <>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b flex items-center justify-between px-4 sm:hidden z-30">
        <span className="font-semibold text-gray-900 text-sm truncate">{tenantInfo.businessName || 'My Business'}</span>
        <button onClick={() => setOpen(!open)} className="text-gray-600 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Overlay */}
      {open && <div className="fixed inset-0 bg-black/30 z-30 sm:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-40 transition-transform
        ${open ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0`}>

        {/* Branch Header */}
        <div className="p-4 border-b">
          <button
            onClick={() => hasBranches && setShowBranches(!showBranches)}
            className={`w-full text-left ${hasBranches ? 'cursor-pointer' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-gray-900 truncate">
                  {tenantInfo.businessName || 'My Business'}
                </h1>
                <p className="text-gray-400 text-[11px] mt-0.5">
                  {hasBranches ? `${branches.length} branches` : 'WhatsApp Solutions'}
                </p>
              </div>
              {hasBranches && (
                <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${showBranches ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              )}
            </div>
          </button>

          {/* Branch Dropdown */}
          {showBranches && (
            <div className="mt-2 border border-gray-100 rounded-lg overflow-hidden">
              {branches.map(b => (
                <button key={b.id}
                  onClick={() => switchBranch(b.id)}
                  disabled={switching}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors
                    ${b.id === tenantInfo.id ? 'bg-slate-50 text-slate-800 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span className="truncate">{b.businessName}</span>
                  {b.id === tenantInfo.id && (
                    <svg className="w-3.5 h-3.5 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              ))}
              <button onClick={() => { setShowBranches(false); setShowAddBranch(true); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-t border-gray-50 transition-colors">
                + Add branch
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleLinks.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm
                ${location.pathname === link.to 
                  ? 'bg-slate-100 text-slate-800 font-medium' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
              <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
              </svg>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          {!hasBranches && (
            <button onClick={() => setShowAddBranch(true)}
              className="w-full text-left px-3 py-2 text-gray-400 hover:text-gray-600 transition text-xs mb-1">
              + Add another branch
            </button>
          )}
          <button onClick={onLogout}
            className="w-full text-left px-3 py-2 text-gray-400 hover:text-gray-600 transition text-sm">
            Log out
          </button>
        </div>
      </aside>

      {/* Add Branch Modal */}
      {showAddBranch && (
        <AddBranchModal
          onClose={() => setShowAddBranch(false)}
          onCreated={(data) => {
            localStorage.setItem('tenant_branches', JSON.stringify(data.tenants));
            setShowAddBranch(false);
            // Optionally switch to the new branch
            if (confirm('Branch created! Switch to it now?')) {
              switchBranch(data.tenant.id);
            }
          }}
        />
      )}
    </>
  );
}

function AddBranchModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ businessName: '', businessType: 'clinic', phone: '', city: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const { data } = await api.addBranch(form);
      onCreated(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create branch');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-gray-900">Add New Branch</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-3 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Branch Name</label>
            <input placeholder="e.g. Downtown Clinic" value={form.businessName}
              onChange={e => setForm({...form, businessName: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Type</label>
            <select value={form.businessType} onChange={e => setForm({...form, businessType: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400">
              <option value="clinic">Clinic</option>
              <option value="salon">Salon</option>
              <option value="dental">Dental</option>
              <option value="spa">Spa</option>
              <option value="consulting">Consulting</option>
              <option value="veterinary">Veterinary</option>
              <option value="physiotherapy">Physiotherapy</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Phone</label>
              <input placeholder="+91..." value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">City</label>
              <input placeholder="City" value={form.city}
                onChange={e => setForm({...form, city: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
            <button type="submit" disabled={saving}
              className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
