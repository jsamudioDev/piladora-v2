/**
 * LoadingSpinner — indicador de carga reutilizable.
 * Props:
 *   size: 'sm' (20px) | 'md' (36px, default) | 'lg' (56px)
 *   label: texto opcional debajo del spinner
 */
export default function LoadingSpinner({ size = 'md', label }) {
  return (
    <div className={`spinner-wrap spinner-wrap--${size}`}>
      <div className={`spinner spinner--${size}`} />
      {label && <span className="spinner-label">{label}</span>}
      <style>{`
        .spinner-wrap {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 10px;
        }
        .spinner {
          border-radius: 50%;
          border: 3px solid var(--border);
          border-top-color: var(--accent-purple);
          animation: spin 0.7s linear infinite;
        }
        .spinner--sm { width: 20px; height: 20px; border-width: 2px; }
        .spinner--md { width: 36px; height: 36px; }
        .spinner--lg { width: 56px; height: 56px; border-width: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner-label { font-size: 13px; color: var(--text-secondary); }
      `}</style>
    </div>
  );
}
