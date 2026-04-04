// ─── Modal para registrar entradas y salidas de stock ─────────────────────────
// Mejorado: selector de productos con búsqueda interactiva en lugar de <select>
// ADMIN puede elegir destino (PILADORA / LOCAL)
// VENDEDOR siempre registra en LOCAL
// OPERARIO siempre registra en PILADORA

import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

// Íconos por categoría
const CATEGORIA_ICON = {
  grano:    '🌾',
  insumo:   '🧴',
  empaque:  '📦',
  servicio: '🔧',
  otro:     '📋',
};

export default function ModalMovimiento({ productos, onGuardar, onCerrar }) {
  const { usuario } = useAuth();
  const esAdmin    = usuario?.rol === 'ADMIN';
  const esVendedor = usuario?.rol === 'VENDEDOR';

  // Ubicación por defecto según el rol
  const ubicDefecto = esVendedor ? 'local' : 'piladora';

  const [busqueda,    setBusqueda]    = useState('');
  const [productoId,  setProductoId]  = useState(null);
  const [tipo,        setTipo]        = useState('ENTRADA');
  const [cantidad,    setCantidad]    = useState('');
  const [motivo,      setMotivo]      = useState('');
  const [ubicacion,   setUbicacion]   = useState(ubicDefecto);

  // Productos filtrados por búsqueda
  const productosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return productos;
    return productos.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      (p.categoria || '').toLowerCase().includes(term)
    );
  }, [productos, busqueda]);

  const productoSel = useMemo(
    () => productos.find(p => p.id === productoId),
    [productos, productoId]
  );

  // Stock disponible según la ubicación seleccionada
  const stockDisponible = productoSel
    ? (ubicacion === 'local' ? productoSel.stockLocal : productoSel.stockActual)
    : 0;

  // Stock estimado tras el movimiento
  const stockEstimado = cantidad
    ? (tipo === 'ENTRADA'
        ? stockDisponible + Number(cantidad)
        : stockDisponible - Number(cantidad))
    : null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!productoId || !cantidad || Number(cantidad) <= 0) return;
    onGuardar({
      productoId: Number(productoId),
      tipo,
      cantidad:  Number(cantidad),
      motivo:    motivo || null,
      ubicacion,
    });
  }

  return (
    <div className="mvm-overlay" onClick={onCerrar}>
      <div className="mvm-modal" onClick={e => e.stopPropagation()}>

        {/* Encabezado */}
        <div className="mvm-header">
          <h3 className="mvm-title">Registrar movimiento</h3>
          <button className="mvm-close" onClick={onCerrar}>✕</button>
        </div>

        <form className="mvm-form" onSubmit={handleSubmit}>

          {/* ── Selector de producto con búsqueda ─────────────────────── */}
          <div className="mvm-section">
            <p className="mvm-label">Producto</p>

            {/* Buscador */}
            <div className="mvm-search">
              <span className="mvm-search-icon">🔍</span>
              <input
                className="mvm-search-input"
                type="text"
                placeholder="Buscar producto..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                autoFocus
              />
              {busqueda && (
                <button
                  type="button"
                  className="mvm-search-clear"
                  onClick={() => setBusqueda('')}
                >✕</button>
              )}
            </div>

            {/* Lista de productos */}
            <div className="mvm-prod-list">
              {productosFiltrados.length === 0 ? (
                <div className="mvm-empty">
                  {busqueda
                    ? `Sin resultados para "${busqueda}"`
                    : 'No hay productos disponibles'
                  }
                </div>
              ) : (
                productosFiltrados.map(p => {
                  const sel      = productoId === p.id;
                  const stock    = ubicacion === 'local' ? p.stockLocal : p.stockActual;
                  const icon     = CATEGORIA_ICON[p.categoria] ?? '📋';
                  const stockBajo = stock <= 5;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`mvm-prod-item${sel ? ' mvm-prod-item--sel' : ''}`}
                      onClick={() => {
                        setProductoId(p.id);
                        setCantidad('');
                      }}
                    >
                      <span className="mvm-prod-icon">{icon}</span>
                      <span className="mvm-prod-nombre">{p.nombre}</span>
                      <span className={`mvm-prod-stock${stockBajo ? ' mvm-prod-stock--low' : ''}`}>
                        {stock} {p.unidad}
                      </span>
                      {sel && <span className="mvm-prod-check">✓</span>}
                    </button>
                  );
                })
              )}
            </div>

            {/* Nombre del producto seleccionado */}
            {productoSel && (
              <div className="mvm-sel-badge">
                ✅ <strong>{productoSel.nombre}</strong>
                <span>· {stockDisponible} {productoSel.unidad} disponibles ({ubicacion === 'local' ? 'Local' : 'Piladora'})</span>
              </div>
            )}
          </div>

          {/* ── Destino del movimiento — solo ADMIN ───────────────────── */}
          {esAdmin && (
            <div className="mvm-section">
              <p className="mvm-label">Destino del movimiento</p>
              <div className="mvm-toggle">
                <button
                  type="button"
                  className={`mvm-toggle-btn mvm-toggle-btn--piladora${ubicacion === 'piladora' ? ' active' : ''}`}
                  onClick={() => setUbicacion('piladora')}
                >
                  🏭 Piladora
                  {productoSel && (
                    <span className="mvm-stock-badge">
                      {productoSel.stockActual} {productoSel.unidad}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`mvm-toggle-btn mvm-toggle-btn--local${ubicacion === 'local' ? ' active' : ''}`}
                  onClick={() => setUbicacion('local')}
                >
                  🏪 Local
                  {productoSel && (
                    <span className="mvm-stock-badge">
                      {productoSel.stockLocal} {productoSel.unidad}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Etiqueta fija para VENDEDOR y OPERARIO */}
          {!esAdmin && (
            <div className="mvm-ubi-fija">
              {esVendedor ? '🏪 Registrando en Stock Local' : '🏭 Registrando en Piladora'}
            </div>
          )}

          {/* ── Tipo: Entrada / Salida ─────────────────────────────────── */}
          <div className="mvm-section">
            <p className="mvm-label">Tipo de movimiento</p>
            <div className="mvm-toggle">
              <button
                type="button"
                className={`mvm-toggle-btn mvm-toggle-btn--entrada${tipo === 'ENTRADA' ? ' active' : ''}`}
                onClick={() => setTipo('ENTRADA')}
              >
                ↑ Entrada
              </button>
              <button
                type="button"
                className={`mvm-toggle-btn mvm-toggle-btn--salida${tipo === 'SALIDA' ? ' active' : ''}`}
                onClick={() => setTipo('SALIDA')}
              >
                ↓ Salida
              </button>
            </div>
          </div>

          {/* ── Cantidad ──────────────────────────────────────────────── */}
          <label className="mvm-field">
            Cantidad {productoSel && `(${productoSel.unidad})`}
            <input
              type="number" min="0.5" step="0.5"
              className="mvm-input"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              placeholder="0"
              required
            />
          </label>

          {/* ── Motivo ────────────────────────────────────────────────── */}
          <label className="mvm-field">
            Motivo (opcional)
            <input
              className="mvm-input"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: Compra proveedor, Traspaso al local..."
            />
          </label>

          {/* ── Preview resultado ─────────────────────────────────────── */}
          {productoSel && cantidad && (
            <div className="mvm-preview">
              <div className="mvm-preview-item">
                <span className="mvm-preview-lbl">
                  Stock {ubicacion === 'local' ? 'Local' : 'Piladora'} ahora
                </span>
                <strong className="mvm-preview-val">{stockDisponible} {productoSel.unidad}</strong>
              </div>
              <span className="mvm-preview-arrow">→</span>
              <div className="mvm-preview-item">
                <span className="mvm-preview-lbl">Después</span>
                <strong
                  className="mvm-preview-val"
                  style={{
                    color: stockEstimado < 0
                      ? '#f87171'
                      : tipo === 'ENTRADA' ? 'var(--accent-green)' : 'var(--accent-red)',
                  }}
                >
                  {stockEstimado} {productoSel.unidad}
                  {stockEstimado < 0 && ' ⚠️'}
                </strong>
              </div>
            </div>
          )}

          {/* ── Botones ───────────────────────────────────────────────── */}
          <div className="mvm-footer">
            <button type="button" className="mvm-btn-cancel" onClick={onCerrar}>
              Cancelar
            </button>
            <button
              type="submit"
              className="mvm-btn-save"
              disabled={!productoId || !cantidad || Number(cantidad) <= 0}
            >
              Registrar
            </button>
          </div>
        </form>
      </div>

      {/* ── Estilos ───────────────────────────────────────────────────── */}
      <style>{`
        .mvm-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.65);
          display: flex; align-items: center; justify-content: center;
          z-index: 500; padding: 16px;
        }
        .mvm-modal {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 16px; width: 100%; max-width: 460px;
          padding: 24px; max-height: 92vh; overflow-y: auto;
          display: flex; flex-direction: column; gap: 0;
        }
        .mvm-modal::-webkit-scrollbar { width: 4px; }
        .mvm-modal::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        /* Encabezado */
        .mvm-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .mvm-title { font-size: 17px; font-weight: 700; color: var(--text-primary); }
        .mvm-close {
          background: none; border: none; color: var(--text-secondary);
          font-size: 18px; cursor: pointer; padding: 4px 8px; line-height: 1;
          border-radius: 6px; transition: background 0.15s;
        }
        .mvm-close:hover { background: var(--bg-base); color: var(--text-primary); }

        /* Form */
        .mvm-form { display: flex; flex-direction: column; gap: 16px; }
        .mvm-section { display: flex; flex-direction: column; gap: 8px; }
        .mvm-label {
          font-size: 13px; font-weight: 600; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.4px; margin: 0;
        }

        /* Buscador */
        .mvm-search {
          display: flex; align-items: center; gap: 8px;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 10px; padding: 8px 12px; transition: border-color 0.15s;
        }
        .mvm-search:focus-within { border-color: var(--accent-purple); }
        .mvm-search-icon { font-size: 14px; flex-shrink: 0; }
        .mvm-search-input {
          background: none; border: none; outline: none; flex: 1;
          color: var(--text-primary); font-size: 14px;
        }
        .mvm-search-input::placeholder { color: var(--text-secondary); }
        .mvm-search-clear {
          background: none; border: none; color: var(--text-secondary);
          cursor: pointer; font-size: 12px; padding: 2px 5px; line-height: 1;
        }
        .mvm-search-clear:hover { color: var(--text-primary); }

        /* Lista de productos */
        .mvm-prod-list {
          display: flex; flex-direction: column; gap: 4px;
          max-height: 200px; overflow-y: auto;
          border: 1px solid var(--border); border-radius: 10px;
          padding: 6px;
          background: var(--bg-base);
        }
        .mvm-prod-list::-webkit-scrollbar { width: 4px; }
        .mvm-prod-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        .mvm-empty {
          text-align: center; padding: 20px 12px;
          font-size: 13px; color: var(--text-secondary);
        }
        .mvm-prod-item {
          display: flex; align-items: center; gap: 8px;
          background: none; border: 1px solid transparent;
          border-radius: 8px; padding: 8px 10px; cursor: pointer;
          text-align: left; transition: all 0.12s; width: 100%;
        }
        .mvm-prod-item:hover {
          background: rgba(124,106,247,0.06);
          border-color: rgba(124,106,247,0.2);
        }
        .mvm-prod-item--sel {
          background: rgba(124,106,247,0.12) !important;
          border-color: var(--accent-purple) !important;
        }
        .mvm-prod-icon   { font-size: 16px; flex-shrink: 0; }
        .mvm-prod-nombre { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary); }
        .mvm-prod-stock  { font-size: 12px; color: var(--accent-green); font-weight: 600; flex-shrink: 0; }
        .mvm-prod-stock--low { color: #f87171; }
        .mvm-prod-check  { font-size: 12px; color: var(--accent-purple); font-weight: 700; flex-shrink: 0; }

        /* Badge producto seleccionado */
        .mvm-sel-badge {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.25);
          border-radius: 8px; padding: 8px 12px; font-size: 12px; color: var(--text-secondary);
        }
        .mvm-sel-badge strong { color: var(--text-primary); }

        /* Toggle (ubicación / tipo) */
        .mvm-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .mvm-toggle-btn {
          padding: 10px 8px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.15s;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
        }
        .mvm-toggle-btn--piladora.active {
          background: rgba(124,106,247,0.15); color: var(--accent-purple);
          border-color: var(--accent-purple);
        }
        .mvm-toggle-btn--local.active {
          background: rgba(251,191,36,0.15); color: #fbbf24;
          border-color: #fbbf24;
        }
        .mvm-toggle-btn--entrada.active {
          background: rgba(74,222,128,0.15); color: var(--accent-green);
          border-color: var(--accent-green);
        }
        .mvm-toggle-btn--salida.active {
          background: rgba(248,113,113,0.15); color: var(--accent-red);
          border-color: var(--accent-red);
        }
        .mvm-stock-badge {
          font-size: 11px; font-weight: 400; color: var(--text-secondary);
          background: var(--bg-base); border-radius: 10px; padding: 1px 6px;
        }

        /* Etiqueta ubicación fija */
        .mvm-ubi-fija {
          font-size: 13px; font-weight: 600; color: var(--text-secondary);
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px; text-align: center;
        }

        /* Campos de texto */
        .mvm-field {
          display: flex; flex-direction: column; gap: 6px;
          font-size: 13px; color: var(--text-secondary);
        }
        .mvm-input {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
          transition: border-color 0.15s;
        }
        .mvm-input:focus { border-color: var(--accent-purple); }

        /* Preview */
        .mvm-preview {
          display: flex; align-items: center; justify-content: space-around; gap: 12px;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 10px; padding: 12px 16px;
        }
        .mvm-preview-item { display: flex; flex-direction: column; gap: 3px; align-items: center; }
        .mvm-preview-lbl  { font-size: 11px; color: var(--text-secondary); }
        .mvm-preview-val  { font-size: 18px; font-weight: 700; }
        .mvm-preview-arrow { font-size: 20px; color: var(--text-secondary); }

        /* Footer */
        .mvm-footer { display: flex; gap: 10px; margin-top: 4px; }
        .mvm-btn-cancel {
          flex: 1; padding: 11px; border-radius: 8px;
          border: 1px solid var(--border); background: none;
          color: var(--text-secondary); font-size: 14px; cursor: pointer;
          transition: all 0.15s;
        }
        .mvm-btn-cancel:hover { color: var(--text-primary); border-color: var(--text-secondary); }
        .mvm-btn-save {
          flex: 2; padding: 11px; border-radius: 8px;
          background: var(--accent-purple); color: #fff;
          border: none; font-size: 14px; font-weight: 600; cursor: pointer;
          transition: opacity 0.15s;
        }
        .mvm-btn-save:hover:not(:disabled) { opacity: 0.85; }
        .mvm-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
