const API_BASE = '/api';

// Get stored auth token
function getToken() {
  return localStorage.getItem('clinic_token');
}

// Generic fetch with auth
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('clinic_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

// Auth
export const auth = {
  login: (email, password) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
};

// Dashboard
export const dashboard = {
  getStats: () => apiFetch('/dashboard/stats'),
};

// Appointments
export const appointments = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/appointments?${qs}`);
  },
  updateStatus: (id, status) =>
    apiFetch(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// Doctors
export const doctors = {
  list: () => apiFetch('/doctors'),
  create: (data) => apiFetch('/doctors', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/doctors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Patients
export const patients = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/patients?${qs}`);
  },
};

// Services
export const services = {
  list: () => apiFetch('/services'),
  create: (data) => apiFetch('/services', { method: 'POST', body: JSON.stringify(data) }),
};

// Payments
export const payments = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/payments?${qs}`);
  },
};

// Chat
export const chats = {
  getHistory: (phone) => apiFetch(`/chats/${phone}`),
};
