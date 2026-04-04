// ─── Modal Ticket de Venta ─────────────────────────────────────────────────────
// Muestra recibo térmico con opción de imprimir.
// NUEVO: ADMIN puede editar datos del ticket (cliente, nota) y de la empresa.

import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

function fmtFecha(iso) {
  const d = new Date(iso);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtMoney(n) { return '$' + Number(n || 0).toFixed(2); }

export default function ModalTicket({ ventaId, onClose }) {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'ADMIN';

  const [datos,    setDatos]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const [editandoTicket,   setEditandoTicket]   = useState(false);
  const [eCliente,         setECliente]         = useState('');
  const [eNota,            setENota]            = useState('');
  const [guardandoTicket,  setGuardandoTicket]  = useState(false);

  const [editandoEmpresa,  setEditandoEmpresa]  = useState(false);
  const [eEmpresa,         setEEmpresa]         = useState({});
  const [guardandoEmpresa, setGuardandoEmpresa] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const d = await api.get(`/ventas/${ventaId}/ticket`);
      setDatos(d);
      setECliente(d.venta.cliente || '');
      setENota(d.venta.nota || '');
      setEEmpresa({ ...d.empresa });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, [ventaId]);

  async function guardarTicket() {
    setGuardandoTicket(true);
    try {
      await api.put(`/ventas/${ventaId}/editar`, { cliente: eCliente || null, nota: eNota || null });
      await cargar();
      setEditandoTicket(false);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setGuardandoTicket(false);
    }
  }

  async function guardarEmpresa() {
    setGuardandoEmpresa(true);
    try {
      const claves = ['nombre_empresa', 'ruc_empresa', 'dv_empresa', 'direccion_empresa', 'telefono_empresa', 'email_empresa'];
      for (const clave of claves) {
        await api.put(`/config/parametros/${clave}`, { valor: eEmpresa[clave] || '' });
      }
      await cargar();
      setEditandoEmpresa(false);
    } catch (e) {
      alert('Error al guardar: ' + e.message);
    } finally {
      setGuardandoEmpresa(false);
    }
  }

  if (loading) return (
    <div className="tk-overlay" onClick={onClose}>
      <div className="tk-modal" onClick={e=>e.stopPropagation()}>
        <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:24 }}>Cargando...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="tk-overlay" onClick={onClose}>
      <div className="tk-modal" onClick={e=>e.stopPropagation()}>
        <p style={{ color:'#f87171', padding:20 }}>{error}</p>
        <button style={{ margin:'0 20px 20px' }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );

  const { venta, empresa } = datos;
  const numTicket    = String(venta.id).padStart(4, '0');
  const rucCompleto  = [empresa.ruc_empresa, empresa.dv_empresa].filter(Boolean).join('-');
  const itbmsPct     = parseFloat(empresa.itbms_porcentaje || '7') / 100;
  const baseImponible = venta.aplicaITBMS ? venta.total / (1 + itbmsPct) : venta.total;
  const itbmsMonto    = venta.aplicaITBMS ? venta.total - baseImponible : 0;

  const METODO_LABEL = {
    EFECTIVO:'Efectivo', YAPPY:'Yappy', TRANSFERENCIA:'Transferencia',
    CHEQUE:'Cheque', CREDITO:'Crédito',
  };

  return (
    <div className="tk-overlay" onClick={onClose}>
      <div className="tk-modal" onClick={e=>e.stopPropagation()}>

        {/* Barra de acciones */}
        <div className="tk-topbar">
          <span style={{ fontWeight:600, fontSize:15 }}>Ticket #{numTicket}</span>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {esAdmin && (
              <>
                <button className="tk-btn-edit" onClick={()=>{ setEditandoTicket(v=>!v); setEditandoEmpresa(false); }}>
                  ✏️ Ticket
                </button>
                <button className="tk-btn-edit" onClick={()=>{ setEditandoEmpresa(v=>!v); setEditandoTicket(false); }}>
                  🏢 Empresa
                </button>
              </>
            )}
            <button className="tk-btn-print" onClick={()=>window.print()}>🖨️ Imprimir</button>
            <button className="tk-btn-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Panel edición del ticket */}
        {editandoTicket && esAdmin && (
          <div className="tk-edit-panel">
            <h4 style={{ margin:'0 0 10px', fontSize:13 }}>Editar datos del ticket</h4>
            <label>Cliente<input value={eCliente} onChange={e=>setECliente(e.target.value)} placeholder="Nombre del cliente" /></label>
            <label>Nota<input value={eNota} onChange={e=>setENota(e.target.value)} placeholder="Observaciones..." /></label>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="tk-btn-cancel" onClick={()=>setEditandoTicket(false)}>Cancelar</button>
              <button className="tk-btn-save" onClick={guardarTicket} disabled={guardandoTicket}>
                {guardandoTicket ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {/* Panel edición de empresa */}
        {editandoEmpresa && esAdmin && (
          <div className="tk-edit-panel">
            <h4 style={{ margin:'0 0 10px', fontSize:13 }}>Datos de empresa (aplican en todos los documentos)</h4>
            {[
              { key:'nombre_empresa',    label:'Nombre empresa' },
              { key:'ruc_empresa',       label:'RUC (sin DV)' },
              { key:'dv_empresa',        label:'Dígito Verificador (DV)' },
              { key:'direccion_empresa', label:'Dirección' },
              { key:'telefono_empresa',  label:'Teléfono' },
              { key:'email_empresa',     label:'Correo electrónico' },
            ].map(({ key, label }) => (
              <label key={key}>
                {label}
                <input
                  value={eEmpresa[key] || ''}
                  onChange={e=>setEEmpresa(prev=>({ ...prev, [key]: e.target.value }))}
                  placeholder={label}
                />
              </label>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="tk-btn-cancel" onClick={()=>setEditandoEmpresa(false)}>Cancelar</button>
              <button className="tk-btn-save" onClick={guardarEmpresa} disabled={guardandoEmpresa}>
                {guardandoEmpresa ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}

        {/* Vista imprimible del ticket */}
        <div className="ticket-print">
          <div style={{ textAlign:'center' }}>
            <p className="tk-empresa">{empresa.nombre_empresa || 'Piladora'}</p>
            {rucCompleto  && <p className="tk-sub">RUC: {rucCompleto}</p>}
            {empresa.direccion_empresa && <p className="tk-sub">{empresa.direccion_empresa}</p>}
            {empresa.telefono_empresa  && <p className="tk-sub">Tel: {empresa.telefono_empresa}</p>}
            <p className="tk-sep">{'─'.repeat(30)}</p>
            <p className="tk-titulo">TIQUETE DE VENTA</p>
            <p className="tk-sub">No. {numTicket}</p>
            <p className="tk-sub">{fmtFecha(venta.createdAt)}</p>
            {venta.usuario?.nombre && <p className="tk-sub">Vendedor: {venta.usuario.nombre}</p>}
            {venta.cliente         && <p className="tk-sub">Cliente: {venta.cliente}</p>}
            <p className="tk-sep">{'─'.repeat(30)}</p>
          </div>

          <table className="tk-tabla">
            <thead>
              <tr>
                <th style={{ textAlign:'left' }}>Producto</th>
                <th style={{ textAlign:'center' }}>Qty</th>
                <th style={{ textAlign:'right' }}>P.U.</th>
                <th style={{ textAlign:'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {venta.detalles.map(d => (
                <tr key={d.id}>
                  <td style={{ maxWidth:90, wordBreak:'break-word' }}>{d.producto?.nombre}</td>
                  <td style={{ textAlign:'center' }}>{d.cantidad}</td>
                  <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>{fmtMoney(d.precioUnit)}</td>
                  <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>{fmtMoney(d.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="tk-sep">{'─'.repeat(30)}</p>

          <div className="tk-totales">
            {venta.aplicaITBMS && (
              <>
                <div className="tk-total-row">
                  <span>Base imponible:</span><span>{fmtMoney(baseImponible)}</span>
                </div>
                <div className="tk-total-row">
                  <span>ITBMS ({empresa.itbms_porcentaje || 7}%):</span><span>{fmtMoney(itbmsMonto)}</span>
                </div>
              </>
            )}
            <div className="tk-total-row tk-total-final">
              <span>TOTAL:</span><span>{fmtMoney(venta.total)}</span>
            </div>
            <div className="tk-total-row">
              <span>Forma de pago:</span>
              <span>{METODO_LABEL[venta.metodoPago] || venta.metodoPago}</span>
            </div>
            {venta.metodoPago === 'CREDITO' && (
              <div className="tk-total-row" style={{ color:'#f87171' }}>
                <span>⚠️ Pendiente de cobro</span>
              </div>
            )}
          </div>

          {venta.nota && (
            <p style={{ fontSize:11, color:'#888', marginTop:8, textAlign:'center' }}>Nota: {venta.nota}</p>
          )}

          <p className="tk-sep">{'─'.repeat(30)}</p>
          <p style={{ textAlign:'center', fontSize:11, color:'#888', margin:'4px 0' }}>¡Gracias por su compra!</p>
          {empresa.email_empresa && (
            <p style={{ textAlign:'center', fontSize:10, color:'#888' }}>{empresa.email_empresa}</p>
          )}
        </div>
      </div>

      <style>{`
        .tk-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.7);
          display:flex; align-items:center; justify-content:center;
          z-index:600; padding:16px;
        }
        .tk-modal {
          background:var(--bg-card); border:1px solid var(--border);
          border-radius:14px; width:100%; max-width:420px;
          max-height:92vh; overflow-y:auto; padding:20px;
        }
        .tk-topbar {
          display:flex; align-items:center; justify-content:space-between;
          margin-bottom:12px; flex-wrap:wrap; gap:8px;
        }
        .tk-btn-print { background:var(--accent-purple); color:#fff; border:none; border-radius:8px; padding:7px 12px; font-size:12px; font-weight:600; cursor:pointer; }
        .tk-btn-edit  { background:var(--bg-base); color:var(--text-secondary); border:1px solid var(--border); border-radius:8px; padding:7px 12px; font-size:12px; font-weight:600; cursor:pointer; }
        .tk-btn-close { background:none; border:none; color:var(--text-secondary); font-size:18px; cursor:pointer; padding:4px; }

        .tk-edit-panel {
          background:var(--bg-base); border:1px solid var(--accent-purple);
          border-radius:10px; padding:14px; margin-bottom:14px;
          display:flex; flex-direction:column; gap:8px;
        }
        .tk-edit-panel label { display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--text-secondary); }
        .tk-edit-panel input { background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:7px 10px; color:var(--text-primary); font-size:13px; outline:none; }
        .tk-edit-panel input:focus { border-color:var(--accent-purple); }
        .tk-btn-save   { flex:2; padding:8px; border-radius:7px; background:var(--accent-purple); color:#fff; border:none; font-size:13px; font-weight:600; cursor:pointer; }
        .tk-btn-cancel { flex:1; padding:8px; border-radius:7px; border:1px solid var(--border); background:none; color:var(--text-secondary); font-size:13px; cursor:pointer; }

        .ticket-print {
          font-family:'Courier New',monospace; font-size:12px; color:#222;
          background:#fff; border-radius:8px; padding:16px;
          max-width:320px; margin:0 auto; border:1px dashed #ccc;
        }
        .tk-empresa { font-size:15px; font-weight:bold; margin:0 0 2px; }
        .tk-titulo  { font-size:13px; font-weight:bold; margin:4px 0 2px; letter-spacing:1px; }
        .tk-sub     { margin:1px 0; font-size:11px; color:#555; }
        .tk-sep     { color:#aaa; font-size:11px; margin:5px 0; }

        .tk-tabla { width:100%; border-collapse:collapse; font-size:11px; margin:6px 0; }
        .tk-tabla th { font-weight:bold; padding:2px 4px; border-bottom:1px solid #ccc; }
        .tk-tabla td { padding:2px 4px; }

        .tk-totales { display:flex; flex-direction:column; gap:3px; }
        .tk-total-row { display:flex; justify-content:space-between; font-size:12px; padding:1px 0; }
        .tk-total-final { font-size:15px; font-weight:bold; border-top:1px solid #222; padding-top:4px; margin-top:2px; }

        @media print {
          body > *:not(.tk-overlay) { display:none !important; }
          .tk-overlay { position:static; background:none !important; }
          .tk-modal { box-shadow:none; border:none; max-height:none; padding:0; overflow:visible; }
          .tk-topbar, .tk-edit-panel { display:none !important; }
          .ticket-print { border:none; max-width:100%; padding:0; }
        }
      `}</style>
    </div>
  );
}
