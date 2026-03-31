import { useState } from 'react';

export default function ModalMovimiento({ productos, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    productoId: productos[0]?.id ?? '',
    tipo:       'ENTRADA',
    cantidad:   '',
    motivo:     '',
  });

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.productoId || !form.cantidad || Number(form.cantidad) <= 0) return;
    onGuardar({
      productoId: Number(form.productoId),
      tipo:       form.tipo,
      cantidad:   Number(form.cantidad),
      motivo:     form.motivo || null,
    });
  }

  const productoSel = productos.find(p => p.id === Number(form.productoId));

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Registrar movimiento</h3>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            Producto
            <select
              value={form.productoId}
              onChange={e => set('productoId', e.target.value)}
              required
            >
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.stockActual} {p.unidad})</option>
              ))}
            </select>
          </label>

          {/* Selector visual de tipo */}
          <div>
            <p className="tipo-label">Tipo</p>
            <div className="tipo-toggle">
              <button
                type="button"
                className={`tipo-btn tipo-btn--entrada${form.tipo === 'ENTRADA' ? ' active' : ''}`}
                onClick={() => set('tipo', 'ENTRADA')}
              >
                ↑ Entrada
              </button>
              <button
                type="button"
                className={`tipo-btn tipo-btn--salida${form.tipo === 'SALIDA' ? ' active' : ''}`}
                onClick={() => set('tipo', 'SALIDA')}
              >
                ↓ Salida
              </button>
            </div>
          </div>

          <label>
            Cantidad
            <input
              type="number" min="0.5" step="0.5"
              value={form.cantidad}
              onChange={e => set('cantidad', e.target.value)}
              placeholder="0"
              required
            />
          </label>

          <label>
            Motivo (opcional)
            <input
              value={form.motivo}
              onChange={e => set('motivo', e.target.value)}
              placeholder="Ej: Compra proveedor, Venta cliente..."
            />
          </label>

          {/* Preview */}
          {productoSel && form.cantidad && (
            <div className="preview">
              <span>Resultado estimado:</span>
              <strong style={{ color: form.tipo === 'ENTRADA' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {form.tipo === 'ENTRADA'
                  ? productoSel.stockActual + Number(form.cantidad)
                  : productoSel.stockActual - Number(form.cantidad)
                } {productoSel.unidad}
              </strong>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn-save">Registrar</button>
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
          border-radius: 14px; width: 100%; max-width: 420px;
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

        .tipo-label { font-size: 13px; color: var(--text-secondary); margin: 0 0 6px; }
        .tipo-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .tipo-btn {
          padding: 10px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 14px;
          font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .tipo-btn--entrada.active {
          background: rgba(74,222,128,0.15); color: var(--accent-green);
          border-color: var(--accent-green);
        }
        .tipo-btn--salida.active {
          background: rgba(248,113,113,0.15); color: var(--accent-red);
          border-color: var(--accent-red);
        }

        .preview {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 10px 14px; font-size: 13px;
          color: var(--text-secondary);
        }
        .preview strong { font-size: 16px; }

        .modal-footer { display: flex; gap: 10px; margin-top: 4px; }
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
