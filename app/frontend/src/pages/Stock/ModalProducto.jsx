import { useState } from 'react';

const UNIDADES    = ['qq', 'saco', 'kg', 'lb'];
const CATEGORIAS  = ['grano', 'pilado', 'alimento'];

export default function ModalProducto({ producto, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    nombre:      producto?.nombre      ?? '',
    unidad:      producto?.unidad      ?? 'saco',
    stockActual: producto?.stockActual ?? 0,
    stockLocal:  producto?.stockLocal  ?? 0,
    stockMinimo: producto?.stockMinimo ?? 0,
    categoria:   producto?.categoria   ?? 'grano',
    ubicacion:   producto?.ubicacion   ?? 'piladora',
  });

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    onGuardar(
      {
        ...form,
        stockActual: Number(form.stockActual),
        stockLocal:  Number(form.stockLocal),
        stockMinimo: Number(form.stockMinimo),
      },
      producto?.id
    );
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{producto ? 'Editar producto' : 'Nuevo producto'}</h3>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Maíz Grano 100lb"
              required
            />
          </label>

          <div className="form-row">
            <label>
              Unidad
              <select value={form.unidad} onChange={e => set('unidad', e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label>
              Categoría
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <div className="form-row">
            <label>
              Stock Piladora
              <input
                type="number" min="0" step="0.5"
                value={form.stockActual}
                onChange={e => set('stockActual', e.target.value)}
              />
            </label>
            <label>
              Stock Local
              <input
                type="number" min="0" step="0.5"
                value={form.stockLocal}
                onChange={e => set('stockLocal', e.target.value)}
              />
            </label>
          </div>

          <label>
            Mínimo
            <input
              type="number" min="0" step="0.5"
              value={form.stockMinimo}
              onChange={e => set('stockMinimo', e.target.value)}
            />
          </label>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn-save">
              {producto ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 500; padding: 16px;
        }
        .modal {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; width: 100%; max-width: 440px;
          padding: 24px;
        }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .modal-header h3 { font-size: 17px; }
        .modal-close {
          background: none; border: none; color: var(--text-secondary);
          font-size: 18px; cursor: pointer; padding: 4px;
        }
        .modal-close:hover { color: var(--text-primary); }

        .modal-form { display: flex; flex-direction: column; gap: 14px; }
        .modal-form label {
          display: flex; flex-direction: column; gap: 6px;
          font-size: 13px; color: var(--text-secondary);
        }
        .modal-form input,
        .modal-form select {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .modal-form input:focus,
        .modal-form select:focus { border-color: var(--accent-purple); }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .modal-footer { display: flex; gap: 10px; margin-top: 6px; }
        .btn-cancel {
          flex: 1; padding: 10px; border-radius: 8px;
          border: 1px solid var(--border); background: none;
          color: var(--text-secondary); font-size: 14px; cursor: pointer;
        }
        .btn-cancel:hover { color: var(--text-primary); }
        .btn-save {
          flex: 2; padding: 10px; border-radius: 8px;
          background: var(--accent-purple); color: #fff;
          border: none; font-size: 14px; font-weight: 600; cursor: pointer;
          transition: opacity 0.15s;
        }
        .btn-save:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
