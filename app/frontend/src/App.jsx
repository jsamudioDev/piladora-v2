import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Stock from './pages/Stock/Stock';
import Config from './pages/Config/Config';
import './App.css';

function Placeholder({ nombre }) {
  return (
    <div style={{ padding: '40px 0', color: 'var(--text-secondary)', textAlign: 'center' }}>
      <p style={{ fontSize: 18 }}>Módulo <strong style={{ color: 'var(--text-primary)' }}>{nombre}</strong></p>
      <p style={{ fontSize: 13, marginTop: 6 }}>Próximamente</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/panel" replace />} />
      <Route path="/panel"  element={<Layout activeModule="panel"><Placeholder nombre="Panel" /></Layout>} />
      <Route path="/venta"  element={<Layout activeModule="venta"><Placeholder nombre="Venta" /></Layout>} />
      <Route path="/pilar"  element={<Layout activeModule="pilar"><Placeholder nombre="Pilar" /></Layout>} />
      <Route path="/stock"  element={<Layout activeModule="stock"><Stock /></Layout>} />
      <Route path="/dinero" element={<Layout activeModule="dinero"><Placeholder nombre="Dinero" /></Layout>} />
      <Route path="/config" element={<Layout activeModule="config"><Config /></Layout>} />
      <Route path="*"       element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
