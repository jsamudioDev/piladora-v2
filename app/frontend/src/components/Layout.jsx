// ─── Layout principal con sidebar, usuario y logout ─────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { id: 'panel',  label: 'Panel',  icon: '📊' },
  { id: 'venta',  label: 'Venta',  icon: '🛒' },
  { id: 'pilar',  label: 'Pilar',  icon: '⚙️' },
  { id: 'stock',  label: 'Stock',  icon: '📦' },
  { id: 'dinero',   label: 'Dinero',   icon: '💰' },
  { id: 'creditos', label: 'Créditos', icon: '📋' },
  { id: 'config',   label: 'Config',   icon: '⚙️', adminOnly: true },
];

export default function Layout({ children, activeModule }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { usuario, logout, esAdmin } = useAuth();

  // Filtrar items de navegación según rol
  const navItems = NAV_ITEMS.filter(item => !item.adminOnly || esAdmin);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="layout">
      {/* Mobile header */}
      <header className="mobile-header">
        <button className="burger" onClick={() => setOpen(!open)} aria-label="Menú">
          {open ? '✕' : '☰'}
        </button>
        <span className="logo">Piladora</span>
        <div className="mobile-user">
          <span className={`role-badge role-badge--${usuario?.rol?.toLowerCase()}`}>
            {usuario?.rol}
          </span>
        </div>
      </header>

      {/* Overlay móvil */}
      {open && <div className="overlay" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <nav className={`sidebar${open ? ' sidebar--open' : ''}`}>
        <div className="sidebar-logo">Piladora</div>

        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-item${activeModule === item.id ? ' nav-item--active' : ''}`}
                onClick={() => {
                  navigate(`/${item.id}`);
                  setOpen(false);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Info del usuario y logout */}
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {usuario?.nombre?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="user-details">
              <span className="user-name">{usuario?.nombre}</span>
              <span className={`role-badge role-badge--${usuario?.rol?.toLowerCase()}`}>
                {usuario?.rol === 'ADMIN' ? 'Admin' : 'Vendedor'}
              </span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión">
            ↪
          </button>
        </div>
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
          flex: 1;
        }
        .mobile-user {
          display: flex;
          align-items: center;
          gap: 8px;
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
          flex: 1;
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

        /* Sidebar footer — usuario + logout */
        .sidebar-footer {
          padding: 12px;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .user-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .user-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5cf6, #6d28d9);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }
        .user-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .role-badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 1px 6px;
          border-radius: 4px;
          width: fit-content;
        }
        .role-badge--admin {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }
        .role-badge--vendedor {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }
        .logout-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-secondary);
          width: 34px;
          height: 34px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }

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
