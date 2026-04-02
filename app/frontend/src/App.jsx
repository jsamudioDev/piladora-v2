// ─── App principal con autenticación ─────────────────────────────────────────
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login  from './pages/Login/Login';
import Panel  from './pages/Panel/Panel';
import Venta  from './pages/Venta/Venta';
import Pilar  from './pages/Pilar/Pilar';
import Stock  from './pages/Stock/Stock';
import Dinero from './pages/Dinero/Dinero';
import Config    from './pages/Config/Config';
import Creditos  from './pages/Creditos/Creditos';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Ruta pública: Login */}
      <Route path="/login" element={<Login />} />

      {/* Rutas protegidas: requieren autenticación */}
      <Route path="/" element={<Navigate to="/panel" replace />} />

      <Route path="/panel" element={
        <ProtectedRoute>
          <Layout activeModule="panel"><Panel /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/venta" element={
        <ProtectedRoute>
          <Layout activeModule="venta"><Venta /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/pilar" element={
        <ProtectedRoute>
          <Layout activeModule="pilar"><Pilar /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/stock" element={
        <ProtectedRoute>
          <Layout activeModule="stock"><Stock /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/dinero" element={
        <ProtectedRoute>
          <Layout activeModule="dinero"><Dinero /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/creditos" element={
        <ProtectedRoute>
          <Layout activeModule="creditos"><Creditos /></Layout>
        </ProtectedRoute>
      } />

      {/* Config: solo admin */}
      <Route path="/config" element={
        <ProtectedRoute requireAdmin>
          <Layout activeModule="config"><Config /></Layout>
        </ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
