// ─── Componente de ruta protegida ────────────────────────────────────────────
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — Redirige a /login si el usuario no está autenticado.
 * Si requireAdmin=true, redirige si el usuario no es ADMIN.
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
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

  // Si no hay usuario, ir a login
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  // Si requiere admin y no lo es, ir a panel
  if (requireAdmin && usuario.rol !== 'ADMIN') {
    return <Navigate to="/panel" replace />;
  }

  return children;
}
