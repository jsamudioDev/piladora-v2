// ─── Contexto de autenticación global ────────────────────────────────────────
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

/**
 * AuthProvider — Maneja el estado de autenticación global.
 * Guarda token y datos del usuario en localStorage.
 */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al montar, verificar si hay token guardado
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      verificarToken(token);
    } else {
      setCargando(false);
    }
  }, []);

  // Verificar token contra el backend
  async function verificarToken(token) {
    try {
      const res = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsuario(res.usuario);
    } catch (err) {
      // Token inválido o expirado — limpiar
      localStorage.removeItem('token');
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }

  // Iniciar sesión
  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.token);
    setUsuario(res.usuario);
    return res.usuario;
  }

  // Cerrar sesión
  function logout() {
    localStorage.removeItem('token');
    setUsuario(null);
  }

  // Verificar si es admin
  const esAdmin = usuario?.rol === 'ADMIN';

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, esAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — Hook para acceder al contexto de autenticación.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
