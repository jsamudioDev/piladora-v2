import { useState, useEffect } from 'react';

const DISMISS_KEY = 'pwa_install_dismissed';
const DISMISS_DAYS = 7;

/**
 * InstallBanner — aparece cuando el browser emite `beforeinstallprompt`.
 * Se oculta por 7 días si el usuario presiona "Ahora no".
 * Desaparece definitivamente si acepta instalar.
 */
export default function InstallBanner() {
  const [prompt,  setPrompt]  = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // No mostrar si el usuario lo descartó recientemente
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DAYS * 86400_000) return;

    function handler(e) {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setPrompt(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="install-banner">
      <div className="install-banner-inner">
        <div className="install-icon">📲</div>
        <div className="install-text">
          <strong>Instalar Piladora</strong>
          <span>Accede rápido desde tu pantalla de inicio</span>
        </div>
        <div className="install-actions">
          <button className="install-btn-ok" onClick={install}>Instalar</button>
          <button className="install-btn-no" onClick={dismiss}>Ahora no</button>
        </div>
      </div>
      <style>{`
        .install-banner {
          position: fixed; bottom: 68px; left: 0; right: 0;
          z-index: 1900;
          padding: 0 12px;
          animation: slideUp 0.25s ease;
        }
        @media (min-width: 769px) {
          .install-banner { bottom: 16px; left: auto; right: 16px; max-width: 380px; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .install-banner-inner {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .install-icon { font-size: 28px; flex-shrink: 0; }
        .install-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 13px;
        }
        .install-text strong { color: var(--text-primary); font-size: 14px; }
        .install-text span   { color: var(--text-secondary); }
        .install-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
        .install-btn-ok {
          background: var(--accent-purple); color: #fff;
          border: none; border-radius: 8px;
          padding: 7px 14px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: opacity 0.15s; white-space: nowrap;
        }
        .install-btn-ok:hover { opacity: 0.85; }
        .install-btn-no {
          background: none;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          border-radius: 8px;
          padding: 6px 14px; font-size: 12px;
          cursor: pointer; white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
