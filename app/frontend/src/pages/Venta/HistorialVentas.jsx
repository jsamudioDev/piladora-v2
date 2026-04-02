import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatMoney } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';

export default function HistorialVentas({ onAnulada, onDevolver, reloadKey }) {
  const { esAdmin }              = useAuth();
  const [ventas, setVentas]      = useState([]);
  const [loading, setLoading]    = useState(true);
  const [expanded, setExpanded]  = useState(null);
  const [anulando, setAnulando]  = useState(null);

  async function cargar() {
    setLoading(true);
    try {
      const data = await api.get('/ventas/hoy');
      setVentas(data);
    } finally {
      setLoading(false);
    }
  }

  // Se recarga cuando el padre incrementa reloadKey (p.ej. tras una devolución exitosa)
  useEffect(() => { cargar(); }, [reloadKey]);

  async function anular(id) {
    if (!window.confirm('¿Anular esta venta? Se restaurará el stock.')) return;
    setAnulando(id);
    try {
      await api.delete(`/ventas/${id}`);
      onAnulada?.('Venta anulada y stock restaurado');
      cargar();
    } catch (e) {
      onAnulada?.(e.message, 'error');
    } finally {
      setAnulando(null);
    }
  }

  const totalDia = ventas.reduce((s, v) => s + v.total, 0);

  if (loading) return <p className="hist-loading">Cargando...</p>;

  return (
    <div className="hist-wrap">
      <div className="hist-header">
        <span className="hist-count">{ventas.length} ventas hoy</span>
        <span className="hist-total">Total: <strong>{formatMoney(totalDia)}</strong></span>
      </div>

      {ventas.length === 0 && (
        <p className="hist-empty">Sin ventas registradas hoy.</p>
      )}

      <ul className="hist-list">
        {ventas.map(v => (
          <li key={v.id} className="hist-item">
            <div className="hist-row" onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
              <div className="hist-info">
                <span className="hist-id">#{v.id}</span>
                {v.cliente && <span className="hist-cliente">{v.cliente}</span>}
                <span className={`badge-metodo badge-${v.metodoPago.toLowerCase()}`}>{v.metodoPago}</span>
                <span className="hist-ubi">{v.ubicacion}</span>
              </div>
              <div className="hist-right">
                <span className="hist-monto">{formatMoney(v.total)}</span>
                <span className="hist-hora">
                  {new Date(v.createdAt).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="expand-icon">{expanded === v.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {expanded === v.id && (
              <div className="hist-detalle">
                <table className="det-table">
                  <thead>
                    <tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {v.detalles.map(d => (
                      <tr key={d.id}>
                        <td>{d.producto.nombre}</td>
                        <td className="num">{d.cantidad} {d.producto.unidad}</td>
                        <td className="num">{formatMoney(d.precioUnit)}</td>
                        <td className="num">{formatMoney(d.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {v.nota && <p className="det-nota">Nota: {v.nota}</p>}

                {/* Acciones: Devolver (solo ADMIN) y Anular */}
                <div className="det-acciones">
                  {esAdmin && (
                    <button
                      className="btn-devolver"
                      onClick={() => onDevolver?.(v)}
                    >
                      ↩ Devolver
                    </button>
                  )}
                  <button
                    className="btn-anular"
                    onClick={() => anular(v.id)}
                    disabled={anulando === v.id}
                  >
                    {anulando === v.id ? 'Anulando...' : 'Anular venta'}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <style>{`
        .hist-loading, .hist-empty { color: var(--text-secondary); text-align: center; padding: 24px; font-size: 14px; }
        .hist-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 14px; color: var(--text-secondary); }
        .hist-total strong { color: var(--accent-green); }
        .hist-count { font-size: 13px; }

        .hist-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .hist-item { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }

        .hist-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; cursor: pointer; gap: 10px; }
        .hist-row:hover { background: rgba(255,255,255,0.02); }

        .hist-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .hist-id { font-weight: 700; font-size: 13px; color: var(--text-secondary); }
        .hist-cliente { font-size: 13px; color: var(--text-primary); }
        .hist-ubi { font-size: 11px; color: var(--text-secondary); background: var(--bg-base); padding: 2px 7px; border-radius: 10px; }

        .badge-metodo { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
        .badge-efectivo { background: rgba(74,222,128,0.15); color: var(--accent-green); }
        .badge-yappy    { background: rgba(96,165,250,0.15); color: var(--accent-blue); }
        .badge-fiado    { background: rgba(248,113,113,0.15); color: var(--accent-red); }
        .badge-credito  { background: rgba(251,191,36,0.15);  color: #fbbf24; }

        .hist-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .hist-monto { font-weight: 700; color: var(--accent-green); }
        .hist-hora  { font-size: 12px; color: var(--text-secondary); }
        .expand-icon { font-size: 10px; color: var(--text-secondary); }

        .hist-detalle { padding: 0 14px 14px; border-top: 1px solid var(--border); }
        .det-table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 10px 0 8px; }
        .det-table th { text-align: left; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; padding: 4px 0; }
        .det-table td { padding: 6px 0; border-bottom: 1px solid var(--border); }
        .det-table tr:last-child td { border-bottom: none; }
        .num { text-align: right; }
        .det-nota { font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; }

        .det-acciones { display: flex; gap: 8px; flex-wrap: wrap; }

        .btn-devolver {
          background: rgba(96,165,250,0.1); color: var(--accent-blue);
          border: 1px solid var(--accent-blue); border-radius: 7px;
          padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background 0.15s;
        }
        .btn-devolver:hover { background: rgba(96,165,250,0.2); }

        .btn-anular {
          background: rgba(248,113,113,0.1); color: var(--accent-red);
          border: 1px solid var(--accent-red); border-radius: 7px;
          padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background 0.15s;
        }
        .btn-anular:hover { background: rgba(248,113,113,0.2); }
        .btn-anular:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
