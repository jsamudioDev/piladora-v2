import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast, ToastContainer } from '../../components/Toast';
import { formatMoney } from '../../utils/format';
import ModalProducto from './ModalProducto';
import ModalMovimiento from './ModalMovimiento';

const CATS = [
  { key: 'todos',    label: 'Todos' },
  { key: 'grano',    label: 'Grano' },
  { key: 'pilado',   label: 'Pilado' },
  { key: 'alimento', label: 'Alimento' },
];

// Secciones principales solo visibles para ADMIN
const SECCIONES = [
  { key: 'inventario',  label: 'Inventario' },
  { key: 'traspasos',   label: 'Traspasos' },
  { key: 'movimientos', label: 'Movimientos' },
];

function colorPunto(producto) {
  if (producto.stockActual <= producto.stockMinimo) return 'var(--accent-red)';
  if (producto.stockActual <= producto.stockMinimo * 1.5) return '#facc15';
  return 'var(--accent-green)';
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-PA', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function Stock() {
  const { esAdmin, esOperario, esVendedor } = useAuth();

  const [productos, setProductos]     = useState([]);
  const [busqueda, setBusqueda]       = useState('');
  const [cat, setCat]                 = useState('todos');
  const [seccion, setSeccion]         = useState('inventario'); // solo ADMIN
  const [modalProd, setModalProd]     = useState(null);
  const [modalMov, setModalMov]       = useState(false);
  const [loading, setLoading]         = useState(true);

  // ─── Estado Traspasos ─────────────────────────────────────────────────────
  const [tProdId, setTProdId]     = useState('');
  const [tCantidad, setTCantidad] = useState('');
  const [tOrigen, setTOrigen]     = useState('piladora');
  const [tMotivo, setTMotivo]     = useState('');
  const [traspasos, setTraspasos] = useState([]);
  const [enviandoT, setEnviandoT] = useState(false);

  // ─── Estado Movimientos ───────────────────────────────────────────────────
  const [movimientos, setMovimientos] = useState([]);

  const { toasts, show } = useToast();

  // El destino siempre es el contrario del origen
  const tDestino = tOrigen === 'piladora' ? 'local' : 'piladora';

  // Título y subtítulo según rol
  const titulo   = esOperario ? 'Stock Piladora'
                 : esVendedor ? 'Stock Local'
                 : 'Inventario';
  const subtitulo = esOperario ? 'Productos en planta de producción'
                  : esVendedor ? 'Productos disponibles en el local'
                  : null;

  async function cargarProductos() {
    try {
      const data = await api.get('/stock');
      setProductos(data);
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function cargarTraspasos() {
    try {
      const data = await api.get('/traspasos');
      setTraspasos(data);
    } catch (e) {
      show(e.message, 'error');
    }
  }

  async function cargarMovimientos() {
    try {
      const data = await api.get('/stock/movimientos');
      setMovimientos(data);
    } catch (e) {
      show(e.message, 'error');
    }
  }

  useEffect(() => { cargarProductos(); }, []);

  // Cargar datos de la sección activa cuando el ADMIN cambia de tab
  useEffect(() => {
    if (seccion === 'traspasos')   cargarTraspasos();
    if (seccion === 'movimientos') cargarMovimientos();
  }, [seccion]);

  const filtrados = useMemo(() => {
    return productos
      .filter(p => cat === 'todos' || p.categoria === cat)
      .filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  }, [productos, cat, busqueda]);

  const valorTotal = useMemo(
    () => productos.reduce((acc, p) => acc + (esAdmin ? p.stockActual + p.stockLocal : p.stockActual), 0),
    [productos, esAdmin]
  );

  async function handleGuardarProducto(datos, id) {
    try {
      if (id) {
        await api.put(`/stock/productos/${id}`, datos);
        show('Producto actualizado', 'success');
      } else {
        await api.post('/stock/productos', datos);
        show('Producto creado', 'success');
      }
      setModalProd(null);
      cargarProductos();
    } catch (e) {
      show(e.message, 'error');
    }
  }

  async function handleGuardarMovimiento(datos) {
    try {
      await api.post('/stock/movimiento', datos);
      show('Movimiento registrado', 'success');
      setModalMov(false);
      cargarProductos();
      // Refrescar tabla de movimientos si está activa
      if (seccion === 'movimientos') cargarMovimientos();
    } catch (e) {
      show(e.message, 'error');
    }
  }

  async function registrarTraspaso() {
    if (!tProdId || !tCantidad) {
      show('Selecciona un producto e ingresa la cantidad', 'error'); return;
    }
    setEnviandoT(true);
    try {
      await api.post('/traspasos', {
        productoId: Number(tProdId),
        cantidad:   Number(tCantidad),
        origen:     tOrigen,
        destino:    tDestino,
        motivo:     tMotivo.trim() || null,
      });
      show(`Traspaso registrado: ${tCantidad} u. de ${tOrigen} → ${tDestino}`, 'success');
      // Limpiar formulario
      setTCantidad('');
      setTMotivo('');
      cargarProductos();
      cargarTraspasos();
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setEnviandoT(false);
    }
  }

  // ─── Render sección INVENTARIO ─────────────────────────────────────────────
  function renderInventario() {
    return (
      <>
        <input
          className="stock-search"
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />

        {/* Tabs de categoría */}
        <div className="stock-tabs">
          {CATS.map(t => (
            <button
              key={t.key}
              className={`tab-btn${cat === t.key ? ' tab-btn--active' : ''}`}
              onClick={() => setCat(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="stock-loading">Cargando...</p>
        ) : (
          <div className="stock-table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>{esVendedor ? 'Cant. Local' : 'Cant. Piladora'}</th>
                  {esAdmin && <th>Cant. Local</th>}
                  <th>Mínimo</th>
                  <th>Unidad</th>
                  {esAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr><td colSpan={esAdmin ? 8 : 6} className="empty">Sin resultados</td></tr>
                )}
                {filtrados.map(p => (
                  <tr key={p.id} className="stock-row">
                    <td><span className="punto" style={{ background: colorPunto(p) }} /></td>
                    <td className="nombre">{p.nombre}</td>
                    <td className="cat">{p.categoria}</td>
                    <td className="num">{esVendedor ? p.stockLocal : p.stockActual}</td>
                    {esAdmin && <td className="num">{p.stockLocal}</td>}
                    <td className="num muted">{p.stockMinimo}</td>
                    <td className="muted">{p.unidad}</td>
                    {esAdmin && (
                      <td>
                        <button className="btn-edit" onClick={() => setModalProd(p)}>Editar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  // ─── Render sección TRASPASOS ──────────────────────────────────────────────
  function renderTraspasos() {
    return (
      <div className="traspasos-wrap">
        {/* Formulario de traspaso */}
        <div className="traspaso-form">
          <h3 className="sec-title">Registrar Traspaso</h3>

          <label className="field-label">
            Producto
            <select
              className="field-input"
              value={tProdId}
              onChange={e => setTProdId(e.target.value)}
            >
              <option value="">Seleccionar producto...</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — Piladora: {p.stockActual} | Local: {p.stockLocal} {p.unidad}
                </option>
              ))}
            </select>
          </label>

          <div className="field-row-3">
            <label className="field-label">
              Cantidad
              <input
                className="field-input"
                type="number" min="0.5" step="0.5"
                value={tCantidad}
                onChange={e => setTCantidad(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="field-label">
              Origen
              <select
                className="field-input"
                value={tOrigen}
                onChange={e => setTOrigen(e.target.value)}
              >
                <option value="piladora">Piladora</option>
                <option value="local">Local</option>
              </select>
            </label>
            <label className="field-label">
              Destino
              {/* El destino se auto-completa con el contrario del origen */}
              <input
                className="field-input"
                value={tDestino.charAt(0).toUpperCase() + tDestino.slice(1)}
                readOnly
              />
            </label>
          </div>

          <label className="field-label">
            Motivo (opcional)
            <input
              className="field-input"
              value={tMotivo}
              onChange={e => setTMotivo(e.target.value)}
              placeholder="Ej: abastecimiento para el fin de semana"
            />
          </label>

          <button
            className="btn-traspaso"
            onClick={registrarTraspaso}
            disabled={enviandoT}
          >
            {enviandoT ? 'Registrando...' : 'Registrar Traspaso'}
          </button>
        </div>

        {/* Historial de traspasos */}
        <div className="traspaso-hist">
          <h3 className="sec-title">Últimos Traspasos</h3>
          {traspasos.length === 0 ? (
            <p className="empty-msg">Sin traspasos registrados.</p>
          ) : (
            <div className="stock-table-wrap">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>De → Hacia</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {traspasos.map(t => (
                    <tr key={t.id} className="stock-row">
                      <td className="muted">{formatFecha(t.createdAt)}</td>
                      <td className="nombre">{t.producto.nombre}</td>
                      <td className="num">{t.cantidad} {t.producto.unidad}</td>
                      <td>
                        <span className="ubi-badge">{t.origen}</span>
                        {' → '}
                        <span className="ubi-badge">{t.destino}</span>
                      </td>
                      <td className="muted">{t.motivo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Render sección MOVIMIENTOS ────────────────────────────────────────────
  function renderMovimientos() {
    return (
      <div>
        {movimientos.length === 0 ? (
          <p className="empty-msg">Sin movimientos registrados.</p>
        ) : (
          <div className="stock-table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Ubicación</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id} className="stock-row">
                    <td className="muted">{formatFecha(m.createdAt)}</td>
                    <td className="nombre">{m.producto.nombre}</td>
                    <td>
                      <span className={`tipo-badge tipo-${m.tipo.toLowerCase()}`}>{m.tipo}</span>
                    </td>
                    <td className="num">{m.cantidad} {m.producto.unidad}</td>
                    <td className="muted">{m.ubicacion || '—'}</td>
                    <td className="muted">{m.motivo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stock-page">
      {/* Topbar */}
      <div className="stock-topbar">
        <div>
          <h2 className="stock-title">{titulo}</h2>
          <p className="stock-sub">
            {subtitulo || `Total: ${valorTotal.toFixed(1)} unidades en stock`}
          </p>
        </div>
        {/* Botón de movimiento solo visible en inventario o para no-admin */}
        {(seccion === 'inventario' || !esAdmin) && (
          <div className="stock-actions">
            <button className="btn-secondary" onClick={() => setModalMov(true)}>
              ± Movimiento
            </button>
            {esAdmin && (
              <button className="btn-primary" onClick={() => setModalProd('nuevo')}>
                + Producto
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs de sección — solo ADMIN */}
      {esAdmin && (
        <div className="seccion-tabs">
          {SECCIONES.map(s => (
            <button
              key={s.key}
              className={`stab${seccion === s.key ? ' stab--on' : ''}`}
              onClick={() => setSeccion(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Contenido según sección activa */}
      {seccion === 'inventario'  && renderInventario()}
      {seccion === 'traspasos'   && renderTraspasos()}
      {seccion === 'movimientos' && renderMovimientos()}

      {/* Modales */}
      {modalProd && (
        <ModalProducto
          producto={modalProd === 'nuevo' ? null : modalProd}
          onGuardar={handleGuardarProducto}
          onCerrar={() => setModalProd(null)}
        />
      )}
      {modalMov && (
        <ModalMovimiento
          productos={productos}
          onGuardar={handleGuardarMovimiento}
          onCerrar={() => setModalMov(false)}
        />
      )}

      <ToastContainer toasts={toasts} />

      <style>{`
        .stock-page { display: flex; flex-direction: column; gap: 16px; }

        .stock-topbar {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          flex-wrap: wrap;
        }
        .stock-title { font-size: 22px; margin-bottom: 2px; }
        .stock-sub   { font-size: 13px; color: var(--text-secondary); }
        .stock-actions { display: flex; gap: 10px; flex-shrink: 0; }

        .btn-primary {
          background: var(--accent-purple); color: #fff;
          border: none; border-radius: 8px; padding: 9px 18px;
          font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .btn-primary:hover { opacity: 0.85; }

        .btn-secondary {
          background: var(--bg-card); color: var(--text-primary);
          border: 1px solid var(--border); border-radius: 8px; padding: 9px 18px;
          font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s;
        }
        .btn-secondary:hover { background: var(--border); }

        /* Tabs de sección principal (ADMIN) */
        .seccion-tabs { display: flex; gap: 6px; }
        .stab {
          padding: 8px 20px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 14px; font-weight: 500;
          cursor: pointer; transition: all 0.15s;
        }
        .stab:hover { color: var(--text-primary); background: var(--bg-card); }
        .stab--on {
          background: rgba(124,106,247,0.15); color: var(--accent-purple);
          border-color: var(--accent-purple); font-weight: 600;
        }

        .stock-search {
          width: 100%; padding: 10px 14px;
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text-primary); font-size: 14px; outline: none;
        }
        .stock-search:focus { border-color: var(--accent-purple); }

        /* Tabs de categoría (dentro de Inventario) */
        .stock-tabs { display: flex; gap: 6px; }
        .tab-btn {
          padding: 7px 16px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 13px;
          cursor: pointer; transition: all 0.15s;
        }
        .tab-btn:hover { color: var(--text-primary); background: var(--bg-card); }
        .tab-btn--active {
          background: rgba(124,106,247,0.15); color: var(--accent-purple);
          border-color: var(--accent-purple);
        }

        .stock-loading { color: var(--text-secondary); text-align: center; padding: 40px; }

        .stock-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
        .stock-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .stock-table th {
          padding: 10px 14px; text-align: left;
          font-size: 12px; font-weight: 600; text-transform: uppercase;
          color: var(--text-secondary); background: var(--bg-card);
          border-bottom: 1px solid var(--border);
        }
        .stock-row td { padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .stock-row:last-child td { border-bottom: none; }
        .stock-row:hover td { background: rgba(255,255,255,0.02); }

        .punto { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
        .nombre { font-weight: 500; color: var(--text-primary); }
        .cat    { color: var(--text-secondary); text-transform: capitalize; }
        .num    { font-weight: 600; text-align: right; }
        .muted  { color: var(--text-secondary); }
        .empty  { text-align: center; padding: 32px; color: var(--text-secondary); }

        .btn-edit {
          background: none; border: 1px solid var(--border);
          color: var(--text-secondary); border-radius: 6px;
          padding: 4px 10px; font-size: 12px; cursor: pointer; transition: all 0.15s;
        }
        .btn-edit:hover { color: var(--text-primary); border-color: var(--text-primary); }

        /* ─── Traspasos ─── */
        .traspasos-wrap { display: flex; flex-direction: column; gap: 24px; }
        .traspaso-form {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; padding: 20px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .sec-title { font-size: 14px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
        .field-label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-secondary); }
        .field-input {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .field-input:focus { border-color: var(--accent-purple); }
        .field-input[readonly] { opacity: 0.6; cursor: default; }
        .field-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }

        .btn-traspaso {
          background: var(--accent-purple); color: #fff; border: none;
          border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600;
          cursor: pointer; align-self: flex-start; transition: opacity 0.15s;
        }
        .btn-traspaso:hover:not(:disabled) { opacity: 0.85; }
        .btn-traspaso:disabled { opacity: 0.4; cursor: not-allowed; }

        .traspaso-hist { display: flex; flex-direction: column; gap: 10px; }
        .empty-msg { color: var(--text-secondary); font-size: 14px; text-align: center; padding: 32px; }

        .ubi-badge {
          font-size: 11px; font-weight: 600; text-transform: capitalize;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 6px; padding: 2px 7px; color: var(--text-secondary);
        }

        /* ─── Badges tipo movimiento ─── */
        .tipo-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; }
        .tipo-entrada { background: rgba(74,222,128,0.15); color: var(--accent-green); }
        .tipo-salida  { background: rgba(248,113,113,0.15); color: var(--accent-red); }

        @media (max-width: 600px) {
          .field-row-3 { grid-template-columns: 1fr; }
          .stock-table th:nth-child(3),
          .stock-row td:nth-child(3) { display: none; }
        }
      `}</style>
    </div>
  );
}
