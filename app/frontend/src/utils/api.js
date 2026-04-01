// ─── Cliente API con autenticación automática ───────────────────────────────
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor de request: agrega token JWT automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de response: manejo de errores
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Error desconocido';

    // Si el token expiró o es inválido, limpiar y redirigir a login
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      // Solo redirigir si no estamos ya en login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(new Error(message));
  }
);

export default api;
