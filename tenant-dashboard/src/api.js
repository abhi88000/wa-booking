import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('tenant_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('tenant_token');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export default {
  // Auth
  login: (email, password) => api.post('/auth/login', { email, password }),
  signup: (data) => api.post('/auth/signup', data),

  // Onboarding
  getOnboardingStatus: () => api.get('/onboarding/status'),
  connectWhatsApp: (data) => api.post('/onboarding/connect-whatsapp', data),
  setupBusiness: (data) => api.post('/onboarding/setup-business', data),
  completeOnboarding: () => api.post('/onboarding/complete'),

  // Dashboard
  getDashboard: () => api.get('/tenant/dashboard'),

  // Appointments
  getAppointments: (params) => api.get('/tenant/appointments', { params }),
  updateAppointmentStatus: (id, status) => api.patch(`/tenant/appointments/${id}/status`, { status }),

  // Doctors
  getDoctors: () => api.get('/tenant/doctors'),
  addDoctor: (data) => api.post('/tenant/doctors', data),
  updateDoctor: (id, data) => api.put(`/tenant/doctors/${id}`, data),

  // Services
  getServices: () => api.get('/tenant/services'),
  addService: (data) => api.post('/tenant/services', data),

  // Patients
  getPatients: (params) => api.get('/tenant/patients', { params }),

  // Payments
  getPayments: () => api.get('/tenant/payments'),

  // Chat
  getChat: (patientId) => api.get(`/tenant/chats/${patientId}`),

  // Settings
  getSettings: () => api.get('/tenant/settings'),
  updateSettings: (data) => api.patch('/tenant/settings', data),

  // Team
  getTeam: () => api.get('/tenant/team'),
  addTeamMember: (data) => api.post('/tenant/team', data),

  // Billing
  getPlans: () => api.get('/billing/plans'),
  getSubscription: () => api.get('/billing/subscription'),
  getInvoices: () => api.get('/billing/invoices'),
};
