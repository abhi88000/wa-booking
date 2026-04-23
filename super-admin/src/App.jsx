import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import TenantDetail from './pages/TenantDetail';
import Analytics from './pages/Analytics';
import Health from './pages/Health';
import InviteCodes from './pages/InviteCodes';

function App() {
  const [token, setToken] = useState(localStorage.getItem('platform_token'));

  const handleLogin = (newToken) => {
    localStorage.setItem('platform_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('platform_token');
    setToken(null);
  };

  if (!token) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <ToastProvider>
      <div className="flex h-screen">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 ml-0 sm:ml-64 pt-16 sm:pt-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/tenants/:id" element={<TenantDetail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/health" element={<Health />} />
            <Route path="/invite-codes" element={<InviteCodes />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
      </ToastProvider>
    </BrowserRouter>
  );
}

function Sidebar({ onLogout }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
  const links = [
    { to: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { to: '/tenants', label: 'Tenants', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { to: '/health', label: 'Health', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { to: '/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { to: '/invite-codes', label: 'Invite Codes', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
  ];

  return (
    <>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:hidden z-30">
        <span className="font-semibold text-gray-900 text-sm">FutureZMinds</span>
        <button onClick={() => setOpen(!open)} aria-label="Toggle menu" className="text-gray-500 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            {open ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Overlay */}
      {open && <div className="fixed inset-0 bg-black/20 z-30 sm:hidden" role="presentation" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside aria-label="Main navigation" className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-40 transition-transform
        ${open ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0`}>
        <div className="p-5 border-b border-gray-100">
          <h1 className="text-base font-semibold text-gray-900">FutureZMinds</h1>
          <p className="text-gray-400 text-[11px] mt-0.5">Platform Admin</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {links.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setOpen(false)}
              aria-current={isActive(link.to) ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm
                ${isActive(link.to)
                  ? 'bg-gray-100 text-gray-900 font-medium' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
              <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
              </svg>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={onLogout}
            className="w-full text-left px-3 py-2 text-gray-400 hover:text-gray-600 transition text-sm">
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}

export default App;
