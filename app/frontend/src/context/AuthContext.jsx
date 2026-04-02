// ─── Contexto de autenticación global ────────────────────────────────────────
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

// ─── Tabla de permisos por sección ───────────────────────────────────────────
// Define qué roles pueden acceder a cada sección del sistema.
// Refleja la tabla de permisos del negocio:
//   ADMIN    → acceso total
//   OPERARIO → piladora: pilar y stock (solo piladora)
//   VENDEDOR → local: ventas y stock (solo local)
const PERMISOS = {
  panel:    ['ADMIN'],
  venta:    ['ADMIN', 'VENDEDOR'],
  pilar:    ['ADMIN', 'OPERARIO'],
  stock:    ['ADMIN', 'OPERARIO', 'VENDEDOR'],
  dinero:   ['ADMIN'],
  creditos: ['ADMIN'],
  config:   ['ADMIN'],
  pulidura: ['ADMIN', 'OPERARIO'],
};

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

  // ─── Helpers de rol ──────────────────────────────────────────────────────────
  const esAdmin    = usuario?.rol === 'ADMIN';
  const esOperario = usuario?.rol === 'OPERARIO';
  const esVendedor = usuario?.rol === 'VENDEDOR';

  /**
   * tieneAcceso(seccion) — Retorna true si el usuario puede ver esa sección.
   * Consulta la tabla PERMISOS definida arriba.
   */
  function tieneAcceso(seccion) {
    if (!usuario) return false;
    const rolesPermitidos = PERMISOS[seccion] || [];
    return rolesPermitidos.includes(usuario.rol);
  }

  return (
    <AuthContext.Provider value={{
      usuario,
      cargando,
      login,
      logout,
      esAdmin,
      esOperario,
      esVendedor,
      tieneAcceso,
    }}>
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
