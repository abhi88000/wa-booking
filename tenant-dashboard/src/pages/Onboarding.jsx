import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const FB_APP_ID = import.meta.env.VITE_FB_APP_ID;
const FB_CONFIG_ID = import.meta.env.VITE_FB_CONFIG_ID;

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const navigate = useNavigate();

  // WhatsApp form (manual fallback)
  const [waForm, setWaForm] = useState({
    phoneNumberId: '', businessAccountId: '', accessToken: '', displayPhone: ''
  });

  // Business setup form
  const [doctors, setDoctors] = useState([{ name: '', specialization: '', consultationFee: 0, slotDuration: 30, availability: [] }]);
  const [services, setServices] = useState([{ name: '', price: 0 }]);

  // Initialize Facebook SDK
  useEffect(() => {
    if (!FB_APP_ID) return;
    window.fbAsyncInit = function () {
      window.FB.init({ appId: FB_APP_ID, autoLogAppEvents: true, xfbml: false, version: 'v21.0' });
    };
    // If SDK already loaded, init now; otherwise inject script
    if (window.FB) {
      window.fbAsyncInit();
    } else if (!document.getElementById('facebook-jssdk')) {
      const js = document.createElement('script');
      js.id = 'facebook-jssdk';
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      js.async = true;
      js.defer = true;
      document.body.appendChild(js);
    }
  }, []);

  // Handle Embedded Signup session log message
  const handleEmbeddedMessage = useCallback((event) => {
    if (!event.origin.includes('facebook.com')) return;
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.type === 'WA_EMBEDDED_SIGNUP') {
        if (data.event === 'FINISH') {
          // Phone number selected inside the popup — data has phone_number_id
          console.log('Embedded signup finish data:', data.data);
        } else if (data.event === 'CANCEL') {
          setError('WhatsApp setup was cancelled. You can try again or skip for now.');
        }
      }
    } catch { /* ignore non-JSON messages */ }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleEmbeddedMessage);
    return () => window.removeEventListener('message', handleEmbeddedMessage);
  }, [handleEmbeddedMessage]);

  // Launch Embedded Signup
  const launchEmbeddedSignup = () => {
    if (!window.FB) {
      setError('Facebook SDK not loaded. Please refresh the page or use manual setup.');
      return;
    }
    setError('');
    setLoading(true);

    window.FB.login(
      (response) => {
        setLoading(false);
        if (response.authResponse) {
          const code = response.authResponse.code;
          // Exchange code for credentials on backend
          exchangeCode(code);
        } else {
          setError('WhatsApp connection was cancelled.');
        }
      },
      {
        config_id: FB_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        }
      }
    );
  };

  // Exchange auth code via backend
  const exchangeCode = async (code) => {
    setLoading(true);
    setError('');
    try {
      await api.connectWhatsAppEmbedded({ code });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect WhatsApp. Please try manual setup.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Connect WhatsApp (manual)
  const connectWA = async () => {
    setLoading(true); setError('');
    try {
      await api.connectWhatsApp(waForm);
      setStep(2);
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
          <h2 className="text-lg font-semibold mb-2">Connect WhatsApp</h2>
          <p className="text-sm text-gray-500 mb-6">
            Connect your WhatsApp Business account to start receiving bookings. No technical setup needed.
          </p>

          {/* Primary: Embedded Signup */}
          {FB_APP_ID && FB_CONFIG_ID && (
            <div className="mb-6">
              <button onClick={launchEmbeddedSignup} disabled={loading}
                className="w-full bg-[#25D366] text-white py-3.5 rounded-lg font-semibold hover:bg-[#20bd5a] disabled:opacity-50 flex items-center justify-center gap-3 text-base shadow-sm transition">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Connecting...
                  </span>
                ) : (
                  <>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Connect with WhatsApp
                  </>
                )}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Sign in with Facebook → verify your phone number → done!
              </p>
            </div>
          )}

          {/* Divider */}
          {FB_APP_ID && FB_CONFIG_ID && (
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-200" />
              <button onClick={() => setShowManual(!showManual)}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium whitespace-nowrap">
                {showManual ? 'Hide manual setup' : 'Or enter credentials manually'}
              </button>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}

          {/* Manual fallback form */}
          {(showManual || !FB_APP_ID || !FB_CONFIG_ID) && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Enter your WhatsApp Cloud API credentials from the <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-slate-700 underline">Meta Developer Portal</a>
              </p>
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
            </div>
          )}

          <button onClick={() => setStep(2)} className="w-full text-gray-400 text-sm hover:text-gray-600 mt-4">
            Skip for now →
          </button>
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
            <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input placeholder="Service name" value={svc.name}
                onChange={e => { const s = [...services]; s[i].name = e.target.value; setServices(s); }}
                className="border rounded px-3 py-2 text-sm outline-none" />
              <input type="number" placeholder="Price (₹)" value={svc.price}
                onChange={e => { const s = [...services]; s[i].price = parseInt(e.target.value); setServices(s); }}
                className="border rounded px-3 py-2 text-sm outline-none" />
            </div>
          ))}
          <button onClick={() => setServices([...services, { name: '', price: 0 }])}
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
