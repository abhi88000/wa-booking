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
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
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
  
  const links = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/appointments', label: 'Appointments', icon: '📅' },
    { to: '/doctors', label: 'Doctors', icon: '👨‍⚕️' },
    { to: '/patients', label: 'Patients', icon: '👥' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-lg font-bold text-gray-900">
          {tenantInfo.businessName || 'My Business'}
        </h1>
        <p className="text-gray-400 text-xs mt-1">Appointment Manager</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(link => (
          <Link key={link.to} to={link.to}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition text-sm
              ${location.pathname === link.to 
                ? 'bg-indigo-50 text-indigo-700 font-medium' 
                : 'text-gray-600 hover:bg-gray-50'}`}>
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <button onClick={onLogout}
          className="w-full text-left px-4 py-2 text-gray-400 hover:text-gray-600 transition text-sm">
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}

export default App;
