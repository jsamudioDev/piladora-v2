// ─── Contexto de autenticación global ────────────────────────────────────────
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

// ─── Tabla de permisos estáticos (fallback si no hay módulos dinámicos) ───────
// Refleja los roles por defecto antes de que el ADMIN configure módulos.
const PERMISOS = {
  panel:        ['ADMIN'],
  // Venta: todos los empleados generan tickets y ven historial de ventas
  venta:        ['ADMIN', 'VENDEDOR', 'OPERARIO'],
  pilar:        ['ADMIN', 'OPERARIO'],
  stock:        ['ADMIN', 'OPERARIO', 'VENDEDOR'],
  dinero:       ['ADMIN'],
  // Créditos: todos pueden ver y abonar; crear/editar solo ADMIN+VENDEDOR (guardado en backend)
  creditos:     ['ADMIN', 'VENDEDOR', 'OPERARIO'],
  config:       ['ADMIN'],
  pulidura:     ['ADMIN', 'OPERARIO'],
  bitacora:     ['ADMIN'],
  devoluciones: ['ADMIN'],
  traspasos:    ['ADMIN', 'OPERARIO'],
};

/**
 * AuthProvider — Maneja el estado de autenticación global.
 * Guarda token y datos del usuario en localStorage.
 */
export function AuthProvider({ children }) {
  const [usuario,  setUsuario]  = useState(null);
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
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuario(res.usuario);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('piladora_modulos');
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

    // Cargar módulos dinámicos — solo ADMIN tiene acceso al endpoint.
    // Si falla (usuario no es ADMIN o BD sin datos), simplemente limpiamos.
    try {
      const modulos = await api.get('/config/modulos');
      localStorage.setItem('piladora_modulos', JSON.stringify(modulos));
    } catch {
      localStorage.removeItem('piladora_modulos');
    }

    return res.usuario;
  }

  // Cerrar sesión
  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('piladora_modulos');
    setUsuario(null);
  }

  // ─── Helpers de rol ──────────────────────────────────────────────────────────
  const esAdmin    = usuario?.rol === 'ADMIN';
  const esOperario = usuario?.rol === 'OPERARIO';
  const esVendedor = usuario?.rol === 'VENDEDOR';

  /**
   * tieneAcceso(seccion) — Retorna true si el usuario puede ver esa sección.
   *
   * Prioridad:
   * 1. Lee módulos dinámicos desde localStorage (configurados por el ADMIN).
   * 2. Si no existe un parámetro para esa sección, usa PERMISOS estático como fallback.
   */
  function tieneAcceso(seccion) {
    if (!usuario) return false;

    try {
      const raw = localStorage.getItem('piladora_modulos');
      if (raw) {
        const modulos = JSON.parse(raw);
        const param = modulos.find(m => m.clave === `modulo_${seccion}`);
        if (param) {
          // El valor es "ADMIN,VENDEDOR" — verificar si el rol actual está incluido
          return param.valor.split(',').map(r => r.trim()).includes(usuario.rol);
        }
      }
    } catch {
      // Si el JSON está corrupto, ignorar y usar fallback
    }

    // Fallback: tabla estática
    return (PERMISOS[seccion] || []).includes(usuario.rol);
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
