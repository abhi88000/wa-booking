import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Doctors from './pages/Doctors';
import Services from './pages/Services';
import Patients from './pages/Patients';
import Settings from './pages/Settings';
import FlowBuilder from './pages/FlowBuilder';
import Inbox from './pages/Inbox';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import DataDeletion from './pages/DataDeletion';
import { ClinicProvider, useClinic } from './ClinicContext';
import Icon from './components/Icons';

function App() {
  const [token, setToken] = useState(localStorage.getItem('tenant_token'));

  const handleLogin = (newToken) => {
    localStorage.setItem('tenant_token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('tenant_token');
    localStorage.removeItem('tenant_info');
    localStorage.removeItem('tenant_user');
    setToken(null);
  };

  if (!token) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="/signup" element={<Signup onLogin={handleLogin} />} />
          <Route path="*" element={<Login onLogin={handleLogin} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <ClinicProvider>
      <div className="flex h-screen">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 bg-gray-50 ml-0 sm:ml-64 pt-18 sm:pt-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/services" element={<Services />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/flow-builder" element={<FlowBuilder />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
      </ClinicProvider>
    </BrowserRouter>
  );
}

function Sidebar({ onLogout }) {
  const location = useLocation();
  const tenantInfo = JSON.parse(localStorage.getItem('tenant_info') || '{}');
  const tenantLabels = JSON.parse(localStorage.getItem('tenant_labels') || '{}');
  const [open, setOpen] = useState(false);
  const { clinic, clinics, setClinic, clinicLabel } = useClinic();

  const staffLabel = tenantLabels.staff || 'Team';
  const customerLabel = tenantLabels.customer || 'Contacts';
  const bookingLabel = tenantLabels.booking || 'Bookings';
  
  const links = [
    { to: '/', label: 'Dashboard', icon: 'dashboard' },
    { to: '/appointments', label: bookingLabel + 's', icon: 'calendar' },
    { to: '/doctors', label: staffLabel + 's', icon: 'userCircle' },
    { to: '/services', label: 'Services', icon: 'package' },
    { to: '/patients', label: customerLabel + 's', icon: 'users' },
    { to: '/flow-builder', label: 'Flow Builder', icon: 'bot' },
    { to: '/inbox', label: 'Inbox', icon: 'messageCircle' },
    { to: '/settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:hidden z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-base font-black tracking-tight text-[#0f172a]">
            Future<span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #25D366, #128C7E)' }}>Z</span>Minds
          </span>
        </div>
        <button onClick={() => setOpen(!open)} className="text-gray-700 p-1" aria-label={open ? 'Close menu' : 'Open menu'}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            {open ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Overlay */}
      {open && <div className="fixed inset-0 bg-black/30 z-30 sm:hidden" onClick={() => setOpen(false)} role="presentation" />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-100 flex flex-col z-40 transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0`}
        aria-label="Main navigation">

        <div className="p-4 border-b border-gray-100">
          <div className="mb-3">
            <span className="text-lg font-black tracking-tight text-[#0f172a]">
              Future<span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #25D366, #128C7E)' }}>Z</span>Minds
            </span>
          </div>
          <div>
            <h1 className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
              {tenantInfo.businessName || 'My Business'}
            </h1>
            <p className="text-gray-400 text-[10px] mt-0.5">WhatsApp Automation</p>
          </div>
          {clinics.length > 1 && (
            <select value={clinic} onChange={e => setClinic(e.target.value)}
              className="mt-3 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 text-gray-700 bg-gray-50 transition-colors">
              <option value="all">All Clinics</option>
              {clinics.map((c, i) => (
                <option key={i} value={clinicLabel(c)}>{clinicLabel(c)}</option>
              ))}
            </select>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {links.map(link => {
            const active = location.pathname === link.to;
            return (
              <Link key={link.to} to={link.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm
                  ${active
                    ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'}`}>
                <Icon name={link.icon} className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-emerald-600' : 'text-gray-400'}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={onLogout}
            className="w-full text-left px-3 py-2 text-gray-400 hover:text-red-500 transition-colors duration-200 text-sm font-medium rounded-lg hover:bg-red-50">
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}

export default App;
