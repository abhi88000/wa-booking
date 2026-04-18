import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('tenant_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
    localStorage.removeItem('tenant_token');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export default {
  // Auth
  login: (email, password, tenantId) => api.post('/auth/login', { email, password, tenantId }),
  signup: (data) => api.post('/auth/signup', data),

  // Onboarding
  getOnboardingStatus: () => api.get('/onboarding/status'),
  connectWhatsApp: (data) => api.post('/onboarding/connect-whatsapp', data),
  setupBusiness: (data) => api.post('/onboarding/setup-business', data),
  completeOnboarding: () => api.post('/onboarding/complete'),

  // Dashboard
  getDashboard: (clinic) => api.get('/tenant/dashboard', { params: clinic && clinic !== 'all' ? { clinic } : {} }),

  // Appointments
  getAppointments: (params) => api.get('/tenant/appointments', { params }),
  getAppointment: (id) => api.get(`/tenant/appointments/${id}`),
  createAppointment: (data) => api.post('/tenant/appointments', data),
  updateAppointmentStatus: (id, status, comment) => api.patch(`/tenant/appointments/${id}/status`, { status, comment }),
  rescheduleAppointment: (id, data) => api.patch(`/tenant/appointments/${id}/reschedule`, data),
  createFollowUp: (id, data) => api.post(`/tenant/appointments/${id}/followup`, data),

  // Doctors
  getDoctors: () => api.get('/tenant/doctors'),
  addDoctor: (data) => api.post('/tenant/doctors', data),
  updateDoctor: (id, data) => api.put(`/tenant/doctors/${id}`, data),
  deleteDoctor: (id) => api.delete(`/tenant/doctors/${id}`),
  getDoctorAvailability: (id) => api.get(`/tenant/doctors/${id}/availability`),
  updateDoctorAvailability: (id, data) => api.put(`/tenant/doctors/${id}/availability`, data),
  getDoctorSlots: (id, date) => api.get(`/tenant/doctors/${id}/slots`, { params: { date } }),

  // Services
  getServices: () => api.get('/tenant/services'),
  addService: (data) => api.post('/tenant/services', data),
  updateService: (id, data) => api.put(`/tenant/services/${id}`, data),
  deleteService: (id) => api.delete(`/tenant/services/${id}`),

  // Patients
  getPatients: (params) => api.get('/tenant/patients', { params }),
  getPatient: (id) => api.get(`/tenant/patients/${id}`),
  addPatient: (data) => api.post('/tenant/patients', data),
  updatePatient: (id, data) => api.put(`/tenant/patients/${id}`, data),

  // Chat
  getChat: (patientId) => api.get(`/tenant/chats/${patientId}`),

  // Conversations / Inbox
  getConversations: (params) => api.get('/tenant/conversations', { params }),
  getConversationMessages: (patientId, params) => api.get(`/tenant/conversations/${patientId}/messages`, { params }),
  sendReply: (patientId, message) => api.post(`/tenant/conversations/${patientId}/reply`, { message }),

  // Flow Config
  getFlowConfig: () => api.get('/tenant/flow-config'),
  saveFlowConfig: (data) => api.put('/tenant/flow-config', data),
  saveAIConfig: (data) => api.put('/tenant/ai-config', data),

  // Records (generic data from flow actions)
  getRecords: (params) => api.get('/tenant/records', { params }),
  getRecord: (id) => api.get(`/tenant/records/${id}`),
  updateRecord: (id, data) => api.patch(`/tenant/records/${id}`, data),
  deleteRecord: (id) => api.delete(`/tenant/records/${id}`),
  getRecordsSummary: () => api.get('/tenant/records-summary'),

  // Settings
  getSettings: () => api.get('/tenant/settings'),
  updateSettings: (data) => api.patch('/tenant/settings', data),

  // WhatsApp
  updateWhatsApp: (data) => api.patch('/tenant/whatsapp', data),
};
