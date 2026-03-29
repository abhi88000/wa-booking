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
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
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
  const links = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/tenants', label: 'Tenants', icon: '🏢' },
    { to: '/health', label: 'Health', icon: '🩺' },
    { to: '/analytics', label: 'Analytics', icon: '📈' },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">BookingBot</h1>
        <p className="text-gray-400 text-sm mt-1">Platform Admin</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(link => (
          <Link key={link.to} to={link.to}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition
              ${location.pathname === link.to 
                ? 'bg-indigo-600 text-white' 
                : 'text-gray-300 hover:bg-gray-800'}`}>
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button onClick={onLogout}
          className="w-full text-left px-4 py-2 text-gray-400 hover:text-white transition">
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}

export default App;
