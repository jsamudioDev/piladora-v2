import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatMoney } from '../../utils/format';

// Formatea fecha ISO a dd/mm/yyyy
function fmtFecha(iso) {
  const d   = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Número de factura formateado (ej: F-0001)
function fmtFactura(n) {
  return `F-${String(n).padStart(4, '0')}`;
}

/**
 * ModalFactura — dos estados:
 * 1. Si la venta NO tiene facturaNum → muestra formulario para generar factura
 * 2. Si la venta YA tiene facturaNum → muestra la factura imprimible
 */
export default function ModalFactura({ venta, onClose, onFacturaGenerada }) {
  // Estado del formulario (paso 1)
  const [clienteNombre,   setClienteNombre]   = useState(venta.cliente || '');
  const [clienteRuc,      setClienteRuc]      = useState(venta.clienteRuc || '');
  const [clienteDireccion,setClienteDireccion]= useState(venta.clienteDireccion || '');
  const [aplicaITBMS,     setAplicaITBMS]     = useState(venta.aplicaITBMS || false);
  const [generando, setGenerando] = useState(false);

  // Datos de la factura generada (paso 2)
  const [facturaData, setFacturaData] = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // Si la venta ya tiene factura, cargamos los datos de inmediato
  useEffect(() => {
    if (venta.facturaNum) {
      cargarFactura();
    }
  }, []);

  async function cargarFactura() {
    setLoading(true);
    try {
      const data = await api.get(`/ventas/${venta.id}/factura`);
      setFacturaData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generarFactura() {
    if (!clienteNombre.trim()) {
      setError('El nombre del cliente es requerido'); return;
    }
    setGenerando(true);
    setError('');
    try {
      await api.post(`/ventas/${venta.id}/factura`, {
        clienteNombre:    clienteNombre.trim(),
        clienteRuc:       clienteRuc.trim()       || null,
        clienteDireccion: clienteDireccion.trim() || null,
        aplicaITBMS,
      });
      // Cargar los datos completos de la factura recién generada
      await cargarFactura();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerando(false);
    }
  }

  // ─── Vista de carga ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fac-overlay" onClick={onClose}>
        <div className="fac-modal" onClick={e => e.stopPropagation()}>
          <p className="fac-msg">Cargando factura...</p>
        </div>
      </div>
    );
  }

  // ─── Formulario (paso 1: sin facturaNum) ────────────────────────────────────
  if (!facturaData) {
    return (
      <div className="fac-overlay" onClick={onClose}>
        <div className="fac-modal fac-modal--form" onClick={e => e.stopPropagation()}>
          <div className="fac-header">
            <h3 className="fac-title">Generar Factura — Venta #{venta.id}</h3>
            <button className="fac-close" onClick={onClose}>✕</button>
          </div>

          <div className="fac-form">
            <label className="fac-label">
              Nombre del cliente *
              <input
                className="fac-input"
                value={clienteNombre}
                onChange={e => setClienteNombre(e.target.value)}
                placeholder="Nombre completo"
              />
            </label>
            <label className="fac-label">
              RUC / Cédula (opcional)
              <input
                className="fac-input"
                value={clienteRuc}
                onChange={e => setClienteRuc(e.target.value)}
                placeholder="8-123-456 o 8-123-456-0"
              />
            </label>
            <label className="fac-label">
              Dirección (opcional)
              <input
                className="fac-input"
                value={clienteDireccion}
                onChange={e => setClienteDireccion(e.target.value)}
                placeholder="Ciudad, provincia"
              />
            </label>

            <label className="fac-label fac-label--row">
              <input
                type="checkbox"
                checked={aplicaITBMS}
                onChange={e => setAplicaITBMS(e.target.checked)}
                className="fac-checkbox"
              />
              Aplica ITBMS (7%)
            </label>

            {error && <p className="fac-error">{error}</p>}

            <div className="fac-footer">
              <button className="fac-btn-cancelar" onClick={onClose}>Cancelar</button>
              <button
                className="fac-btn-generar"
                onClick={generarFactura}
                disabled={generando || !clienteNombre.trim()}
              >
                {generando ? 'Generando...' : 'Generar Factura'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Vista de factura generada (paso 2) ─────────────────────────────────────
  const { empresa, subtotal, itbmsMonto, totalConITBMS } = facturaData;
  const f = facturaData.venta;

  return (
    <div className="fac-overlay" onClick={onClose}>
      <div className="fac-modal fac-modal--view" onClick={e => e.stopPropagation()}>

        {/* Botones de acción — ocultos al imprimir */}
        <div className="fac-actions no-print">
          <button className="fac-btn-imprimir" onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </button>
          <button
            className="fac-btn-cancelar"
            onClick={() => { onFacturaGenerada?.(); onClose(); }}
          >
            Cerrar
          </button>
        </div>

        {/* ─── Área imprimible — factura formal ─────────────────────────────── */}
        <div className="print-area fac-doc">

          {/* Encabezado de la empresa */}
          <div className="fac-enc">
            <div className="fac-enc-left">
              <div className="fac-emp-nombre">{empresa.nombre_empresa || 'Empresa'}</div>
              <div className="fac-emp-dato">RUC: {empresa.ruc_empresa || '—'}</div>
              <div className="fac-emp-dato">{empresa.direccion_empresa}</div>
              <div className="fac-emp-dato">Tel: {empresa.telefono_empresa}</div>
            </div>
            <div className="fac-enc-right">
              <div className="fac-num-label">FACTURA</div>
              <div className="fac-num-valor">{fmtFactura(f.facturaNum)}</div>
              <div className="fac-enc-dato"><span>Fecha:</span> {fmtFecha(f.createdAt)}</div>
              <div className="fac-enc-dato"><span>Vendedor:</span> {f.usuario?.nombre || '—'}</div>
              <div className="fac-enc-dato"><span>Pago:</span> {f.metodoPago}</div>
            </div>
          </div>

          <div className="fac-div" />

          {/* Datos del cliente */}
          <div className="fac-cliente-box">
            <div className="fac-cliente-titulo">FACTURADO A</div>
            <div className="fac-cliente-dato fac-cliente-nombre">{f.cliente || '—'}</div>
            {f.clienteRuc       && <div className="fac-cliente-dato">RUC / Cédula: {f.clienteRuc}</div>}
            {f.clienteDireccion && <div className="fac-cliente-dato">Dirección: {f.clienteDireccion}</div>}
          </div>

          <div className="fac-div" />

          {/* Tabla de productos */}
          <table className="fac-tabla">
            <thead>
              <tr>
                <th className="fac-th-desc">Descripción</th>
                <th className="fac-th-num">Unidad</th>
                <th className="fac-th-num">Cantidad</th>
                <th className="fac-th-num">Precio Unit.</th>
                <th className="fac-th-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {f.detalles.map(d => (
                <tr key={d.id} className="fac-tr">
                  <td>{d.producto.nombre}</td>
                  <td className="fac-td-num">{d.producto.unidad}</td>
                  <td className="fac-td-num">{d.cantidad}</td>
                  <td className="fac-td-num">{formatMoney(d.precioUnit)}</td>
                  <td className="fac-td-num">{formatMoney(d.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="fac-div" />

          {/* Totales */}
          <div className="fac-totales">
            <div className="fac-total-fila">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {itbmsMonto > 0 && (
              <div className="fac-total-fila">
                <span>ITBMS (7%)</span>
                <span>{formatMoney(itbmsMonto)}</span>
              </div>
            )}
            <div className="fac-total-fila fac-total-fila--grande">
              <span>TOTAL A PAGAR</span>
              <span>{formatMoney(totalConITBMS)}</span>
            </div>
          </div>

          {/* Pie */}
          <div className="fac-pie">
            Esta factura es válida como comprobante de pago.
          </div>

        </div>
        {/* fin print-area */}

      </div>

      <style>{`
        /* ─── Overlay y contenedores ─── */
        .fac-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.65);
          display: flex; align-items: flex-start; justify-content: center;
          z-index: 1000; padding: 20px; overflow-y: auto;
        }
        .fac-modal {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; padding: 20px;
          display: flex; flex-direction: column; gap: 16px;
          width: 100%;
        }
        .fac-modal--form { max-width: 480px; margin-top: 40px; }
        .fac-modal--view { max-width: 760px; margin-top: 20px; }

        .fac-msg { color: var(--text-secondary); text-align: center; padding: 24px; }

        /* ─── Formulario ─── */
        .fac-header { display: flex; justify-content: space-between; align-items: center; }
        .fac-title  { font-size: 16px; font-weight: 700; }
        .fac-close  { background: none; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer; padding: 4px 8px; }

        .fac-form   { display: flex; flex-direction: column; gap: 14px; }
        .fac-label  { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-secondary); }
        .fac-label--row { flex-direction: row; align-items: center; gap: 10px; }
        .fac-input {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .fac-input:focus { border-color: var(--accent-purple); }
        .fac-checkbox { width: 16px; height: 16px; accent-color: var(--accent-purple); cursor: pointer; }
        .fac-error  { font-size: 13px; color: var(--accent-red); }

        .fac-footer { display: flex; gap: 8px; justify-content: flex-end; }

        /* ─── Botones ─── */
        .fac-btn-generar {
          background: var(--accent-purple); color: #fff; border: none;
          border-radius: 8px; padding: 9px 20px; font-size: 14px;
          font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .fac-btn-generar:hover:not(:disabled) { opacity: 0.85; }
        .fac-btn-generar:disabled { opacity: 0.4; cursor: not-allowed; }
        .fac-btn-imprimir {
          background: var(--accent-purple); color: #fff; border: none;
          border-radius: 8px; padding: 8px 18px; font-size: 14px;
          font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .fac-btn-imprimir:hover { opacity: 0.85; }
        .fac-btn-cancelar {
          background: none; border: 1px solid var(--border);
          color: var(--text-secondary); border-radius: 8px;
          padding: 8px 14px; font-size: 14px; cursor: pointer;
        }

        .fac-actions { display: flex; gap: 10px; justify-content: flex-end; }

        /* ─── Documento factura ─── */
        .fac-doc {
          background: #fff; color: #111;
          padding: 32px 36px; border-radius: 6px;
          font-size: 13px; line-height: 1.5;
        }
        .fac-enc { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 20px; }
        .fac-enc-left  { flex: 1; }
        .fac-enc-right { text-align: right; flex-shrink: 0; }
        .fac-emp-nombre { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
        .fac-emp-dato   { font-size: 12px; color: #444; }
        .fac-num-label  { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
        .fac-num-valor  { font-size: 24px; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; }
        .fac-enc-dato   { font-size: 12px; color: #444; }
        .fac-enc-dato span { font-weight: 600; }

        .fac-div { border-top: 1px solid #ddd; margin: 16px 0; }

        .fac-cliente-box    { }
        .fac-cliente-titulo { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
        .fac-cliente-nombre { font-size: 15px; font-weight: 600; }
        .fac-cliente-dato   { font-size: 12px; color: #444; }

        /* Tabla de productos */
        .fac-tabla { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .fac-tabla th {
          padding: 8px 10px; text-align: left;
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
          background: #f5f5f5; border-bottom: 2px solid #ddd;
        }
        .fac-th-num, .fac-td-num { text-align: right; }
        .fac-tr td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; }

        /* Totales */
        .fac-totales { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; margin-top: 12px; }
        .fac-total-fila { display: flex; gap: 60px; justify-content: flex-end; font-size: 13px; }
        .fac-total-fila span:first-child { color: #555; }
        .fac-total-fila--grande {
          font-size: 18px; font-weight: 700;
          padding-top: 8px; border-top: 2px solid #111; margin-top: 4px;
        }

        /* Pie */
        .fac-pie { text-align: center; font-size: 11px; color: #888; margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; }
      `}</style>
    </div>
  );
}
