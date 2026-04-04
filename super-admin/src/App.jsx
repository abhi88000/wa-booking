import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import TenantDetail from './pages/TenantDetail';
import Analytics from './pages/Analytics';
import Health from './pages/Health';

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
      <div className="flex h-screen">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 ml-0 sm:ml-64 pt-18 sm:pt-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/tenants/:id" element={<TenantDetail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/health" element={<Health />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function Sidebar({ onLogout }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const links = [
    { to: '/', label: 'Dashboard' },
    { to: '/tenants', label: 'Tenants' },
    { to: '/health', label: 'Health' },
    { to: '/analytics', label: 'Analytics' },
  ];

  return (
    <>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-gray-900 flex items-center justify-between px-4 sm:hidden z-30">
        <span className="font-semibold text-white text-sm">FutureZMinds</span>
        <button onClick={() => setOpen(!open)} className="text-gray-300 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Overlay */}
      {open && <div className="fixed inset-0 bg-black/30 z-30 sm:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-white flex flex-col z-40 transition-transform
        ${open ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0`}>
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">FutureZMinds</h1>
          <p className="text-gray-400 text-sm mt-1">Platform Admin</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {links.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setOpen(false)}
              className={`flex items-center px-4 py-3 rounded-lg transition
                ${location.pathname === link.to 
                  ? 'bg-gray-700 text-white font-medium' 
                  : 'text-gray-300 hover:bg-gray-800'}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button onClick={onLogout}
            className="w-full text-left px-4 py-2 text-gray-400 hover:text-white transition">
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

export default App;
