import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE });

// Attach token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('platform_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('platform_token');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export default {
  // Auth
  login: (email, password) => api.post('/auth/platform/login', { email, password }),
  
  // Dashboard
  getDashboard: () => api.get('/platform/dashboard'),
  
  // Tenants
  getTenants: (params) => api.get('/platform/tenants', { params }),
  getTenant: (id) => api.get(`/platform/tenants/${id}`),
  toggleTenant: (id) => api.patch(`/platform/tenants/${id}/toggle`),
  updateFeatures: (id, features) => api.patch(`/platform/tenants/${id}/features`, { features }),
  updatePlan: (id, data) => api.patch(`/platform/tenants/${id}/plan`, data),
  resetPassword: (id, newPassword) => api.post(`/platform/tenants/${id}/reset-password`, { newPassword }),
  
  // Analytics
  getAnalytics: () => api.get('/platform/analytics'),

  // Health Monitoring
  getHealth: () => api.get('/platform/health'),
  getTenantHealth: (id) => api.get(`/platform/health/${id}`),
  validateWA: (id) => api.post(`/platform/health/${id}/validate-wa`),
  getTenantErrors: (id) => api.get(`/platform/errors/${id}`),
  resetConversations: (id) => api.post(`/platform/fix/${id}/reset-conversations`),

  // Invite Codes
  getInviteCodes: () => api.get('/platform/invite-codes'),
  createInviteCode: (data) => api.post('/platform/invite-codes', data),
  deleteInviteCode: (id) => api.delete(`/platform/invite-codes/${id}`),
};
