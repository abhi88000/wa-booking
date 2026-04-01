import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Doctors from './pages/Doctors';
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
    setToken(null);
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
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 ml-0 sm:ml-64 pt-18 sm:pt-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Sidebar({ onLogout }) {
  const location = useLocation();
  const tenantInfo = JSON.parse(localStorage.getItem('tenant_info') || '{}');
  const [open, setOpen] = useState(false);
  
  const links = [
    { to: '/', label: 'Dashboard' },
    { to: '/appointments', label: 'Appointments' },
    { to: '/doctors', label: 'Doctors' },
    { to: '/patients', label: 'Patients' },
    { to: '/settings', label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b flex items-center justify-between px-4 sm:hidden z-30">
        <span className="font-semibold text-gray-900 text-sm">{tenantInfo.businessName || 'My Business'}</span>
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
        <div className="p-6 border-b">
          <h1 className="text-lg font-bold text-gray-900">
            {tenantInfo.businessName || 'My Business'}
          </h1>
          <p className="text-gray-400 text-xs mt-1">Appointment Manager</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {links.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setOpen(false)}
              className={`flex items-center px-4 py-3 rounded-lg transition text-sm
                ${location.pathname === link.to 
                  ? 'bg-indigo-50 text-indigo-700 font-medium' 
                  : 'text-gray-600 hover:bg-gray-50'}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t">
          <button onClick={onLogout}
            className="w-full text-left px-4 py-2 text-gray-400 hover:text-gray-600 transition text-sm">
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default App;
