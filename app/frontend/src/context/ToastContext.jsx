import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  return useContext(ToastContext);
}

// ─── Contenedor visual de toasts ──────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`} onClick={() => onRemove(t.id)}>
          <span className="toast-icon">{ICONS[t.type]}</span>
          <span className="toast-msg">{t.message}</span>
          <button className="toast-close" onClick={() => onRemove(t.id)}>✕</button>
        </div>
      ))}
      <style>{TOAST_CSS}</style>
    </div>
  );
}

const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

const TOAST_CSS = `
  .toast-container {
    position: fixed; bottom: 76px; right: 16px;
    display: flex; flex-direction: column; gap: 8px;
    z-index: 9999; max-width: 340px;
  }
  @media (min-width: 769px) {
    .toast-container { bottom: 20px; }
  }
  .toast {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 14px; border-radius: 10px;
    font-size: 13px; font-weight: 500; cursor: pointer;
    border: 1px solid transparent;
    animation: toastIn 0.2s ease;
    backdrop-filter: blur(8px);
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .toast--success { background: rgba(74,222,128,0.15); border-color: rgba(74,222,128,0.35); color: #4ade80; }
  .toast--error   { background: rgba(248,113,113,0.15); border-color: rgba(248,113,113,0.35); color: #f87171; }
  .toast--warning { background: rgba(251,191,36,0.15); border-color: rgba(251,191,36,0.35); color: #fbbf24; }
  .toast--info    { background: rgba(96,165,250,0.15); border-color: rgba(96,165,250,0.35); color: #60a5fa; }
  .toast-icon  { font-size: 15px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
  .toast-msg   { flex: 1; line-height: 1.4; color: var(--text-primary); }
  .toast-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); font-size: 13px; padding: 0; flex-shrink: 0; }
`;
