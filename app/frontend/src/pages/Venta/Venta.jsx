import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { formatMoney } from '../../utils/format';
import { useToast, ToastContainer } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import HistorialVentas from './HistorialVentas';
import ModalTicket from './ModalTicket';

const METODOS_PAGO = [
  { value: 'EFECTIVO',      label: 'Efectivo' },
  { value: 'YAPPY',         label: 'Yappy' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CHEQUE',        label: 'Cheque' },
  { value: 'CREDITO',       label: 'Crédito' },
];

// ─── Íconos de categoría ──────────────────────────────────────────────────────
const CATEGORIA_ICON = {
  grano:    '🌾',
  insumo:   '🧴',
  empaque:  '📦',
  servicio: '🔧',
  otro:     '📋',
};

// ─── Modal de Devolución ──────────────────────────────────────────────────────
function ModalDevolucion({ venta, onClose, onSuccess, show }) {
  const [cantidades, setCantidades] = useState(
    Object.fromEntries(venta.detalles.map(d => [d.id, '']))
  );
  const [motivo, setMotivo]   = useState('');
  const [enviando, setEnviando] = useState(false);

  const totalDevolver = venta.detalles.reduce((s, d) => {
    return s + (Number(cantidades[d.id]) || 0) * d.precioUnit;
  }, 0);

  async function confirmar() {
    const detallesFiltrados = venta.detalles
      .filter(d => Number(cantidades[d.id]) > 0)
      .map(d => ({
        productoId: d.productoId,
        cantidad:   Number(cantidades[d.id]),
        precioUnit: d.precioUnit,
      }));

    if (detallesFiltrados.length === 0) {
      show('Ingresa al menos una cantidad a devolver', 'error'); return;
    }
    if (!motivo.trim()) {
      show('El motivo de la devolución es requerido', 'error'); return;
    }

    setEnviando(true);
    try {
      await api.post('/devoluciones', {
        ventaId: venta.id,
        motivo:  motivo.trim(),
        detalles: detallesFiltrados,
      });
      onSuccess?.();
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Devolución — Venta #{venta.id}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {venta.metodoPago === 'CREDITO' && (
          <div className="badge-credito-info">
            Esta devolución reducirá el saldo del crédito del cliente
          </div>
        )}

        <div className="dev-productos">
          {venta.detalles.map(d => (
            <div key={d.id} className="dev-item">
              <div className="dev-item-info">
                <span className="dev-nombre">{d.producto.nombre}</span>
                <span className="dev-cant-orig">Vendido: {d.cantidad} {d.producto.unidad}</span>
              </div>
              <div className="dev-input-wrap">
                <input
                  className="dev-input"
                  type="number" min="0" max={d.cantidad} step="0.5" placeholder="0"
                  value={cantidades[d.id]}
                  onChange={e => setCantidades(prev => ({ ...prev, [d.id]: e.target.value }))}
                />
                <span className="dev-unidad">{d.producto.unidad}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="dev-total">
          Total a devolver: <strong>{formatMoney(totalDevolver)}</strong>
        </div>

        <label className="field-label">
          Motivo
          <textarea
            className="field-input dev-motivo" rows={2}
            placeholder="Describe el motivo de la devolución..."
            value={motivo} onChange={e => setMotivo(e.target.value)}
          />
        </label>

        <div className="modal-footer">
          <button className="btn-cancelar-dev" onClick={onClose}>Cancelar</button>
          <button
            className="btn-confirmar-dev"
            onClick={confirmar}
            disabled={enviando || totalDevolver === 0}
          >
            {enviando ? 'Procesando...' : 'Confirmar Devolución'}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px;
        }
        .modal-box {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 16px; padding: 24px; width: 100%; max-width: 480px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .modal-header { display: flex; justify-content: space-between; align-items: center; }
        .modal-title  { font-size: 17px; font-weight: 700; color: var(--text-primary); }
        .modal-close  {
          background: none; border: none; color: var(--text-secondary);
          font-size: 18px; cursor: pointer; padding: 4px 8px; line-height: 1;
        }
        .modal-close:hover { color: var(--text-primary); }
        .badge-credito-info {
          background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3);
          color: #fbbf24; border-radius: 8px; padding: 8px 12px; font-size: 13px;
        }
        .dev-productos { display: flex; flex-direction: column; gap: 8px; }
        .dev-item {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 10px 12px;
        }
        .dev-item-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .dev-nombre    { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .dev-cant-orig { font-size: 12px; color: var(--text-secondary); }
        .dev-input-wrap { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .dev-input {
          width: 72px; background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 7px; padding: 7px 10px; color: var(--text-primary);
          font-size: 14px; font-weight: 600; text-align: right; outline: none;
        }
        .dev-input:focus { border-color: var(--accent-blue); }
        .dev-unidad { font-size: 12px; color: var(--text-secondary); }
        .dev-total {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 10px 14px;
          font-size: 14px; color: var(--text-secondary);
        }
        .dev-total strong { color: var(--accent-green); font-size: 18px; }
        .dev-motivo { resize: none; }
        .modal-footer { display: flex; gap: 8px; justify-content: flex-end; }
        .btn-cancelar-dev {
          background: none; border: 1px solid var(--border);
          color: var(--text-secondary); border-radius: 8px;
          padding: 9px 18px; font-size: 14px; cursor: pointer;
          transition: border-color 0.15s;
        }
        .btn-cancelar-dev:hover { border-color: var(--text-secondary); }
        .btn-confirmar-dev {
          background: var(--accent-blue); color: #fff; border: none;
          border-radius: 8px; padding: 9px 18px; font-size: 14px;
          font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .btn-confirmar-dev:hover:not(:disabled) { opacity: 0.85; }
        .btn-confirmar-dev:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Venta() {
  const { esAdmin, usuario }      = useAuth();
  const esVendedor                = usuario?.rol === 'VENDEDOR';
  const [vista, setVista]         = useState('nueva');   // 'nueva' | 'historial'
  // VENDEDOR trabaja solo con stock local; ADMIN y OPERARIO con piladora por defecto
  const [ubicacion, setUbicacion] = useState(esVendedor ? 'local' : 'piladora');
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda]   = useState('');        // búsqueda de producto
  const [prodSel, setProdSel]     = useState(null);      // id del producto seleccionado
  const [cantidad, setCantidad]   = useState('');
  const [precioUnit, setPrecioUnit] = useState('');
  const [carrito, setCarrito]     = useState([]);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [cliente, setCliente]     = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [ventaDevolver, setVentaDevolver] = useState(null);
  const [reloadHist, setReloadHist] = useState(0);
  const [ticketVentaId, setTicketVentaId] = useState(null);
  const { toasts, show }          = useToast();

  // Cargar productos al montar
  useEffect(() => {
    api.get('/stock').then(setProductos).catch(e => show(e.message, 'error'));
  }, []);

  const stockField = ubicacion === 'local' ? 'stockLocal' : 'stockActual';

  // Productos con stock > 0 en la ubicación activa
  const productosFiltrados = useMemo(
    () => productos.filter(p => p[stockField] > 0),
    [productos, stockField]
  );

  // Productos filtrados además por búsqueda de texto
  const productosVisibles = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return productosFiltrados;
    return productosFiltrados.filter(p =>
      p.nombre.toLowerCase().includes(term) ||
      (p.categoria || '').toLowerCase().includes(term)
    );
  }, [productosFiltrados, busqueda]);

  const productoActual = useMemo(
    () => productos.find(p => p.id === prodSel),
    [productos, prodSel]
  );

  const total = useMemo(
    () => carrito.reduce((s, i) => s + i.subtotal, 0),
    [carrito]
  );

  // Al cambiar ubicación, limpiar selección y búsqueda
  useEffect(() => {
    setProdSel(null);
    setCantidad('');
    setPrecioUnit('');
    setBusqueda('');
  }, [ubicacion]);

  function seleccionarProducto(p) {
    setProdSel(p.id);
    setCantidad('');
    setPrecioUnit('');
  }

  function agregarAlCarrito() {
    if (!prodSel || !cantidad || !precioUnit) {
      show('Selecciona producto, cantidad y precio', 'error'); return;
    }
    const qty   = Number(cantidad);
    const price = Number(precioUnit);
    const disponible = productoActual?.[stockField] ?? 0;

    if (qty <= 0)   { show('Cantidad debe ser mayor a 0', 'error'); return; }
    if (price <= 0) { show('Precio debe ser mayor a 0', 'error');   return; }

    const enCarrito = carrito
      .filter(i => i.productoId === prodSel)
      .reduce((s, i) => s + i.cantidad, 0);

    if (enCarrito + qty > disponible) {
      show(`Stock insuficiente. Disponible: ${disponible - enCarrito} ${productoActual.unidad}`, 'error');
      return;
    }

    setCarrito(prev => [
      ...prev,
      {
        productoId: prodSel,
        nombre:     productoActual.nombre,
        unidad:     productoActual.unidad,
        cantidad:   qty,
        precioUnit: price,
        subtotal:   qty * price,
      },
    ]);
    setCantidad('');
    setPrecioUnit('');
    // Dejar el producto seleccionado para agregar más fácilmente
  }

  function quitarItem(idx) {
    setCarrito(prev => prev.filter((_, i) => i !== idx));
  }

  async function finalizarVenta() {
    if (carrito.length === 0) { show('El carrito está vacío', 'error'); return; }
    setEnviando(true);
    try {
      const nuevaVenta = await api.post('/ventas', {
        metodoPago, cliente: cliente || null, ubicacion,
        nota: null,
        detalles: carrito.map(i => ({
          productoId: i.productoId,
          cantidad:   i.cantidad,
          precioUnit: i.precioUnit,
        })),
      });
      setCarrito([]);
      setCliente('');
      setMetodoPago('EFECTIVO');
      const fresh = await api.get('/stock');
      setProductos(fresh);
      show(`Venta registrada — ${formatMoney(total)}`, 'success');
      setTicketVentaId(nuevaVenta.id);
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  function handleDevolucionExitosa() {
    setVentaDevolver(null);
    setReloadHist(k => k + 1);
    show('Devolución registrada y stock reintegrado', 'success');
  }

  return (
    <div className="venta-page">
      {/* Tabs vista */}
      <div className="venta-tabs">
        <button className={`vtab${vista === 'nueva' ? ' vtab--on' : ''}`} onClick={() => setVista('nueva')}>
          🛒 Nueva Venta
        </button>
        <button className={`vtab${vista === 'historial' ? ' vtab--on' : ''}`} onClick={() => setVista('historial')}>
          📋 Historial Hoy
        </button>
      </div>

      {vista === 'historial' ? (
        <HistorialVentas
          onAnulada={(msg, type = 'success') => show(msg, type)}
          onDevolver={esAdmin ? (v) => setVentaDevolver(v) : undefined}
          reloadKey={reloadHist}
        />
      ) : (
        <div className="venta-layout">
          {/* ═══ COLUMNA IZQUIERDA — Selector de productos ═══════════════════ */}
          <div className="venta-left">
            <div className="col-header">
              <h3 className="col-title">Productos</h3>
              {/* Tabs de ubicación — VENDEDOR solo ve Local */}
              {!esVendedor && (
                <div className="ubi-tabs">
                  {['piladora', 'local'].map(u => (
                    <button
                      key={u}
                      className={`ubi-tab${ubicacion === u ? ' ubi-tab--on' : ''}`}
                      onClick={() => setUbicacion(u)}
                    >
                      {u === 'piladora' ? '🏭' : '🏪'} {u.charAt(0).toUpperCase() + u.slice(1)}
                    </button>
                  ))}
                </div>
              )}
              {esVendedor && (
                <span className="ubi-badge-local">🏪 Stock Local</span>
              )}
            </div>

            {/* Buscador */}
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                type="text"
                placeholder="Buscar producto..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
              {busqueda && (
                <button className="search-clear" onClick={() => setBusqueda('')}>✕</button>
              )}
            </div>

            {/* Contador */}
            <p className="prod-count">
              {productosVisibles.length} producto{productosVisibles.length !== 1 ? 's' : ''} disponibles
              {busqueda && ` · búsqueda: "${busqueda}"`}
            </p>

            {/* Grid de tarjetas de producto */}
            {productosVisibles.length === 0 ? (
              <div className="empty-state">
                {busqueda
                  ? <>No hay resultados para <strong>"{busqueda}"</strong></>
                  : 'Sin productos con stock disponible'
                }
              </div>
            ) : (
              <div className="prod-grid">
                {productosVisibles.map(p => {
                  const seleccionado = prodSel === p.id;
                  const enCarrito = carrito
                    .filter(i => i.productoId === p.id)
                    .reduce((s, i) => s + i.cantidad, 0);
                  const stockDisp = p[stockField] - enCarrito;
                  const icon = CATEGORIA_ICON[p.categoria] ?? '📋';

                  return (
                    <button
                      key={p.id}
                      className={`prod-card${seleccionado ? ' prod-card--sel' : ''}`}
                      onClick={() => seleccionarProducto(p)}
                    >
                      <span className="prod-icon">{icon}</span>
                      <span className="prod-nombre">{p.nombre}</span>
                      <span className={`prod-stock${stockDisp <= 5 ? ' prod-stock--low' : ''}`}>
                        {stockDisp} {p.unidad}
                      </span>
                      {enCarrito > 0 && (
                        <span className="prod-en-carrito">+{enCarrito} en carrito</span>
                      )}
                      {seleccionado && <span className="prod-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Panel de cantidad y precio — aparece al seleccionar un producto */}
            {productoActual && (
              <div className="add-panel">
                <div className="add-panel-header">
                  <span className="add-panel-nombre">{productoActual.nombre}</span>
                  <span className="add-panel-stock">
                    Disponible: <strong>{productoActual[stockField]} {productoActual.unidad}</strong>
                  </span>
                </div>

                <div className="field-row">
                  <label className="field-label">
                    Cantidad
                    <input
                      className="field-input"
                      type="number" min="0.5" step="0.5"
                      value={cantidad}
                      onChange={e => setCantidad(e.target.value)}
                      placeholder="0"
                      autoFocus
                    />
                  </label>
                  <label className="field-label">
                    Precio ($)
                    <input
                      className="field-input"
                      type="number" min="0.01" step="0.01"
                      value={precioUnit}
                      onChange={e => setPrecioUnit(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>

                {cantidad && precioUnit && (
                  <div className="preview-chip">
                    Subtotal: <strong>{formatMoney(Number(cantidad) * Number(precioUnit))}</strong>
                  </div>
                )}

                <button className="btn-agregar" onClick={agregarAlCarrito}>
                  + Agregar al carrito
                </button>
              </div>
            )}
          </div>

          {/* ═══ COLUMNA DERECHA — Carrito ═══════════════════════════════════ */}
          <div className="venta-right">
            <h3 className="col-title">🛒 Carrito</h3>

            {carrito.length === 0 ? (
              <div className="carrito-vacio">
                <span className="carrito-vacio-icon">🛒</span>
                <p>Selecciona un producto y agrégalo al carrito</p>
              </div>
            ) : (
              <ul className="carrito-list">
                {carrito.map((item, idx) => (
                  <li key={idx} className="carrito-item">
                    <div className="ci-info">
                      <span className="ci-nombre">{item.nombre}</span>
                      <span className="ci-detalle">
                        {item.cantidad} {item.unidad} × {formatMoney(item.precioUnit)}
                      </span>
                    </div>
                    <div className="ci-right">
                      <span className="ci-sub">{formatMoney(item.subtotal)}</span>
                      <button className="ci-remove" onClick={() => quitarItem(idx)} title="Quitar">✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="total-box">
              <span className="total-label">TOTAL</span>
              <span className="total-monto">{formatMoney(total)}</span>
            </div>

            {/* Método de pago — botones en lugar de select */}
            <div>
              <p className="field-label-text">Método de pago</p>
              <div className="pago-grid">
                {METODOS_PAGO.map(m => (
                  <button
                    key={m.value}
                    className={`pago-btn${metodoPago === m.value ? ' pago-btn--on' : ''}`}
                    onClick={() => setMetodoPago(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="field-label">
              Cliente (opcional)
              <input
                className="field-input"
                value={cliente}
                onChange={e => setCliente(e.target.value)}
                placeholder="Nombre del cliente"
              />
            </label>

            <button
              className="btn-finalizar"
              onClick={finalizarVenta}
              disabled={enviando || carrito.length === 0}
            >
              {enviando
                ? '⏳ Procesando...'
                : `✅ Finalizar Venta · ${formatMoney(total)}`
              }
            </button>
          </div>
        </div>
      )}

      {/* Modal de ticket */}
      {ticketVentaId && (
        <ModalTicket
          ventaId={ticketVentaId}
          onClose={() => setTicketVentaId(null)}
        />
      )}

      {/* Modal de devolución */}
      {ventaDevolver && (
        <ModalDevolucion
          venta={ventaDevolver}
          onClose={() => setVentaDevolver(null)}
          onSuccess={handleDevolucionExitosa}
          show={show}
        />
      )}

      <ToastContainer toasts={toasts} />

      <style>{`
        /* ── Página ── */
        .venta-page { display: flex; flex-direction: column; gap: 16px; }

        /* ── Tabs vista ── */
        .venta-tabs { display: flex; gap: 6px; }
        .vtab {
          padding: 9px 20px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 14px; cursor: pointer;
          font-weight: 500; transition: all 0.15s;
        }
        .vtab:hover { color: var(--text-primary); background: var(--bg-card); }
        .vtab--on {
          background: rgba(124,106,247,0.15); color: var(--accent-purple);
          border-color: var(--accent-purple);
        }

        /* ── Layout dos columnas ── */
        .venta-layout {
          display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; align-items: start;
        }
        .venta-left, .venta-right {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; padding: 20px;
          display: flex; flex-direction: column; gap: 14px;
        }

        /* ── Encabezado columna ── */
        .col-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .col-title { font-size: 15px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

        /* ── Tabs ubicación ── */
        .ubi-tabs { display: flex; gap: 6px; }
        .ubi-tab {
          padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 12px;
          font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .ubi-tab--on {
          background: rgba(96,165,250,0.15); color: var(--accent-blue); border-color: var(--accent-blue);
        }
        .ubi-badge-local {
          font-size: 12px; font-weight: 600; color: #fbbf24;
          background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3);
          border-radius: 20px; padding: 4px 12px;
        }

        /* ── Buscador ── */
        .search-wrap {
          display: flex; align-items: center; gap: 8px;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 10px; padding: 8px 12px;
          transition: border-color 0.15s;
        }
        .search-wrap:focus-within { border-color: var(--accent-purple); }
        .search-icon { font-size: 14px; flex-shrink: 0; }
        .search-input {
          background: none; border: none; outline: none; flex: 1;
          color: var(--text-primary); font-size: 14px;
        }
        .search-input::placeholder { color: var(--text-secondary); }
        .search-clear {
          background: none; border: none; color: var(--text-secondary);
          cursor: pointer; font-size: 12px; padding: 2px 4px; line-height: 1;
        }
        .search-clear:hover { color: var(--text-primary); }

        /* ── Contador ── */
        .prod-count { font-size: 12px; color: var(--text-secondary); margin: -6px 0; }

        /* ── Estado vacío ── */
        .empty-state {
          font-size: 14px; color: var(--text-secondary); text-align: center;
          padding: 24px 12px; background: var(--bg-base); border-radius: 10px;
          border: 1px dashed var(--border);
        }

        /* ── Grid de tarjetas de producto ── */
        .prod-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px;
          max-height: 340px; overflow-y: auto; padding-right: 2px;
        }
        .prod-grid::-webkit-scrollbar { width: 4px; }
        .prod-grid::-webkit-scrollbar-track { background: transparent; }
        .prod-grid::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        .prod-card {
          position: relative;
          display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
          background: var(--bg-base); border: 2px solid var(--border);
          border-radius: 10px; padding: 10px 12px; cursor: pointer;
          transition: all 0.15s; text-align: left;
        }
        .prod-card:hover { border-color: var(--accent-purple); background: rgba(124,106,247,0.05); }
        .prod-card--sel {
          border-color: var(--accent-purple);
          background: rgba(124,106,247,0.12);
        }
        .prod-icon   { font-size: 18px; line-height: 1; }
        .prod-nombre { font-size: 12px; font-weight: 600; color: var(--text-primary); line-height: 1.3; }
        .prod-stock  { font-size: 11px; color: var(--accent-green); font-weight: 500; }
        .prod-stock--low { color: #f87171; }
        .prod-en-carrito {
          font-size: 10px; color: var(--accent-blue); font-weight: 600;
          background: rgba(96,165,250,0.1); border-radius: 4px; padding: 1px 5px;
        }
        .prod-check {
          position: absolute; top: 6px; right: 8px;
          font-size: 12px; color: var(--accent-purple); font-weight: 700;
        }

        /* ── Panel de agregar ── */
        .add-panel {
          background: rgba(124,106,247,0.06); border: 1px solid rgba(124,106,247,0.25);
          border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px;
        }
        .add-panel-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
        .add-panel-nombre { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .add-panel-stock  { font-size: 12px; color: var(--text-secondary); }
        .add-panel-stock strong { color: var(--text-primary); }

        .field-label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-secondary); }
        .field-label-text { font-size: 13px; color: var(--text-secondary); margin: 0 0 6px; }
        .field-input {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .field-input:focus { border-color: var(--accent-purple); }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .preview-chip {
          font-size: 13px; color: var(--text-secondary);
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 8px; padding: 8px 12px;
        }
        .preview-chip strong { color: var(--accent-green); font-size: 16px; }

        .btn-agregar {
          background: var(--accent-blue); color: #fff; border: none;
          border-radius: 8px; padding: 10px; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: opacity 0.15s;
        }
        .btn-agregar:hover { opacity: 0.85; }

        /* ── Carrito ── */
        .carrito-vacio {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          color: var(--text-secondary); font-size: 14px; padding: 24px;
          background: var(--bg-base); border: 1px dashed var(--border);
          border-radius: 10px; text-align: center;
        }
        .carrito-vacio-icon { font-size: 32px; opacity: 0.4; }

        .carrito-list {
          list-style: none; margin: 0; padding: 0;
          display: flex; flex-direction: column; gap: 6px;
          max-height: 280px; overflow-y: auto;
        }
        .carrito-item {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 10px 12px;
        }
        .ci-info    { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .ci-nombre  { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .ci-detalle { font-size: 12px; color: var(--text-secondary); }
        .ci-right   { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .ci-sub     { font-weight: 700; color: var(--accent-green); font-size: 14px; }
        .ci-remove  {
          background: none; border: none; color: var(--text-secondary); font-size: 14px;
          cursor: pointer; padding: 2px 4px; line-height: 1; border-radius: 4px;
          transition: all 0.1s;
        }
        .ci-remove:hover { color: #f87171; background: rgba(248,113,113,0.1); }

        /* ── Total ── */
        .total-box {
          display: flex; justify-content: space-between; align-items: center;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 10px; padding: 14px 16px;
        }
        .total-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); letter-spacing: 1px; }
        .total-monto { font-size: 28px; font-weight: 700; color: var(--accent-green); }

        /* ── Métodos de pago como botones ── */
        .pago-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
        }
        .pago-btn {
          padding: 8px 4px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 12px;
          font-weight: 600; cursor: pointer; transition: all 0.15s; text-align: center;
        }
        .pago-btn:hover { border-color: var(--text-secondary); color: var(--text-primary); }
        .pago-btn--on {
          background: rgba(74,222,128,0.15); color: var(--accent-green); border-color: var(--accent-green);
        }

        /* ── Botón finalizar ── */
        .btn-finalizar {
          background: var(--accent-green); color: #0a2010; border: none;
          border-radius: 10px; padding: 14px; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: all 0.15s; letter-spacing: 0.2px;
        }
        .btn-finalizar:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .btn-finalizar:active:not(:disabled) { transform: translateY(0); }
        .btn-finalizar:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .venta-layout { grid-template-columns: 1fr; }
          .field-row    { grid-template-columns: 1fr; }
          .prod-grid    { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
        }
      `}</style>
    </div>
  );
}
