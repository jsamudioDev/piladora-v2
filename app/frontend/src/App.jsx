import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Panel  from './pages/Panel/Panel';
import Venta  from './pages/Venta/Venta';
import Pilar  from './pages/Pilar/Pilar';
import Stock  from './pages/Stock/Stock';
import Dinero from './pages/Dinero/Dinero';
import Config from './pages/Config/Config';
import './App.css';

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
      <Route path="/"       element={<Navigate to="/panel" replace />} />
      <Route path="/panel"  element={<Layout activeModule="panel"><Panel /></Layout>} />
      <Route path="/venta"  element={<Layout activeModule="venta"><Venta /></Layout>} />
      <Route path="/pilar"  element={<Layout activeModule="pilar"><Pilar /></Layout>} />
      <Route path="/stock"  element={<Layout activeModule="stock"><Stock /></Layout>} />
      <Route path="/dinero" element={<Layout activeModule="dinero"><Dinero /></Layout>} />
      <Route path="/config" element={<Layout activeModule="config"><Config /></Layout>} />
      <Route path="*"       element={<Navigate to="/panel" replace />} />
    </Routes>
  );
}
