import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // WhatsApp form
  const [waForm, setWaForm] = useState({
    phoneNumberId: '', businessAccountId: '', accessToken: '', displayPhone: ''
  });

  // Business setup form
  const [doctors, setDoctors] = useState([{ name: '', specialization: '', consultationFee: 0, slotDuration: 30, availability: [] }]);
  const [services, setServices] = useState([{ name: '', duration: 30, price: 0 }]);

  // Step 1: Connect WhatsApp
  const connectWA = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.connectWhatsApp(waForm);
      setStep(2);
      alert(`WhatsApp connected! Configure this webhook URL in Meta:\n${data.webhookUrl}\nVerify Token: ${data.verifyToken}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Connection failed');
    } finally { setLoading(false); }
  };

  // Step 2: Setup Business
  const setupBusiness = async () => {
    setLoading(true); setError('');
    try {
      await api.setupBusiness({ doctors, services });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed');
    } finally { setLoading(false); }
  };

  // Step 3: Complete
  const completeSetup = async () => {
    await api.completeOnboarding();
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto px-2">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Setup Your Booking System</h1>
      <p className="text-gray-500 mb-6 text-sm">Complete these steps to go live</p>

      {/* Progress */}
      <div className="flex items-center mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${step >= s ? 'bg-slate-800 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step > s ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : s}
            </div>
            {s < 3 && <div className={`w-20 h-1 ${step > s ? 'bg-slate-800' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      {/* Step 1: WhatsApp */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-4">Connect WhatsApp</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enter your WhatsApp Cloud API credentials from the <a href="https://developers.facebook.com" target="_blank" className="text-slate-700 underline">Meta Developer Portal</a>
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number ID</label>
              <input value={waForm.phoneNumberId} onChange={e => setWaForm({...waForm, phoneNumberId: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="e.g. 123456789012345" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Business Account ID</label>
              <input value={waForm.businessAccountId} onChange={e => setWaForm({...waForm, businessAccountId: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="e.g. 123456789012345" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Permanent Access Token</label>
              <input type="password" value={waForm.accessToken} onChange={e => setWaForm({...waForm, accessToken: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp Phone Number</label>
              <input value={waForm.displayPhone} onChange={e => setWaForm({...waForm, displayPhone: e.target.value})}
                className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="e.g. +919876543210" />
            </div>
            <button onClick={connectWA} disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Connecting...' : 'Connect WhatsApp'}
            </button>
            <button onClick={() => setStep(2)} className="w-full text-gray-400 text-sm hover:text-gray-600">
              Skip for now →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Business Setup */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h2 className="text-lg font-semibold mb-4">Setup Your Business</h2>
          
          {/* Doctors */}
          <h3 className="font-medium text-gray-700 mb-2">Doctors / Practitioners</h3>
          {doctors.map((doc, i) => (
            <div key={i} className="border rounded-lg p-4 mb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Doctor name" value={doc.name}
                  onChange={e => { const d = [...doctors]; d[i].name = e.target.value; setDoctors(d); }}
                  className="border rounded px-3 py-2 text-sm outline-none" />
                <input placeholder="Specialization" value={doc.specialization}
                  onChange={e => { const d = [...doctors]; d[i].specialization = e.target.value; setDoctors(d); }}
                  className="border rounded px-3 py-2 text-sm outline-none" />
              </div>
            </div>
          ))}
          <button onClick={() => setDoctors([...doctors, { name: '', specialization: '', consultationFee: 0, slotDuration: 30 }])}
            className="text-slate-700 text-sm mb-6 hover:underline">+ Add Doctor</button>

          {/* Services */}
          <h3 className="font-medium text-gray-700 mb-2 mt-4">Services</h3>
          {services.map((svc, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input placeholder="Service name" value={svc.name}
                onChange={e => { const s = [...services]; s[i].name = e.target.value; setServices(s); }}
                className="border rounded px-3 py-2 text-sm outline-none" />
              <input type="number" placeholder="Duration (min)" value={svc.duration}
                onChange={e => { const s = [...services]; s[i].duration = parseInt(e.target.value); setServices(s); }}
                className="border rounded px-3 py-2 text-sm outline-none" />
              <input type="number" placeholder="Price (₹)" value={svc.price}
                onChange={e => { const s = [...services]; s[i].price = parseInt(e.target.value); setServices(s); }}
                className="border rounded px-3 py-2 text-sm outline-none" />
            </div>
          ))}
          <button onClick={() => setServices([...services, { name: '', duration: 30, price: 0 }])}
            className="text-slate-700 text-sm mb-6 hover:underline">+ Add Service</button>

          <button onClick={setupBusiness} disabled={loading}
            className="w-full bg-slate-800 text-white py-3 rounded-lg font-medium hover:bg-slate-900 disabled:opacity-50 mt-4">
            {loading ? 'Setting up...' : 'Save & Continue'}
          </button>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm p-8 border text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're All Set</h2>
          <p className="text-gray-500 mb-6">
            Your WhatsApp booking system is ready. Patients can now message your WhatsApp number to book appointments.
          </p>
          <button onClick={completeSetup}
            className="bg-slate-800 text-white px-8 py-3 rounded-lg font-medium hover:bg-slate-900">
            Go to Dashboard →
          </button>
        </div>
      )}
    </div>
  );
}
