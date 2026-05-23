import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 5 * 60 * 1000,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kpg_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Ensure error is an Error object with a proper message
    if (err && typeof err === 'object' && !err.message) {
      err.message = err.response?.data?.error || err.response?.data?.message || 'Request failed';
    }
    if (err.response?.status === 401) {
      localStorage.removeItem('kpg_token');
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
