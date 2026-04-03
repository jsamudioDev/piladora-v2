// ─── Layout principal con sidebar (desktop) + bottom nav (móvil) ─────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { id: 'panel',    label: 'Panel',    icon: '📊' },
  { id: 'venta',    label: 'Venta',    icon: '🛒' },
  { id: 'pilar',    label: 'Pilar',    icon: '⚙️' },
  { id: 'pulidura', label: 'Pulidura', icon: '🌾' },
  { id: 'stock',    label: 'Stock',    icon: '📦' },
  { id: 'dinero',   label: 'Dinero',   icon: '💰' },
  { id: 'creditos', label: 'Créditos', icon: '📋' },
  { id: 'bitacora', label: 'Bitácora', icon: '🗒' },
  { id: 'config',   label: 'Config',   icon: '🔧' },
];

const ROL_LABEL = {
  ADMIN:    'Admin',
  OPERARIO: 'Operario',
  VENDEDOR: 'Vendedor',
};

export default function Layout({ children, activeModule }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const { usuario, logout, tieneAcceso } = useAuth();

  const navItems  = NAV_ITEMS.filter(item => tieneAcceso(item.id));
  // Bottom nav: primeros 4 + "Más" si hay más de 4
  const bottomNav = navItems.slice(0, 4);
  const extraNav  = navItems.slice(4);

  function handleNav(id) {
    navigate(`/${id}`);
    setDrawerOpen(false);
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const rolClass = usuario?.rol?.toLowerCase();

  return (
    <div className="layout">

      {/* ── Mobile top header ── */}
      <header className="mobile-header no-print">
        <span className="logo">Piladora</span>
        <div className="mobile-header-right">
          <span className={`role-badge role-badge--${rolClass}`}>
            {ROL_LABEL[usuario?.rol] || usuario?.rol}
          </span>
          {extraNav.length > 0 && (
            <button className="burger" onClick={() => setDrawerOpen(!drawerOpen)} aria-label="Más opciones">
              {drawerOpen ? '✕' : '☰'}
            </button>
          )}
        </div>
      </header>

      {/* ── Overlay para drawer ── */}
      {drawerOpen && (
        <div className="overlay no-print" onClick={() => setDrawerOpen(false)} />
      )}

      {/* ── Drawer lateral (módulos extra en móvil) ── */}
      <nav className={`drawer no-print${drawerOpen ? ' drawer--open' : ''}`}>
        <div className="drawer-title">Más módulos</div>
        <ul className="nav-list">
          {extraNav.map(item => (
            <li key={item.id}>
              <button
                className={`nav-item${activeModule === item.id ? ' nav-item--active' : ''}`}
                onClick={() => handleNav(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="drawer-footer">
          <button className="logout-btn-full" onClick={handleLogout}>
            ↪ Cerrar sesión
          </button>
        </div>
      </nav>

      {/* ── Sidebar (desktop) ── */}
      <nav className="sidebar no-print">
        <div className="sidebar-logo">Piladora</div>
        <ul className="nav-list">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                className={`nav-item${activeModule === item.id ? ' nav-item--active' : ''}`}
                onClick={() => handleNav(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {usuario?.nombre?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="user-details">
              <span className="user-name">{usuario?.nombre}</span>
              <span className={`role-badge role-badge--${rolClass}`}>
                {ROL_LABEL[usuario?.rol] || usuario?.rol}
              </span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión">
            ↪
          </button>
        </div>
      </nav>

      {/* ── Contenido principal ── */}
      <main className="main-content">
        {children}
      </main>

      {/* ── Bottom nav (móvil) ── */}
      <nav className="bottom-nav no-print">
        {bottomNav.map(item => (
          <button
            key={item.id}
            className={`bn-item${activeModule === item.id ? ' bn-item--active' : ''}`}
            onClick={() => handleNav(item.id)}
          >
            <span className="bn-icon">{item.icon}</span>
            <span className="bn-label">{item.label}</span>
          </button>
        ))}
        {extraNav.length > 0 && (
          <button
            className={`bn-item${drawerOpen ? ' bn-item--active' : ''}`}
            onClick={() => setDrawerOpen(!drawerOpen)}
          >
            <span className="bn-icon">☰</span>
            <span className="bn-label">Más</span>
          </button>
        )}
      </nav>

      <style>{`
        .layout {
          display: flex;
          min-height: 100svh;
          background: var(--bg-base);
          color: var(--text-primary);
        }

        /* ── Mobile top header ── */
        .mobile-header {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 52px;
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--border);
          align-items: center;
          padding: 0 16px;
          justify-content: space-between;
          z-index: 200;
        }
        .mobile-header .logo {
          font-size: 18px;
          font-weight: 700;
          color: var(--accent-purple);
        }
        .mobile-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .burger {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
          line-height: 1;
        }

        /* ── Overlay ── */
        .overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 250;
        }

        /* ── Sidebar (desktop) ── */
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
        .nav-item:hover   { background: var(--bg-card); color: var(--text-primary); }
        .nav-item--active { background: rgba(124,106,247,0.15); color: var(--accent-purple); }
        .nav-icon  { font-size: 16px; }
        .nav-label { font-weight: 500; }

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
          width: 34px; height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5cf6, #6d28d9);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px;
          flex-shrink: 0;
        }
        .user-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .user-name {
          font-size: 13px; font-weight: 600;
          color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .role-badge {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.5px;
          padding: 1px 6px; border-radius: 4px;
          width: fit-content;
        }
        .role-badge--admin    { background: rgba(239,68,68,0.2);   color: #f87171; }
        .role-badge--vendedor { background: rgba(34,197,94,0.2);   color: #4ade80; }
        .role-badge--operario { background: rgba(251,191,36,0.2);  color: #fbbf24; }

        .logout-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-secondary);
          width: 34px; height: 34px;
          border-radius: 8px; cursor: pointer;
          font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .logout-btn:hover {
          background: rgba(239,68,68,0.15);
          color: #f87171;
          border-color: rgba(239,68,68,0.3);
        }

        /* ── Main ── */
        .main-content {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }

        /* ── Bottom nav (oculto en desktop) ── */
        .bottom-nav { display: none; }

        /* ── Drawer (oculto en desktop) ── */
        .drawer { display: none; }

        /* ═══ MOBILE ═══ */
        @media (max-width: 768px) {
          .mobile-header { display: flex; }
          .overlay       { display: block; }
          .sidebar        { display: none; }

          .main-content {
            padding: 68px 14px 80px;  /* top: header, bottom: nav bar */
          }

          /* ── Bottom nav ── */
          .bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 60px;
            background: var(--bg-sidebar);
            border-top: 1px solid var(--border);
            z-index: 200;
            justify-content: space-around;
            align-items: stretch;
            padding: 0;
          }
          .bn-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 6px 4px;
            transition: color 0.15s;
            -webkit-tap-highlight-color: transparent;
          }
          .bn-item:active { background: rgba(255,255,255,0.04); }
          .bn-item--active { color: var(--accent-purple); }
          .bn-icon  { font-size: 18px; line-height: 1; }
          .bn-label { font-size: 10px; font-weight: 600; }

          /* ── Drawer lateral ── */
          .drawer {
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0; right: 0;
            width: 220px;
            height: 100svh;
            background: var(--bg-sidebar);
            border-left: 1px solid var(--border);
            z-index: 260;
            transform: translateX(100%);
            transition: transform 0.25s ease;
            padding: 60px 0 0;
          }
          .drawer--open { transform: translateX(0); }
          .drawer-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-secondary);
            padding: 12px 20px 8px;
          }
          .drawer .nav-list { padding: 0 8px; }
          .drawer-footer {
            margin-top: auto;
            padding: 12px 12px 24px;
            border-top: 1px solid var(--border);
          }
          .logout-btn-full {
            width: 100%;
            background: rgba(239,68,68,0.1);
            border: 1px solid rgba(239,68,68,0.25);
            color: #f87171;
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}
