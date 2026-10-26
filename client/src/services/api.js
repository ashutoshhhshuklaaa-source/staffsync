import axios from 'axios';

// Default to live backend URL if VITE_API_BASE_URL is not set
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://staffsync-ipyu.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('staffsync_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for centralized error handling and auth token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isAuthEndpoint =
        error.config.url.includes('/api/auth/login') ||
        error.config.url.includes('/api/auth/register');

      if (!isAuthEndpoint) {
        localStorage.removeItem('staffsync_token');
        localStorage.removeItem('staffsync_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?expired=true';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ==========================================
// Authentication Endpoints
// ==========================================
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  getMe: () => api.get('/api/auth/me'),
  getHealth: () => api.get('/api/health'),
};

// ==========================================
// Employee Management Endpoints
// ==========================================
export const employeeAPI = {
  getAll: (params) => api.get('/api/employees', { params }),
  getMe: () => api.get('/api/employees/me'),
  getById: (id) => api.get(`/api/employees/${id}`),
  create: (data) => api.post('/api/employees', data),
  update: (id, data) => api.patch(`/api/employees/${id}`, data),
  updateStatus: (id, data) => api.patch(`/api/employees/${id}/status`, data),
};

// ==========================================
// Leave Management Endpoints
// ==========================================
export const leaveAPI = {
  apply: (data) => api.post('/api/leaves', data),
  getAll: (params) => api.get('/api/leaves', { params }),
  getMe: (params) => api.get('/api/leaves/me', { params }),
  getBalanceMe: () => api.get('/api/leaves/balance/me'),
  getById: (id) => api.get(`/api/leaves/${id}`),
  review: (id, data) => api.patch(`/api/leaves/${id}/review`, data),
  cancel: (id) => api.patch(`/api/leaves/${id}/cancel`),
};

// ==========================================
// Attendance Management Endpoints
// ==========================================
export const attendanceAPI = {
  checkIn: (data) => api.post('/api/attendance/check-in', data || {}),
  checkOut: (data) => api.patch('/api/attendance/check-out', data || {}),
  getMe: (params) => api.get('/api/attendance/me', { params }),
  getAll: (params) => api.get('/api/attendance', { params }),
  getSummaryReport: (params) => api.get('/api/attendance/reports/summary', { params }),
  getById: (id) => api.get(`/api/attendance/${id}`),
  correct: (id, data) => api.patch(`/api/attendance/${id}/correct`, data),
};

// ==========================================
// Announcements Endpoints
// ==========================================
export const announcementAPI = {
  create: (data) => api.post('/api/announcements', data),
  getAll: (params) => api.get('/api/announcements', { params }),
  getMe: (params) => api.get('/api/announcements/me', { params }),
  getById: (id) => api.get(`/api/announcements/${id}`),
  update: (id, data) => api.patch(`/api/announcements/${id}`, data),
  publish: (id) => api.patch(`/api/announcements/${id}/publish`),
  archive: (id) => api.patch(`/api/announcements/${id}/archive`),
};

// ==========================================
// Training & Development Endpoints
// ==========================================
export const trainingAPI = {
  create: (data) => api.post('/api/trainings', data),
  getAll: (params) => api.get('/api/trainings', { params }),
  getById: (id) => api.get(`/api/trainings/${id}`),
  update: (id, data) => api.patch(`/api/trainings/${id}`, data),
  publish: (id) => api.patch(`/api/trainings/${id}/publish`),
  archive: (id) => api.patch(`/api/trainings/${id}/archive`),
  enroll: (id) => api.post(`/api/trainings/${id}/enroll`),
  getMyEnrollments: (params) => api.get('/api/trainings/me/enrollments', { params }),
  getEnrollments: (id, params) => api.get(`/api/trainings/${id}/enrollments`, { params }),
  updateProgress: (id, enrollmentId, data) =>
    api.patch(`/api/trainings/${id}/enrollments/${enrollmentId}/progress`, data),
};

export default api;
