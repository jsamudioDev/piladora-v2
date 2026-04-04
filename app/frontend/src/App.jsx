// ─── App principal con autenticación y permisos por rol ──────────────────────
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import InstallBanner from './components/InstallBanner';
import Login    from './pages/Login/Login';
import Panel    from './pages/Panel/Panel';
import Venta    from './pages/Venta/Venta';
import Pilar    from './pages/Pilar/Pilar';
import Stock    from './pages/Stock/Stock';
import Dinero   from './pages/Dinero/Dinero';
import Config   from './pages/Config/Config';
import Creditos  from './pages/Creditos/Creditos';
import Pulidura  from './pages/Pulidura/Pulidura';
import Bitacora  from './pages/Bitacora/Bitacora';
import './App.css';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <InstallBanner />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<Login />} />

      {/* Redirigir raíz → cada rol tiene su propia ruta inicial (ver ProtectedRoute) */}
      <Route path="/" element={<Navigate to="/panel" replace />} />

      {/* Panel — solo ADMIN */}
      <Route path="/panel" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <Layout activeModule="panel"><Panel /></Layout>
        </ProtectedRoute>
      } />

      {/* Venta — ADMIN, VENDEDOR y OPERARIO (misma empresa, pueden generar y ver tickets) */}
      <Route path="/venta" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'VENDEDOR', 'OPERARIO']}>
          <Layout activeModule="venta"><Venta /></Layout>
        </ProtectedRoute>
      } />

      {/* Pilar — ADMIN y OPERARIO */}
      <Route path="/pilar" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'OPERARIO']}>
          <Layout activeModule="pilar"><Pilar /></Layout>
        </ProtectedRoute>
      } />

      {/* Stock — todos los roles (filtrado por ubicación en backend) */}
      <Route path="/stock" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'OPERARIO', 'VENDEDOR']}>
          <Layout activeModule="stock"><Stock /></Layout>
        </ProtectedRoute>
      } />

      {/* Dinero — solo ADMIN */}
      <Route path="/dinero" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <Layout activeModule="dinero"><Dinero /></Layout>
        </ProtectedRoute>
      } />

      {/* Créditos — ADMIN, VENDEDOR y OPERARIO pueden ver y abonar */}
      <Route path="/creditos" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'VENDEDOR', 'OPERARIO']}>
          <Layout activeModule="creditos"><Creditos /></Layout>
        </ProtectedRoute>
      } />

      {/* Pulidura — ADMIN y OPERARIO */}
      <Route path="/pulidura" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'OPERARIO']}>
          <Layout activeModule="pulidura"><Pulidura /></Layout>
        </ProtectedRoute>
      } />

      {/* Bitácora — solo ADMIN */}
      <Route path="/bitacora" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <Layout activeModule="bitacora"><Bitacora /></Layout>
        </ProtectedRoute>
      } />

      {/* Config — solo ADMIN */}
      <Route path="/config" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <Layout activeModule="config"><Config /></Layout>
        </ProtectedRoute>
      } />

      {/* Catch-all → cada rol es redirigido a su ruta inicial */}
      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
