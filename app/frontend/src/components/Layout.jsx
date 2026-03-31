import { useState } from 'react';

const NAV_ITEMS = [
  { id: 'panel',  label: 'Panel',  icon: '📊' },
  { id: 'venta',  label: 'Venta',  icon: '🛒' },
  { id: 'pilar',  label: 'Pilar',  icon: '⚙️' },
  { id: 'stock',  label: 'Stock',  icon: '📦' },
  { id: 'dinero', label: 'Dinero', icon: '💰' },
  { id: 'config', label: 'Config', icon: '⚙️' },
];

export default function Layout({ children, activeModule, onNavigate }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="layout">
      {/* Mobile header */}
      <header className="mobile-header">
        <button className="burger" onClick={() => setOpen(!open)} aria-label="Menú">
          {open ? '✕' : '☰'}
        </button>
        <span className="logo">Piladora</span>
      </header>

      {/* Overlay móvil */}
      {open && <div className="overlay" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <nav className={`sidebar${open ? ' sidebar--open' : ''}`}>
        <div className="sidebar-logo">Piladora</div>
        <ul className="nav-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-item${activeModule === item.id ? ' nav-item--active' : ''}`}
                onClick={() => {
                  onNavigate?.(item.id);
                  setOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Contenido principal */}
      <main className="main-content">
        {children}
      </main>

      <style>{`
        .layout {
          display: flex;
          min-height: 100svh;
          background: var(--bg-base);
          color: var(--text-primary);
        }

        /* Mobile header */
        .mobile-header {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 52px;
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--border);
          align-items: center;
          padding: 0 16px;
          gap: 12px;
          z-index: 200;
        }
        .burger {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
        }
        .mobile-header .logo {
          font-size: 18px;
          font-weight: 600;
          color: var(--accent-purple);
        }

        /* Overlay */
        .overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 150;
        }

        /* Sidebar */
        .sidebar {
          width: 220px;
          min-height: 100svh;
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          height: 100svh;
          overflow-y: auto;
        }
        .sidebar-logo {
          padding: 24px 20px 16px;
          font-size: 20px;
          font-weight: 700;
          color: var(--accent-purple);
          border-bottom: 1px solid var(--border);
          margin-bottom: 8px;
        }
        .nav-list {
          list-style: none;
          margin: 0;
          padding: 0 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 8px;
          border: none;
          background: none;
          color: var(--text-secondary);
          font-size: 15px;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s, color 0.15s;
        }
        .nav-item:hover {
          background: var(--bg-card);
          color: var(--text-primary);
        }
        .nav-item--active {
          background: rgba(124,106,247,0.15);
          color: var(--accent-purple);
        }
        .nav-icon { font-size: 16px; }
        .nav-label { font-weight: 500; }

        /* Main */
        .main-content {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        /* Mobile */
        @media (max-width: 768px) {
          .mobile-header { display: flex; }
          .overlay { display: block; }
          .sidebar {
            position: fixed;
            top: 0; left: 0;
            height: 100svh;
            z-index: 160;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .sidebar--open { transform: translateX(0); }
          .sidebar-logo { padding-top: 64px; }
          .main-content { padding: 80px 16px 24px; }
        }
      `}</style>
    </div>
  );
}
