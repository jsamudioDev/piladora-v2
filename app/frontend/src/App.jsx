import { useState } from 'react';
import Panel from './pages/Panel';
import './App.css';

const MODULOS = ['Panel', 'Venta', 'Pilar', 'Stock', 'Dinero', 'Config'];

export default function App() {
  const [activo, setActivo] = useState('Panel');

  return (
    <div className="app">
      <nav className="sidebar">
        <h2 className="logo">Piladora</h2>
        {MODULOS.map((m) => (
          <button
            key={m}
            className={activo === m ? 'active' : ''}
            onClick={() => setActivo(m)}
          >
            {m}
          </button>
        ))}
      </nav>
      <main className="content">
        {activo === 'Panel' && <Panel />}
        {activo !== 'Panel' && (
          <p className="placeholder">
            Módulo <strong>{activo}</strong> — próximamente
          </p>
        )}
      </main>
    </div>
  );
}
