// ─── Modal de Factura ─────────────────────────────────────────────────────────
// Cumple Ley 256 del 26 de noviembre de 2021 (Panamá) y Dto. Ejecutivo 766/2020
// Campos obligatorios: denominación, N° correlativo, RUC+DV emisor,
// fecha de emisión, identificación receptor, descripción bienes/servicios,
// precio unitario, valor total, ITBMS desglosado, condición de pago.
//
// Dos pasos:
//   1. Sin facturaNum → formulario para generar la factura
//   2. Con facturaNum → vista imprimible + panel de envío por email

import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtFecha(iso) {
  const d   = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtMoney(n) {
  return 'B/. ' + Number(n || 0).toFixed(2);
}

const METODO_LABEL = {
  EFECTIVO:      'Efectivo',
  YAPPY:         'Yappy',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE:        'Cheque',
  CREDITO:       'Crédito',
};

export default function ModalFactura({ venta, onClose, onFacturaGenerada }) {
  const { esAdmin } = useAuth();
  // ─ Formulario paso 1 ────────────────────────────────────────────────────────
  const [clienteNombre,    setClienteNombre]    = useState(venta.cliente         || '');
  const [clienteRuc,       setClienteRuc]       = useState(venta.clienteRuc      || '');
  const [clienteDireccion, setClienteDireccion] = useState(venta.clienteDireccion|| '');
  const [aplicaITBMS,      setAplicaITBMS]      = useState(venta.aplicaITBMS     || false);
  const [generando,        setGenerando]        = useState(false);
  const [formError,        setFormError]        = useState('');

  // ─ Datos de la factura generada (paso 2) ────────────────────────────────────
  const [facturaData, setFacturaData] = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // ─ Panel de envío por email ─────────────────────────────────────────────────
  const [emailDestinatario, setEmailDestinatario] = useState('');
  const [enviando,          setEnviando]          = useState(false);
  const [emailMsg,          setEmailMsg]          = useState('');
  const [emailError,        setEmailError]        = useState('');

  // Si la venta ya tiene factura, cargar datos directamente
  useEffect(() => {
    if (venta.facturaNum) cargarFactura();
  }, []);

  async function cargarFactura() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/ventas/${venta.id}/factura`);
      setFacturaData(data);
      // Pre-llenar email del cliente si estuviera guardado
      if (data.empresa?.email_empresa) {
        // Dejamos vacío para que el admin escriba el destino manualmente
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generarFactura() {
    if (!clienteNombre.trim()) {
      setFormError('El nombre del cliente es obligatorio'); return;
    }
    setGenerando(true);
    setFormError('');
    try {
      await api.post(`/ventas/${venta.id}/factura`, {
        clienteNombre:    clienteNombre.trim(),
        clienteRuc:       clienteRuc.trim()       || null,
        clienteDireccion: clienteDireccion.trim() || null,
        aplicaITBMS,
      });
      await cargarFactura();
      onFacturaGenerada?.();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setGenerando(false);
    }
  }

  async function enviarEmail() {
    if (!emailDestinatario.includes('@')) {
      setEmailError('Ingresa un correo electrónico válido'); return;
    }
    setEnviando(true);
    setEmailError('');
    setEmailMsg('');
    try {
      const res = await api.post(`/ventas/${venta.id}/factura/email`, {
        emailDestinatario: emailDestinatario.trim(),
      });
      setEmailMsg(res.mensaje || 'Factura enviada exitosamente');
    } catch (e) {
      setEmailError(e.message || 'Error al enviar el correo');
    } finally {
      setEnviando(false);
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

  if (error) {
    return (
      <div className="fac-overlay" onClick={onClose}>
        <div className="fac-modal" onClick={e => e.stopPropagation()}>
          <p className="fac-msg" style={{ color: '#f87171' }}>{error}</p>
          <div style={{ textAlign: 'right', padding: '0 20px 20px' }}>
            <button className="fac-btn-cancelar" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Si no es ADMIN y la venta no tiene factura, mostrar mensaje ────────────
  if (!facturaData && !esAdmin) {
    return (
      <div className="fac-overlay" onClick={onClose}>
        <div className="fac-modal fac-modal--form" onClick={e => e.stopPropagation()}>
          <div className="fac-header">
            <h3 className="fac-title">Factura — Venta #{String(venta.id).padStart(4,'0')}</h3>
            <button className="fac-close" onClick={onClose}>✕</button>
          </div>
          <p style={{ color:'var(--text-secondary)', fontSize:13, padding:'12px 0' }}>
            Esta venta aún no tiene factura generada. Solo el administrador puede generar nuevas facturas.
          </p>
          <div className="fac-footer">
            <button className="fac-btn-cancelar" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Formulario (paso 1) — solo ADMIN ───────────────────────────────────────
  if (!facturaData) {
    return (
      <div className="fac-overlay" onClick={onClose}>
        <div className="fac-modal fac-modal--form" onClick={e => e.stopPropagation()}>

          <div className="fac-header">
            <h3 className="fac-title">Generar Factura — Venta #{String(venta.id).padStart(4,'0')}</h3>
            <button className="fac-close" onClick={onClose}>✕</button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
            Campos requeridos por la Ley 256 de Panamá (2021).
          </p>

          <div className="fac-form">
            <label className="fac-label">
              Nombre / Razón social del cliente *
              <input
                className="fac-input"
                value={clienteNombre}
                onChange={e => setClienteNombre(e.target.value)}
                placeholder="Nombre completo o razón social"
              />
            </label>
            <label className="fac-label">
              RUC o Cédula del cliente
              <input
                className="fac-input"
                value={clienteRuc}
                onChange={e => setClienteRuc(e.target.value)}
                placeholder="Ej: 8-123-456 o 155663-1-123456"
              />
            </label>
            <label className="fac-label">
              Dirección del cliente
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
              <span>Aplica ITBMS 7% <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>(marcar si el producto grava ITBMS)</span></span>
            </label>

            {formError && <p className="fac-error">{formError}</p>}

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
  const { empresa, baseImponible, itbmsMonto } = facturaData;
  const f = facturaData.venta;

  // RUC completo con DV (ej: 8-123-456-789 DV 01)
  const rucCompleto = empresa.ruc_empresa
    ? empresa.ruc_empresa + (empresa.dv_empresa ? ` DV-${empresa.dv_empresa}` : '')
    : '—';

  // Número correlativo formateado (F-0001)
  const numFactura = `F-${String(f.facturaNum).padStart(4, '0')}`;

  // Condición de pago según la ley
  const condicionPago = f.metodoPago === 'CREDITO' ? 'Crédito' : 'Contado';

  return (
    <div className="fac-overlay" onClick={onClose}>
      <div className="fac-modal fac-modal--view" onClick={e => e.stopPropagation()}>

        {/* ── Barra de acciones (no se imprime) ────────────────────────────── */}
        <div className="fac-actions no-print">
          <button className="fac-btn-imprimir" onClick={() => window.print()}>
            🖨️ Imprimir / PDF
          </button>
          <button className="fac-btn-cancelar" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {/* ── Panel de envío por email (no se imprime) ─────────────────────── */}
        <div className="fac-email-panel no-print">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            ✉️ Enviar por correo
          </span>
          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
            <input
              className="fac-input fac-input--email"
              type="email"
              placeholder="correo@cliente.com"
              value={emailDestinatario}
              onChange={e => setEmailDestinatario(e.target.value)}
            />
            <button
              className="fac-btn-enviar"
              onClick={enviarEmail}
              disabled={enviando || !emailDestinatario.includes('@')}
            >
              {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
          {emailMsg   && <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>{emailMsg}</span>}
          {emailError && <span style={{ fontSize: 12, color: '#f87171' }}>{emailError}</span>}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            ÁREA IMPRIMIBLE — Documento formal Ley 256 Panamá
        ════════════════════════════════════════════════════════════════════════ */}
        <div className="print-area fac-doc">

          {/* ── Encabezado: datos del emisor + número de factura ─────────────── */}
          <div className="fac-enc">
            <div className="fac-enc-left">
              <div className="fac-emp-nombre">{empresa.nombre_empresa || 'Empresa'}</div>
              <div className="fac-emp-dato">RUC: {rucCompleto}</div>
              {empresa.direccion_empresa && <div className="fac-emp-dato">{empresa.direccion_empresa}</div>}
              {empresa.telefono_empresa  && <div className="fac-emp-dato">Tel: {empresa.telefono_empresa}</div>}
              {empresa.email_empresa     && <div className="fac-emp-dato">{empresa.email_empresa}</div>}
            </div>
            <div className="fac-enc-right">
              <div className="fac-num-label">FACTURA</div>
              <div className="fac-num-valor">{numFactura}</div>
              <div className="fac-enc-dato"><b>Fecha:</b> {fmtFecha(f.createdAt)}</div>
              <div className="fac-enc-dato"><b>Vendedor:</b> {f.usuario?.nombre || '—'}</div>
              <div className="fac-enc-dato"><b>Condición:</b> {condicionPago}</div>
              <div className="fac-enc-dato"><b>Método:</b> {METODO_LABEL[f.metodoPago] || f.metodoPago}</div>
            </div>
          </div>

          <div className="fac-div" />

          {/* ── Datos del receptor (cliente) ─────────────────────────────────── */}
          <div className="fac-cliente-box">
            <div className="fac-cliente-titulo">FACTURADO A</div>
            <div className="fac-cliente-nombre">{f.cliente || 'Consumidor Final'}</div>
            {f.clienteRuc       && <div className="fac-cliente-dato">RUC / Cédula: {f.clienteRuc}</div>}
            {f.clienteDireccion && <div className="fac-cliente-dato">Dirección: {f.clienteDireccion}</div>}
          </div>

          <div className="fac-div" />

          {/* ── Tabla de bienes/servicios ─────────────────────────────────────── */}
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
                  <td>{d.producto?.nombre}</td>
                  <td className="fac-td-num">{d.producto?.unidad || '—'}</td>
                  <td className="fac-td-num">{d.cantidad}</td>
                  <td className="fac-td-num">{fmtMoney(d.precioUnit)}</td>
                  <td className="fac-td-num">{fmtMoney(d.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="fac-div" />

          {/* ── Totales con ITBMS desglosado ─────────────────────────────────── */}
          <div className="fac-totales">
            {f.aplicaITBMS ? (
              <>
                <div className="fac-total-fila">
                  <span>Base imponible</span>
                  <span>{fmtMoney(baseImponible)}</span>
                </div>
                <div className="fac-total-fila">
                  <span>ITBMS ({empresa.itbms_porcentaje || 7}%)</span>
                  <span>{fmtMoney(itbmsMonto)}</span>
                </div>
              </>
            ) : (
              <div className="fac-total-fila">
                <span>Subtotal (exento ITBMS)</span>
                <span>{fmtMoney(f.total)}</span>
              </div>
            )}
            <div className="fac-total-fila fac-total-final">
              <span>TOTAL EN BALBOAS</span>
              <span>{fmtMoney(f.total)}</span>
            </div>
          </div>

          {/* ── Nota ─────────────────────────────────────────────────────────── */}
          {f.nota && (
            <p style={{ fontSize: 11, color: '#666', marginTop: 10, fontStyle: 'italic' }}>
              Nota: {f.nota}
            </p>
          )}

          {/* ── Pie legal (Ley 256 de Panamá) ────────────────────────────────── */}
          <div className="fac-pie">
            <div>Documento emitido al amparo de la Ley 256 del 26 de noviembre de 2021.</div>
            <div>Válido como comprobante fiscal. Conserve para sus registros.</div>
          </div>

        </div>
        {/* fin print-area */}

      </div>

      <style>{`
        /* ─── Overlay y contenedores ─── */
        .fac-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.65);
          display: flex; align-items: flex-start; justify-content: center;
          z-index: 1000; padding: 16px; overflow-y: auto;
        }
        .fac-modal {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; padding: 20px;
          display: flex; flex-direction: column; gap: 14px;
          width: 100%; margin-top: 12px;
        }
        .fac-modal--form { max-width: 480px; }
        .fac-modal--view { max-width: 780px; }
        .fac-msg { color: var(--text-secondary); text-align: center; padding: 24px; }

        /* ─── Encabezado del formulario ─── */
        .fac-header { display: flex; justify-content: space-between; align-items: center; }
        .fac-title  { font-size: 16px; font-weight: 700; }
        .fac-close  { background: none; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer; padding: 4px 8px; }

        /* ─── Formulario ─── */
        .fac-form  { display: flex; flex-direction: column; gap: 14px; }
        .fac-label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-secondary); }
        .fac-label--row { flex-direction: row; align-items: center; gap: 10px; font-size: 13px; color: var(--text-primary); }
        .fac-input {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .fac-input:focus { border-color: var(--accent-purple); }
        .fac-input--email { flex: 1; }
        .fac-checkbox { width: 16px; height: 16px; accent-color: var(--accent-purple); cursor: pointer; flex-shrink: 0; }
        .fac-error { font-size: 13px; color: #f87171; }
        .fac-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }

        /* ─── Panel de email ─── */
        .fac-email-panel {
          display: flex; align-items: center; gap: 10px;
          flex-wrap: wrap;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 10px; padding: 12px 16px;
        }

        /* ─── Botones ─── */
        .fac-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .fac-btn-imprimir {
          background: var(--accent-purple); color: #fff; border: none;
          border-radius: 8px; padding: 8px 18px; font-size: 14px;
          font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .fac-btn-imprimir:hover { opacity: 0.85; }
        .fac-btn-generar {
          background: var(--accent-purple); color: #fff; border: none;
          border-radius: 8px; padding: 9px 22px; font-size: 14px;
          font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .fac-btn-generar:hover:not(:disabled) { opacity: 0.85; }
        .fac-btn-generar:disabled { opacity: 0.4; cursor: not-allowed; }
        .fac-btn-enviar {
          background: var(--accent-green, #4ade80); color: #111; border: none;
          border-radius: 8px; padding: 8px 18px; font-size: 13px;
          font-weight: 600; cursor: pointer; white-space: nowrap;
          transition: opacity 0.15s;
        }
        .fac-btn-enviar:hover:not(:disabled) { opacity: 0.85; }
        .fac-btn-enviar:disabled { opacity: 0.4; cursor: not-allowed; }
        .fac-btn-cancelar {
          background: none; border: 1px solid var(--border);
          color: var(--text-secondary); border-radius: 8px;
          padding: 8px 14px; font-size: 14px; cursor: pointer;
        }
        .fac-btn-cancelar:hover { color: var(--text-primary); }

        /* ─── Documento factura (área blanca imprimible) ─── */
        .fac-doc {
          background: #fff; color: #111;
          padding: 32px 36px; border-radius: 6px;
          font-size: 13px; line-height: 1.5;
          font-family: 'Segoe UI', Arial, sans-serif;
        }

        /* Encabezado emisor / número */
        .fac-enc { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 16px; }
        .fac-enc-left  { flex: 1; }
        .fac-enc-right { text-align: right; flex-shrink: 0; }
        .fac-emp-nombre { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .fac-emp-dato   { font-size: 12px; color: #444; line-height: 1.6; }
        .fac-num-label  { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #777; }
        .fac-num-valor  { font-size: 26px; font-weight: 800; letter-spacing: 2px; margin: 2px 0 6px; }
        .fac-enc-dato   { font-size: 12px; color: #444; line-height: 1.7; }

        .fac-div { border-top: 1px solid #ddd; margin: 14px 0; }

        /* Receptor */
        .fac-cliente-box    { margin: 8px 0; }
        .fac-cliente-titulo { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 5px; }
        .fac-cliente-nombre { font-size: 15px; font-weight: 700; }
        .fac-cliente-dato   { font-size: 12px; color: #444; }

        /* Tabla */
        .fac-tabla { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .fac-tabla th {
          padding: 7px 10px; text-align: left;
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
          background: #f0f0f0; border-bottom: 2px solid #ccc;
          color: #333;
        }
        .fac-th-num, .fac-td-num { text-align: right !important; }
        .fac-tr td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
        .fac-tr:last-child td { border-bottom: none; }

        /* Totales */
        .fac-totales { display: flex; flex-direction: column; gap: 5px; align-items: flex-end; margin-top: 14px; }
        .fac-total-fila { display: flex; gap: 60px; justify-content: flex-end; font-size: 13px; }
        .fac-total-fila span:first-child { color: #555; min-width: 160px; text-align: right; }
        .fac-total-final {
          font-size: 17px; font-weight: 800;
          padding-top: 8px; border-top: 2px solid #111; margin-top: 6px;
          color: #111;
        }

        /* Pie legal */
        .fac-pie {
          text-align: center; font-size: 10px; color: #999;
          margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee;
          line-height: 1.6;
        }

        /* ─── Estilos de impresión ─── */
        @media print {
          body > *:not(.fac-overlay) { display: none !important; }
          .fac-overlay { position: static; background: none !important; padding: 0; }
          .fac-modal   { box-shadow: none; border: none; padding: 0; overflow: visible; }
          .no-print    { display: none !important; }
          .fac-doc     { border-radius: 0; padding: 12px; }
        }
      `}</style>
    </div>
  );
}
