import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { formatMoney } from '../../utils/format';
import { useToast, ToastContainer } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import HistorialVentas from './HistorialVentas';
import ModalTicket from './ModalTicket';

const METODOS_PAGO = ['Efectivo', 'Yappy', 'Fiado'];

// ─── Modal de Devolución ──────────────────────────────────────────────────────
// Se muestra cuando el ADMIN hace clic en "↩ Devolver" en el historial.
function ModalDevolucion({ venta, onClose, onSuccess, show }) {
  // Estado: cantidad a devolver por cada ítem del detalle (key = detalle.id)
  const [cantidades, setCantidades] = useState(
    Object.fromEntries(venta.detalles.map(d => [d.id, '']))
  );
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Calcular total a devolver en tiempo real
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
      show('Ingresa al menos una cantidad a devolver', 'error');
      return;
    }
    if (!motivo.trim()) {
      show('El motivo de la devolución es requerido', 'error');
      return;
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

        {/* Badge informativo si la venta era a crédito */}
        {venta.metodoPago === 'CREDITO' && (
          <div className="badge-credito-info">
            Esta devolución reducirá el saldo del crédito del cliente
          </div>
        )}

        {/* Lista de productos con input de cantidad a devolver */}
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
                  type="number"
                  min="0"
                  max={d.cantidad}
                  step="0.5"
                  placeholder="0"
                  value={cantidades[d.id]}
                  onChange={e => setCantidades(prev => ({ ...prev, [d.id]: e.target.value }))}
                />
                <span className="dev-unidad">{d.producto.unidad}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Total en tiempo real */}
        <div className="dev-total">
          Total a devolver: <strong>{formatMoney(totalDevolver)}</strong>
        </div>

        {/* Campo motivo */}
        <label className="field-label">
          Motivo
          <textarea
            className="field-input dev-motivo"
            rows={2}
            placeholder="Describe el motivo de la devolución..."
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
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
  const { esAdmin }               = useAuth();
  const [vista, setVista]         = useState('nueva');   // 'nueva' | 'historial'
  const [ubicacion, setUbicacion] = useState('piladora');
  const [productos, setProductos] = useState([]);
  const [prodSel, setProdSel]     = useState('');
  const [cantidad, setCantidad]   = useState('');
  const [precioUnit, setPrecioUnit] = useState('');
  const [carrito, setCarrito]     = useState([]);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [cliente, setCliente]     = useState('');
  const [enviando, setEnviando]   = useState(false);
  // Modal de devolución: almacena la venta seleccionada o null
  const [ventaDevolver, setVentaDevolver] = useState(null);
  // Incrementar para forzar recarga del historial tras una devolución exitosa
  const [reloadHist, setReloadHist] = useState(0);
  // Modal de ticket: se abre automáticamente al registrar una venta
  const [ticketVentaId, setTicketVentaId] = useState(null);
  const { toasts, show }          = useToast();

  useEffect(() => {
    api.get('/stock').then(setProductos).catch(e => show(e.message, 'error'));
  }, []);

  const stockField = ubicacion === 'local' ? 'stockLocal' : 'stockActual';

  const productosFiltrados = useMemo(
    () => productos.filter(p => p[stockField] > 0),
    [productos, stockField]
  );

  const productoActual = useMemo(
    () => productos.find(p => p.id === Number(prodSel)),
    [productos, prodSel]
  );

  const total = useMemo(
    () => carrito.reduce((s, i) => s + i.subtotal, 0),
    [carrito]
  );

  // Auto-seleccionar primer producto al cambiar tab de ubicación
  useEffect(() => {
    setProdSel(productosFiltrados[0]?.id?.toString() ?? '');
    setCantidad('');
    setPrecioUnit('');
  }, [ubicacion]);

  function agregarAlCarrito() {
    if (!prodSel || !cantidad || !precioUnit) {
      show('Completa producto, cantidad y precio', 'error'); return;
    }
    const qty = Number(cantidad);
    const price = Number(precioUnit);
    const disponible = productoActual?.[stockField] ?? 0;

    if (qty <= 0) { show('Cantidad debe ser mayor a 0', 'error'); return; }
    if (price <= 0) { show('Precio debe ser mayor a 0', 'error'); return; }

    // Verificar stock incluyendo lo ya en carrito
    const enCarrito = carrito
      .filter(i => i.productoId === Number(prodSel))
      .reduce((s, i) => s + i.cantidad, 0);
    if (enCarrito + qty > disponible) {
      show(`Stock insuficiente. Disponible: ${disponible - enCarrito} ${productoActual.unidad}`, 'error');
      return;
    }

    setCarrito(prev => [
      ...prev,
      {
        productoId: Number(prodSel),
        nombre:     productoActual.nombre,
        unidad:     productoActual.unidad,
        cantidad:   qty,
        precioUnit: price,
        subtotal:   qty * price,
      },
    ]);
    setCantidad('');
    setPrecioUnit('');
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
      setMetodoPago('Efectivo');
      // Recargar productos para actualizar stock en pantalla
      const fresh = await api.get('/stock');
      setProductos(fresh);
      show(`Venta registrada — ${formatMoney(total)}`, 'success');
      // Mostrar ticket automáticamente
      setTicketVentaId(nuevaVenta.id);
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  // Callback: devolución completada con éxito
  function handleDevolucionExitosa() {
    setVentaDevolver(null);
    setReloadHist(k => k + 1); // dispara recarga del historial
    show('Devolución registrada y stock reintegrado', 'success');
  }

  return (
    <div className="venta-page">
      {/* Tabs vista */}
      <div className="venta-tabs">
        <button className={`vtab${vista === 'nueva' ? ' vtab--on' : ''}`} onClick={() => setVista('nueva')}>Nueva Venta</button>
        <button className={`vtab${vista === 'historial' ? ' vtab--on' : ''}`} onClick={() => setVista('historial')}>Historial Hoy</button>
      </div>

      {vista === 'historial' ? (
        <HistorialVentas
          onAnulada={(msg, type = 'success') => show(msg, type)}
          onDevolver={esAdmin ? (v) => setVentaDevolver(v) : undefined}
          reloadKey={reloadHist}
        />
      ) : (
        <div className="venta-layout">
          {/* COLUMNA IZQUIERDA — Selector */}
          <div className="venta-left">
            <h3 className="col-title">Agregar producto</h3>

            {/* Tab ubicación */}
            <div className="ubi-tabs">
              {['piladora', 'local'].map(u => (
                <button
                  key={u}
                  className={`ubi-tab${ubicacion === u ? ' ubi-tab--on' : ''}`}
                  onClick={() => setUbicacion(u)}
                >
                  {u.charAt(0).toUpperCase() + u.slice(1)}
                </button>
              ))}
            </div>

            {/* Select producto */}
            <label className="field-label">
              Producto
              <select
                className="field-input"
                value={prodSel}
                onChange={e => { setProdSel(e.target.value); setPrecioUnit(''); }}
              >
                {productosFiltrados.length === 0 && <option value="">Sin stock disponible</option>}
                {productosFiltrados.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — stock: {p[stockField]} {p.unidad}
                  </option>
                ))}
              </select>
            </label>

            {productoActual && (
              <div className="stock-chip">
                Stock disponible: <strong>{productoActual[stockField]} {productoActual.unidad}</strong>
              </div>
            )}

            <div className="field-row">
              <label className="field-label">
                Cantidad
                <input
                  className="field-input"
                  type="number" min="0.5" step="0.5"
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="field-label">
                Precio unitario ($)
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

          {/* COLUMNA DERECHA — Carrito */}
          <div className="venta-right">
            <h3 className="col-title">Carrito</h3>

            {carrito.length === 0 ? (
              <p className="carrito-vacio">Carrito vacío</p>
            ) : (
              <ul className="carrito-list">
                {carrito.map((item, idx) => (
                  <li key={idx} className="carrito-item">
                    <div className="ci-info">
                      <span className="ci-nombre">{item.nombre}</span>
                      <span className="ci-detalle">{item.cantidad} {item.unidad} × {formatMoney(item.precioUnit)}</span>
                    </div>
                    <div className="ci-right">
                      <span className="ci-sub">{formatMoney(item.subtotal)}</span>
                      <button className="ci-remove" onClick={() => quitarItem(idx)}>✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="total-box">
              <span className="total-label">TOTAL</span>
              <span className="total-monto">{formatMoney(total)}</span>
            </div>

            <label className="field-label">
              Método de pago
              <select className="field-input" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

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
              {enviando ? 'Procesando...' : 'Finalizar Venta'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de ticket — se abre automáticamente al registrar una venta */}
      {ticketVentaId && (
        <ModalTicket
          ventaId={ticketVentaId}
          onClose={() => setTicketVentaId(null)}
        />
      )}

      {/* Modal de devolución — solo visible cuando el ADMIN selecciona una venta */}
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
        .venta-page { display: flex; flex-direction: column; gap: 16px; }

        .venta-tabs { display: flex; gap: 6px; }
        .vtab {
          padding: 8px 18px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 14px; cursor: pointer;
          transition: all 0.15s;
        }
        .vtab:hover { color: var(--text-primary); background: var(--bg-card); }
        .vtab--on {
          background: rgba(124,106,247,0.15); color: var(--accent-purple);
          border-color: var(--accent-purple);
        }

        .venta-layout {
          display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;
        }
        .venta-left, .venta-right {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; padding: 20px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .col-title { font-size: 15px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

        .ubi-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .ubi-tab {
          padding: 8px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.15s; text-transform: capitalize;
        }
        .ubi-tab--on {
          background: rgba(96,165,250,0.15); color: var(--accent-blue); border-color: var(--accent-blue);
        }

        .field-label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-secondary); }
        .field-input {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .field-input:focus { border-color: var(--accent-purple); }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .stock-chip, .preview-chip {
          font-size: 13px; color: var(--text-secondary);
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 8px 12px;
        }
        .stock-chip strong, .preview-chip strong { color: var(--text-primary); }

        .btn-agregar {
          background: var(--accent-blue); color: #fff; border: none;
          border-radius: 8px; padding: 10px; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: opacity 0.15s;
        }
        .btn-agregar:hover { opacity: 0.85; }

        /* Carrito */
        .carrito-vacio { color: var(--text-secondary); font-size: 14px; text-align: center; padding: 20px; }
        .carrito-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
        .carrito-item {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          background: var(--bg-base); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;
        }
        .ci-info { display: flex; flex-direction: column; gap: 2px; }
        .ci-nombre { font-size: 13px; font-weight: 600; color: var(--text-primary); }
        .ci-detalle { font-size: 12px; color: var(--text-secondary); }
        .ci-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .ci-sub { font-weight: 700; color: var(--accent-green); font-size: 14px; }
        .ci-remove {
          background: none; border: none; color: var(--text-secondary); font-size: 14px;
          cursor: pointer; padding: 2px 4px; line-height: 1;
        }
        .ci-remove:hover { color: var(--accent-red); }

        .total-box {
          display: flex; justify-content: space-between; align-items: center;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 10px; padding: 14px 16px;
        }
        .total-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); letter-spacing: 1px; }
        .total-monto { font-size: 28px; font-weight: 700; color: var(--accent-green); }

        .btn-finalizar {
          background: var(--accent-green); color: #0a2010; border: none;
          border-radius: 8px; padding: 12px; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: opacity 0.15s;
        }
        .btn-finalizar:hover:not(:disabled) { opacity: 0.85; }
        .btn-finalizar:disabled { opacity: 0.4; cursor: not-allowed; }

        @media (max-width: 768px) {
          .venta-layout { grid-template-columns: 1fr; }
          .field-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
