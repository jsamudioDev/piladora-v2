import { useState, useEffect } from 'react';
import api from '../../utils/api';

// Formatea una fecha ISO a dd/mm/yyyy hh:mm
function fmtFecha(iso) {
  const d   = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtMoney(n) {
  return '$' + Number(n || 0).toFixed(2);
}

// Centra un string dentro de un ancho fijo (solo para texto preformateado)
function centrar(str, ancho = 36) {
  const pad = Math.max(0, Math.floor((ancho - str.length) / 2));
  return ' '.repeat(pad) + str;
}

/**
 * ModalTicket — se muestra al completar una venta o al pulsar "Ticket" en historial.
 * Carga los datos del ticket desde GET /api/ventas/:id/ticket
 * y renderiza una vista previa de recibo térmico.
 */
export default function ModalTicket({ ventaId, onClose }) {
  const [datos,   setDatos]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get(`/ventas/${ventaId}/ticket`)
      .then(d  => setDatos(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ventaId]);

  if (loading) {
    return (
      <div className="tk-overlay" onClick={onClose}>
        <div className="tk-modal" onClick={e => e.stopPropagation()}>
          <p className="tk-loading">Cargando ticket...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tk-overlay" onClick={onClose}>
        <div className="tk-modal" onClick={e => e.stopPropagation()}>
          <p className="tk-error">{error}</p>
          <button className="tk-btn-cerrar" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    );
  }

  const { venta, empresa } = datos;
  const numTicket = String(venta.id).padStart(4, '0');

  return (
    <div className="tk-overlay" onClick={onClose}>
      <div className="tk-modal" onClick={e => e.stopPropagation()}>

        {/* Botones de acción (ocultos al imprimir) */}
        <div className="tk-actions no-print">
          <button className="tk-btn-imprimir" onClick={() => window.print()}>
            Imprimir
          </button>
          <button className="tk-btn-cerrar" onClick={onClose}>Cerrar</button>
        </div>

        {/* ─── Área imprimible — recibo térmico ─────────────────────────────── */}
        <div className="print-area tk-recibo">

          {/* Encabezado empresa */}
          <div className="tk-empresa">
            <div className="tk-empresa-nombre">{empresa.nombre_empresa || 'Piladora'}</div>
            {empresa.ruc_empresa    && <div>RUC: {empresa.ruc_empresa}</div>}
            {empresa.direccion_empresa && <div>{empresa.direccion_empresa}</div>}
            {empresa.telefono_empresa  && <div>Tel: {empresa.telefono_empresa}</div>}
          </div>

          <div className="tk-sep">{'─'.repeat(32)}</div>

          {/* Datos de la venta */}
          <div className="tk-titulo">TICKET DE VENTA</div>
          <div className="tk-linea"><span>Ticket #</span><span>{numTicket}</span></div>
          <div className="tk-linea"><span>Fecha</span><span>{fmtFecha(venta.createdAt)}</span></div>
          {venta.usuario?.nombre && (
            <div className="tk-linea"><span>Vendedor</span><span>{venta.usuario.nombre}</span></div>
          )}
          <div className="tk-linea"><span>Pago</span><span>{venta.metodoPago}</span></div>
          {venta.cliente && (
            <div className="tk-linea"><span>Cliente</span><span>{venta.cliente}</span></div>
          )}
          <div className="tk-linea"><span>Ubicación</span><span>{venta.ubicacion}</span></div>

          <div className="tk-sep">{'─'.repeat(32)}</div>

          {/* Productos */}
          <div className="tk-col-header">
            <span className="tk-col-prod">Producto</span>
            <span className="tk-col-cant">Cant</span>
            <span className="tk-col-pu">P.U.</span>
            <span className="tk-col-sub">Sub</span>
          </div>
          <div className="tk-sep tk-sep--thin">{'·'.repeat(32)}</div>

          {venta.detalles.map(d => (
            <div key={d.id} className="tk-item">
              <div className="tk-item-nombre">{d.producto.nombre}</div>
              <div className="tk-item-row">
                <span className="tk-col-cant">{d.cantidad}</span>
                <span className="tk-col-pu">{fmtMoney(d.precioUnit)}</span>
                <span className="tk-col-sub">{fmtMoney(d.subtotal)}</span>
              </div>
            </div>
          ))}

          <div className="tk-sep">{'─'.repeat(32)}</div>

          {/* Total */}
          <div className="tk-total-row">
            <span>TOTAL</span>
            <span className="tk-total-monto">{fmtMoney(venta.total)}</span>
          </div>

          <div className="tk-sep">{'─'.repeat(32)}</div>

          {/* Pie */}
          {venta.nota && <div className="tk-nota">Nota: {venta.nota}</div>}
          <div className="tk-gracias">¡Gracias por su compra!</div>

        </div>
        {/* fin print-area */}

      </div>

      <style>{`
        /* ─── Overlay y contenedor ─── */
        .tk-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.65);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px;
        }
        .tk-modal {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; padding: 20px;
          display: flex; flex-direction: column; gap: 16px;
          max-height: 90vh; overflow-y: auto;
        }
        .tk-loading, .tk-error {
          color: var(--text-secondary); font-size: 14px;
          text-align: center; padding: 24px;
        }

        /* ─── Botones de acción ─── */
        .tk-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .tk-btn-imprimir {
          background: var(--accent-purple); color: #fff; border: none;
          border-radius: 8px; padding: 8px 18px; font-size: 14px;
          font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .tk-btn-imprimir:hover { opacity: 0.85; }
        .tk-btn-cerrar {
          background: none; border: 1px solid var(--border);
          color: var(--text-secondary); border-radius: 8px;
          padding: 8px 14px; font-size: 14px; cursor: pointer;
        }
        .tk-btn-cerrar:hover { border-color: var(--text-secondary); }

        /* ─── Recibo térmico ─── */
        .tk-recibo {
          font-family: var(--mono); font-size: 12px; line-height: 1.5;
          color: #111; background: #fff;
          width: 300px; padding: 16px 14px;
          border-radius: 6px;
        }
        .tk-empresa { text-align: center; margin-bottom: 6px; }
        .tk-empresa-nombre { font-size: 14px; font-weight: 700; text-transform: uppercase; }
        .tk-sep { color: #555; text-align: center; margin: 4px 0; }
        .tk-sep--thin { color: #aaa; }
        .tk-titulo { text-align: center; font-weight: 700; font-size: 13px; margin: 4px 0; }
        .tk-linea {
          display: flex; justify-content: space-between;
          gap: 6px; font-size: 11px;
        }
        .tk-col-header {
          display: grid; grid-template-columns: 1fr 36px 52px 52px;
          font-weight: 700; font-size: 10px; margin: 4px 0;
          text-transform: uppercase;
        }
        .tk-col-cant, .tk-col-pu, .tk-col-sub { text-align: right; }
        .tk-item { margin-bottom: 4px; }
        .tk-item-nombre { font-size: 11px; font-weight: 600; }
        .tk-item-row {
          display: grid; grid-template-columns: 1fr 36px 52px 52px;
          font-size: 11px;
        }
        .tk-total-row {
          display: flex; justify-content: space-between; align-items: baseline;
          font-weight: 700; font-size: 15px; margin: 4px 0;
        }
        .tk-total-monto { font-size: 18px; }
        .tk-nota  { font-size: 11px; color: #555; margin-top: 4px; }
        .tk-gracias { text-align: center; font-weight: 700; margin-top: 8px; font-size: 12px; }
      `}</style>
    </div>
  );
}
