import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { formatMoney } from '../../utils/format';
import { useToast, ToastContainer } from '../../components/Toast';
import HistorialVentas from './HistorialVentas';

const METODOS_PAGO = ['Efectivo', 'Yappy', 'Fiado'];

export default function Venta() {
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

  // Auto-seleccionar primer producto al cambiar tab
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
    const enCarrito = carrito.filter(i => i.productoId === Number(prodSel)).reduce((s, i) => s + i.cantidad, 0);
    if (enCarrito + qty > disponible) {
      show(`Stock insuficiente. Disponible: ${disponible - enCarrito} ${productoActual.unidad}`, 'error'); return;
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
      await api.post('/ventas', {
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
      // Recargar productos para actualizar stock
      const fresh = await api.get('/stock');
      setProductos(fresh);
      show(`Venta registrada — ${formatMoney(total)}`, 'success');
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="venta-page">
      {/* Tabs vista */}
      <div className="venta-tabs">
        <button className={`vtab${vista === 'nueva' ? ' vtab--on' : ''}`} onClick={() => setVista('nueva')}>Nueva Venta</button>
        <button className={`vtab${vista === 'historial' ? ' vtab--on' : ''}`} onClick={() => setVista('historial')}>Historial Hoy</button>
      </div>

      {vista === 'historial' ? (
        <HistorialVentas onAnulada={(msg, type = 'success') => show(msg, type)} />
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
