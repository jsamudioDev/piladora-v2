import { useState, useCallback, useRef } from 'react';

let _show = null;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const show = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return { toasts, show };
}

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <span className="toast-icon">
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </span>
          {t.message}
        </div>
      ))}

      <style>{`
        .toast-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 9999;
        }
        .toast {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          animation: slideIn 0.2s ease;
          max-width: 320px;
        }
        .toast--success { background: var(--accent-green); color: #0f2010; }
        .toast--error   { background: var(--accent-red);   color: #2d0a0a; }
        .toast--info    { background: var(--accent-blue);  color: #0a1a2d; }
        .toast-icon { font-size: 16px; font-weight: 700; }

        @keyframes slideIn {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }

        @media (max-width: 768px) {
          .toast-container {
            bottom: 16px;
            right: 16px;
            left: 16px;
          }
          .toast { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
