// ─── Componente de ruta protegida ────────────────────────────────────────────
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Primera ruta accesible por rol — hacia donde redirigir si no tiene acceso
const RUTA_INICIAL = {
  ADMIN:    '/panel',
  OPERARIO: '/pilar',
  VENDEDOR: '/venta',
};

/**
 * ProtectedRoute — Protege rutas según autenticación y rol.
 *
 * Props:
 *   allowedRoles  — array de roles que pueden acceder, ej: ['ADMIN', 'OPERARIO']
 *                   si no se pasa, cualquier usuario autenticado puede entrar.
 *   requireAdmin  — (legacy) equivale a allowedRoles={['ADMIN']}
 */
export default function ProtectedRoute({ children, allowedRoles, requireAdmin = false }) {
  const { usuario, cargando } = useAuth();

  // Mientras verifica el token, mostrar cargando
  if (cargando) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-base, #0a0a1a)',
        color: 'var(--text-secondary, #999)', fontSize: '1.1rem'
      }}>
        Cargando...
      </div>
    );
  }

  // Si no hay sesión, ir a login
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  // Normalizar: requireAdmin=true es igual a allowedRoles=['ADMIN']
  const rolesPermitidos = requireAdmin ? ['ADMIN'] : allowedRoles;

  // Si hay lista de roles y el usuario no está en ella → redirigir a su ruta inicial
  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    const rutaInicial = RUTA_INICIAL[usuario.rol] || '/login';
    return <Navigate to={rutaInicial} replace />;
  }

  return children;
}
