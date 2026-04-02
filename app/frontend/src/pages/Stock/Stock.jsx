import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast, ToastContainer } from '../../components/Toast';
import ModalProducto from './ModalProducto';
import ModalMovimiento from './ModalMovimiento';

const TABS = [
  { key: 'todos',    label: 'Todos' },
  { key: 'grano',    label: 'Grano' },
  { key: 'pilado',   label: 'Pilado' },
  { key: 'alimento', label: 'Alimento' },
];

function colorPunto(producto) {
  if (producto.stockActual <= producto.stockMinimo) return 'var(--accent-red)';
  if (producto.stockActual <= producto.stockMinimo * 1.5) return '#facc15';
  return 'var(--accent-green)';
}

export default function Stock() {
  const { esAdmin, esOperario, esVendedor } = useAuth();

  const [productos, setProductos]   = useState([]);
  const [busqueda, setBusqueda]     = useState('');
  const [tab, setTab]               = useState('todos');
  const [modalProd, setModalProd]   = useState(null);  // null | 'nuevo' | producto
  const [modalMov, setModalMov]     = useState(false);
  const [loading, setLoading]       = useState(true);
  const { toasts, show }            = useToast();

  // ─── Título y subtítulo según rol ─────────────────────────────────────────
  // ADMIN ve "Inventario" completo, OPERARIO ve solo piladora, VENDEDOR solo local
  const titulo   = esOperario ? 'Stock Piladora'
                 : esVendedor ? 'Stock Local'
                 : 'Inventario';

  const subtitulo = esOperario ? 'Productos en planta de producción'
                  : esVendedor ? 'Productos disponibles en el local'
                  : null; // para ADMIN se calcula abajo con la suma total

  async function cargar() {
    try {
      // El backend ya filtra por rol: OPERARIO→piladora, VENDEDOR→local, ADMIN→todos
      const data = await api.get('/stock');
      setProductos(data);
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    return productos
      .filter(p => tab === 'todos' || p.categoria === tab)
      .filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  }, [productos, tab, busqueda]);

  // Solo ADMIN suma ambos stocks; los demás ven solo stockActual
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
      cargar();
    } catch (e) {
      show(e.message, 'error');
    }
  }

  async function handleGuardarMovimiento(datos) {
    try {
      await api.post('/stock/movimiento', datos);
      show('Movimiento registrado', 'success');
      setModalMov(false);
      cargar();
    } catch (e) {
      show(e.message, 'error');
    }
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
        <div className="stock-actions">
          <button className="btn-secondary" onClick={() => setModalMov(true)}>
            ± Movimiento
          </button>
          {/* Solo ADMIN puede crear productos nuevos */}
          {esAdmin && (
            <button className="btn-primary" onClick={() => setModalProd('nuevo')}>
              + Producto
            </button>
          )}
        </div>
      </div>

      {/* Búsqueda */}
      <input
        className="stock-search"
        type="text"
        placeholder="Buscar producto..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
      />

      {/* Tabs */}
      <div className="stock-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-btn${tab === t.key ? ' tab-btn--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
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
                {/* ADMIN ve ambas columnas; OPERARIO/VENDEDOR solo ven stockActual */}
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
                  <td>
                    <span className="punto" style={{ background: colorPunto(p) }} />
                  </td>
                  <td className="nombre">{p.nombre}</td>
                  <td className="cat">{p.categoria}</td>
                  {/* VENDEDOR ve stockLocal en la columna principal */}
                  <td className="num">{esVendedor ? p.stockLocal : p.stockActual}</td>
                  {esAdmin && <td className="num">{p.stockLocal}</td>}
                  <td className="num muted">{p.stockMinimo}</td>
                  <td className="muted">{p.unidad}</td>
                  {esAdmin && (
                    <td>
                      <button className="btn-edit" onClick={() => setModalProd(p)}>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
          font-size: 14px; font-weight: 600; cursor: pointer;
          transition: opacity 0.15s;
        }
        .btn-primary:hover { opacity: 0.85; }

        .btn-secondary {
          background: var(--bg-card); color: var(--text-primary);
          border: 1px solid var(--border); border-radius: 8px; padding: 9px 18px;
          font-size: 14px; font-weight: 600; cursor: pointer;
          transition: background 0.15s;
        }
        .btn-secondary:hover { background: var(--border); }

        .stock-search {
          width: 100%; padding: 10px 14px;
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text-primary); font-size: 14px;
          outline: none;
        }
        .stock-search:focus { border-color: var(--accent-purple); }

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
        .stock-table {
          width: 100%; border-collapse: collapse;
          font-size: 14px;
        }
        .stock-table th {
          padding: 10px 14px; text-align: left;
          font-size: 12px; font-weight: 600; text-transform: uppercase;
          color: var(--text-secondary); background: var(--bg-card);
          border-bottom: 1px solid var(--border);
        }
        .stock-row td { padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .stock-row:last-child td { border-bottom: none; }
        .stock-row:hover td { background: rgba(255,255,255,0.02); }

        .punto {
          display: inline-block; width: 10px; height: 10px;
          border-radius: 50%;
        }
        .nombre { font-weight: 500; color: var(--text-primary); }
        .cat    { color: var(--text-secondary); text-transform: capitalize; }
        .num    { font-weight: 600; text-align: right; }
        .muted  { color: var(--text-secondary); }
        .empty  { text-align: center; padding: 32px; color: var(--text-secondary); }

        .btn-edit {
          background: none; border: 1px solid var(--border);
          color: var(--text-secondary); border-radius: 6px;
          padding: 4px 10px; font-size: 12px; cursor: pointer;
          transition: all 0.15s;
        }
        .btn-edit:hover { color: var(--text-primary); border-color: var(--text-primary); }

        @media (max-width: 600px) {
          .stock-table th:nth-child(3),
          .stock-row td:nth-child(3) { display: none; }
        }
      `}</style>
    </div>
  );
}
