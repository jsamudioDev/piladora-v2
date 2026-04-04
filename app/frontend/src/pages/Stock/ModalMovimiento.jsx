// ─── Modal para registrar entradas y salidas de stock ─────────────────────────
// NUEVO: selector de ubicación (PILADORA / LOCAL) para el ADMIN
// El stock preview se actualiza según la ubicación seleccionada

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ModalMovimiento({ productos, onGuardar, onCerrar }) {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'ADMIN';

  // Ubicación por defecto según el rol
  const ubicDefecto = usuario?.rol === 'VENDEDOR' ? 'local' : 'piladora';

  const [form, setForm] = useState({
    productoId: productos[0]?.id ?? '',
    tipo:       'ENTRADA',
    cantidad:   '',
    motivo:     '',
    ubicacion:  ubicDefecto,
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
      ubicacion:  form.ubicacion,
    });
  }

  const productoSel = productos.find(p => p.id === Number(form.productoId));

  // Stock disponible según la ubicación seleccionada
  const stockDisponible = productoSel
    ? (form.ubicacion === 'local' ? productoSel.stockLocal : productoSel.stockActual)
    : 0;

  // Stock estimado tras el movimiento
  const stockEstimado = form.cantidad
    ? (form.tipo === 'ENTRADA'
        ? stockDisponible + Number(form.cantidad)
        : stockDisponible - Number(form.cantidad))
    : null;

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Registrar movimiento</h3>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {/* Producto */}
          <label>
            Producto
            <select
              value={form.productoId}
              onChange={e => set('productoId', e.target.value)}
              required
            >
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>

          {/* Selector de ubicación — solo ADMIN puede elegir */}
          {esAdmin && (
            <div>
              <p className="tipo-label">Destino del movimiento</p>
              <div className="tipo-toggle">
                <button
                  type="button"
                  className={`tipo-btn tipo-btn--piladora${form.ubicacion === 'piladora' ? ' active' : ''}`}
                  onClick={() => set('ubicacion', 'piladora')}
                >
                  🏭 Piladora
                  {productoSel && (
                    <span className="stock-badge">{productoSel.stockActual} {productoSel.unidad}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`tipo-btn tipo-btn--local${form.ubicacion === 'local' ? ' active' : ''}`}
                  onClick={() => set('ubicacion', 'local')}
                >
                  🏪 Local
                  {productoSel && (
                    <span className="stock-badge">{productoSel.stockLocal} {productoSel.unidad}</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Tipo: Entrada / Salida */}
          <div>
            <p className="tipo-label">Tipo de movimiento</p>
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

          {/* Cantidad */}
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

          {/* Motivo */}
          <label>
            Motivo (opcional)
            <input
              value={form.motivo}
              onChange={e => set('motivo', e.target.value)}
              placeholder="Ej: Compra proveedor, Transferencia local..."
            />
          </label>

          {/* Preview del resultado */}
          {productoSel && form.cantidad && (
            <div className="preview">
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Stock {form.ubicacion === 'local' ? 'Local' : 'Piladora'} actual
                </span>
                <strong style={{ display: 'block', fontSize: 16 }}>{stockDisponible} {productoSel.unidad}</strong>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: 20 }}>→</span>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Después</span>
                <strong style={{
                  display: 'block', fontSize: 16,
                  color: stockEstimado < 0
                    ? '#f87171'
                    : form.tipo === 'ENTRADA' ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                  {stockEstimado} {productoSel.unidad}
                  {stockEstimado < 0 && ' ⚠️'}
                </strong>
              </div>
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
          border-radius: 14px; width: 100%; max-width: 440px;
          padding: 24px; max-height: 90vh; overflow-y: auto;
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
          padding: 10px 8px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.15s;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
        }
        .tipo-btn--piladora.active {
          background: rgba(124,106,247,0.15); color: var(--accent-purple);
          border-color: var(--accent-purple);
        }
        .tipo-btn--local.active {
          background: rgba(251,191,36,0.15); color: #fbbf24;
          border-color: #fbbf24;
        }
        .tipo-btn--entrada.active {
          background: rgba(74,222,128,0.15); color: var(--accent-green);
          border-color: var(--accent-green);
        }
        .tipo-btn--salida.active {
          background: rgba(248,113,113,0.15); color: var(--accent-red);
          border-color: var(--accent-red);
        }
        .stock-badge {
          font-size: 11px; font-weight: 400; color: var(--text-secondary);
          background: var(--bg-base); border-radius: 10px; padding: 1px 6px;
        }
        .preview {
          display: flex; align-items: center; justify-content: space-around;
          gap: 12px;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 12px 14px;
        }
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
