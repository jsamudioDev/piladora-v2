// ─── Módulo de Créditos y Abonos ─────────────────────────────────────────────
// Gestión completa: crear, editar, abonar, eliminar abonos, marcar pagado/vencido.
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, formatDate } from '../../utils/format';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtFechaLocal(iso) {
  if (!iso) return '—';
  const d   = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}

// Crédito vencido = sin pago en los últimos 7 días
function esVencido(credito) {
  if (credito.estado === 'PAGADO') return false;
  if (credito.fechaVencimiento && new Date(credito.fechaVencimiento) < new Date()) return true;
  const hace7 = new Date();
  hace7.setDate(hace7.getDate() - 7);
  if (credito.abonos?.length > 0) {
    const ultimo = new Date(credito.abonos[credito.abonos.length - 1].createdAt);
    return ultimo < hace7;
  }
  return new Date(credito.createdAt) < hace7;
}

// Badge de estado visual
function BadgeEstado({ estado, vencido }) {
  const real = vencido && estado !== 'PAGADO' ? 'VENCIDO' : estado;
  const col = {
    PENDIENTE: { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', borde: 'rgba(251,191,36,0.3)'  },
    PAGADO:    { bg: 'rgba(74,222,128,0.15)',   color: '#4ade80', borde: 'rgba(74,222,128,0.3)'  },
    VENCIDO:   { bg: 'rgba(248,113,113,0.15)',  color: '#f87171', borde: 'rgba(248,113,113,0.3)' },
  };
  const c = col[real] || col.PENDIENTE;
  return (
    <span style={{
      fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
      background:c.bg, color:c.color, border:`1px solid ${c.borde}`,
    }}>{real}</span>
  );
}

// ─── Modal de detalle: abonos + edición + eliminar abono ──────────────────────
function ModalCredito({ creditoId, esAdmin, onCerrar, onCambio }) {
  const [credito,       setCredito]       = useState(null);
  const [cargando,      setCargando]      = useState(true);

  // Formulario de abono
  const [monto,         setMonto]         = useState('');
  const [metodoPago,    setMetodoPago]    = useState('EFECTIVO');
  const [referencia,    setReferencia]    = useState('');
  const [notaAbono,     setNotaAbono]     = useState('');
  const [abonando,      setAbonando]      = useState(false);
  const [abonoError,    setAbonoError]    = useState('');

  // Modo edición del crédito
  const [editando,      setEditando]      = useState(false);
  const [eNombre,       setENombre]       = useState('');
  const [eTel,          setETel]          = useState('');
  const [eCedula,       setECedula]       = useState('');
  const [eFechaVenc,    setEFechaVenc]    = useState('');
  const [eNota,         setENota]         = useState('');
  const [eEstado,       setEEstado]       = useState('');
  const [guardando,     setGuardando]     = useState(false);
  const [editError,     setEditError]     = useState('');

  async function cargar() {
    try {
      const data = await api.get(`/creditos/${creditoId}`);
      setCredito(data);
      // Inicializar campos de edición
      setENombre(data.clienteNombre  || '');
      setETel(data.clienteTel        || '');
      setECedula(data.clienteCedula  || '');
      setEFechaVenc(data.fechaVencimiento
        ? new Date(data.fechaVencimiento).toISOString().slice(0,10) : '');
      setENota(data.nota             || '');
      setEEstado(data.estado         || 'PENDIENTE');
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [creditoId]);

  async function registrarAbono(e) {
    e.preventDefault();
    setAbonoError('');
    if (!monto || Number(monto) <= 0) { setAbonoError('El monto debe ser mayor a 0'); return; }
    try {
      setAbonando(true);
      await api.post(`/creditos/${creditoId}/abono`, {
        monto: Number(monto), metodoPago, referencia, nota: notaAbono,
      });
      setMonto(''); setReferencia(''); setNotaAbono('');
      await cargar();
      onCambio();
    } catch (err) {
      setAbonoError(err.message);
    } finally {
      setAbonando(false);
    }
  }

  async function eliminarAbono(abonoId) {
    if (!window.confirm('¿Eliminar este abono? El saldo del crédito será ajustado.')) return;
    try {
      await api.delete(`/creditos/${creditoId}/abono/${abonoId}`);
      await cargar();
      onCambio();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  async function guardarEdicion() {
    setEditError('');
    if (!eNombre.trim()) { setEditError('El nombre es obligatorio'); return; }
    try {
      setGuardando(true);
      await api.put(`/creditos/${creditoId}`, {
        clienteNombre:    eNombre.trim(),
        clienteTel:       eTel.trim()    || null,
        clienteCedula:    eCedula.trim() || null,
        fechaVencimiento: eFechaVenc     || null,
        nota:             eNota.trim()   || null,
        estado:           eEstado,
      });
      setEditando(false);
      await cargar();
      onCambio();
    } catch (e) {
      setEditError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (cargando || !credito) {
    return (
      <div className="cr-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
        <div className="cr-panel">
          <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:32 }}>Cargando...</p>
        </div>
      </div>
    );
  }

  const pct = credito.montoTotal > 0
    ? Math.min((credito.montoPagado / credito.montoTotal) * 100, 100) : 0;

  return (
    <div className="cr-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="cr-panel">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="cr-header">
          <div>
            <h3 className="cr-titulo">{credito.clienteNombre}</h3>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:4 }}>
              {credito.clienteTel    && <span style={{ fontSize:12, color:'var(--text-secondary)' }}>📞 {credito.clienteTel}</span>}
              {credito.clienteCedula && <span style={{ fontSize:12, color:'var(--text-secondary)' }}>🪪 {credito.clienteCedula}</span>}
              {credito.fechaVencimiento && (
                <span style={{ fontSize:12, color: new Date(credito.fechaVencimiento) < new Date() ? '#f87171' : '#fbbf24' }}>
                  ⏰ Vence: {fmtFechaLocal(credito.fechaVencimiento)}
                </span>
              )}
              {credito.ventaId && (
                <span style={{ fontSize:12, color:'var(--text-secondary)' }}>
                  Venta #{String(credito.ventaId).padStart(4,'0')}
                </span>
              )}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {esAdmin && (
              <button className="cr-btn-editar" onClick={() => setEditando(v => !v)}>
                ✏️
              </button>
            )}
            <button className="cr-cerrar" onClick={onCerrar}>✕</button>
          </div>
        </div>

        {/* ── Panel de edición (ADMIN) ────────────────────────────────────────── */}
        {editando && esAdmin && (
          <div className="cr-edit-panel">
            <h4 style={{ margin:'0 0 10px', fontSize:13 }}>Editar crédito</h4>
            {editError && <p className="cr-error">{editError}</p>}
            <div className="cr-edit-grid">
              <label className="cr-label">
                Nombre
                <input className="cr-input" value={eNombre} onChange={e=>setENombre(e.target.value)} placeholder="Nombre del cliente" />
              </label>
              <label className="cr-label">
                Teléfono
                <input className="cr-input" value={eTel} onChange={e=>setETel(e.target.value)} placeholder="6000-0000" />
              </label>
              <label className="cr-label">
                Cédula / RUC
                <input className="cr-input" value={eCedula} onChange={e=>setECedula(e.target.value)} placeholder="8-123-456" />
              </label>
              <label className="cr-label">
                Fecha vencimiento
                <input className="cr-input" type="date" value={eFechaVenc} onChange={e=>setEFechaVenc(e.target.value)} />
              </label>
              <label className="cr-label" style={{ gridColumn:'1/-1' }}>
                Nota
                <input className="cr-input" value={eNota} onChange={e=>setENota(e.target.value)} placeholder="Observaciones..." />
              </label>
              <label className="cr-label">
                Estado
                <select className="cr-input" value={eEstado} onChange={e=>setEEstado(e.target.value)}>
                  <option value="PENDIENTE">PENDIENTE</option>
                  <option value="PAGADO">PAGADO</option>
                  <option value="VENCIDO">VENCIDO</option>
                </select>
              </label>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <button className="cr-btn-cancel" onClick={() => setEditando(false)}>Cancelar</button>
              <button className="cr-btn-save" onClick={guardarEdicion} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}

        {/* ── Resumen numérico ─────────────────────────────────────────────────── */}
        <div className="cr-resumen">
          <div className="cr-res-item">
            <span className="cr-res-label">Total</span>
            <span className="cr-res-valor">{formatMoney(credito.montoTotal)}</span>
          </div>
          <div className="cr-res-item">
            <span className="cr-res-label">Pagado</span>
            <span className="cr-res-valor" style={{ color:'var(--accent-green)' }}>{formatMoney(credito.montoPagado)}</span>
          </div>
          <div className="cr-res-item">
            <span className="cr-res-label">Saldo</span>
            <span className="cr-res-valor" style={{ color: credito.saldo > 0 ? '#f87171' : 'var(--accent-green)' }}>
              {formatMoney(credito.saldo)}
            </span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div style={{ margin:'0 0 16px' }}>
          <div style={{ height:7, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:4, transition:'width 0.4s',
              width:`${pct}%`,
              background: pct >= 100 ? 'var(--accent-green)' : '#fbbf24',
            }} />
          </div>
          <span style={{ fontSize:11, color:'var(--text-secondary)', marginTop:4, display:'block' }}>
            {pct.toFixed(0)}% pagado
          </span>
        </div>

        {/* ── Historial de abonos ─────────────────────────────────────────────── */}
        <div style={{ marginBottom:16 }}>
          <h4 className="cr-section-title">Historial de abonos</h4>
          {credito.abonos?.length > 0 ? (
            <div className="cr-abonos-lista">
              {credito.abonos.map(a => (
                <div key={a.id} className="cr-abono-item">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:700, color:'var(--accent-green)', fontSize:15 }}>
                      +{formatMoney(a.monto)}
                    </span>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ fontSize:11, color:'var(--text-secondary)' }}>
                        {new Date(a.createdAt).toLocaleDateString('es-PA',{
                          day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit',
                        })}
                      </span>
                      {esAdmin && (
                        <button
                          className="cr-btn-del-abono"
                          onClick={() => eliminarAbono(a.id)}
                          title="Eliminar abono"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
                    <span className="cr-abono-badge">{a.metodoPago}</span>
                    {a.referencia && <span style={{ fontSize:12, color:'var(--text-secondary)' }}>Ref: {a.referencia}</span>}
                    {a.nota       && <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{a.nota}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color:'var(--text-secondary)', fontSize:13, textAlign:'center', padding:'12px 0' }}>
              Sin abonos registrados
            </p>
          )}
        </div>

        {/* ── Formulario de abono ─────────────────────────────────────────────── */}
        {credito.estado !== 'PAGADO' && (
          <form onSubmit={registrarAbono} className="cr-abono-form">
            <h4 className="cr-section-title">Registrar Abono</h4>

            {abonoError && <p className="cr-error">{abonoError}</p>}

            <div className="cr-form-row">
              <div className="cr-form-group">
                <label>Monto (B/.)</label>
                <input
                  type="number" step="0.01" min="0.01"
                  max={credito.saldo}
                  value={monto}
                  onChange={e=>setMonto(e.target.value)}
                  placeholder={`Máx: ${formatMoney(credito.saldo)}`}
                  required
                />
              </div>
              <div className="cr-form-group">
                <label>Método de pago</label>
                <select value={metodoPago} onChange={e=>setMetodoPago(e.target.value)}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="YAPPY">Yappy</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            <div className="cr-form-row">
              <div className="cr-form-group">
                <label>Referencia <span style={{ color:'var(--text-secondary)', fontWeight:400 }}>(opcional)</span></label>
                <input type="text" value={referencia} onChange={e=>setReferencia(e.target.value)} placeholder="Nº cheque, comprobante..." />
              </div>
              <div className="cr-form-group">
                <label>Nota <span style={{ color:'var(--text-secondary)', fontWeight:400 }}>(opcional)</span></label>
                <input type="text" value={notaAbono} onChange={e=>setNotaAbono(e.target.value)} placeholder="Observación..." />
              </div>
            </div>

            <button type="submit" className="cr-btn-abono" disabled={abonando}>
              {abonando ? 'Guardando...' : '✓ Registrar abono'}
            </button>
          </form>
        )}

        {credito.estado === 'PAGADO' && (
          <div style={{
            background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.3)',
            borderRadius:10, padding:'14px 16px', textAlign:'center',
            color:'var(--accent-green)', fontWeight:700, fontSize:15,
          }}>
            ✓ Crédito PAGADO en su totalidad
          </div>
        )}

        {credito.nota && (
          <p style={{ fontSize:12, color:'var(--text-secondary)', fontStyle:'italic', marginTop:8 }}>
            Nota: {credito.nota}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Modal para crear crédito manual ─────────────────────────────────────────
function ModalNuevoCredito({ onCerrar, onCreado }) {
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTel,    setClienteTel]    = useState('');
  const [clienteCedula, setClienteCedula] = useState('');
  const [montoTotal,    setMontoTotal]    = useState('');
  const [nota,          setNota]          = useState('');
  const [fechaVenc,     setFechaVenc]     = useState('');
  const [cargando,      setCargando]      = useState(false);
  const [error,         setError]         = useState('');

  async function crear(e) {
    e.preventDefault();
    setError('');
    try {
      setCargando(true);
      await api.post('/creditos', {
        clienteNombre,
        clienteTel:       clienteTel    || null,
        clienteCedula:    clienteCedula || null,
        montoTotal:       Number(montoTotal),
        nota:             nota          || null,
        fechaVencimiento: fechaVenc     || null,
      });
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="cr-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="cr-panel" style={{ maxWidth:480 }}>
        <div className="cr-header">
          <h3 className="cr-titulo">Nuevo Crédito</h3>
          <button className="cr-cerrar" onClick={onCerrar}>✕</button>
        </div>

        <form onSubmit={crear}>
          {error && <p className="cr-error">{error}</p>}

          <div className="cr-form-group" style={{ marginBottom:12 }}>
            <label>Nombre del cliente *</label>
            <input
              type="text" value={clienteNombre}
              onChange={e => setClienteNombre(e.target.value)}
              placeholder="Nombre completo" required
            />
          </div>

          <div className="cr-form-row">
            <div className="cr-form-group">
              <label>Teléfono</label>
              <input type="text" value={clienteTel} onChange={e=>setClienteTel(e.target.value)} placeholder="6000-0000" />
            </div>
            <div className="cr-form-group">
              <label>Cédula / RUC</label>
              <input type="text" value={clienteCedula} onChange={e=>setClienteCedula(e.target.value)} placeholder="8-123-456" />
            </div>
          </div>

          <div className="cr-form-row">
            <div className="cr-form-group">
              <label>Monto total (B/.) *</label>
              <input
                type="number" step="0.01" min="0.01"
                value={montoTotal} onChange={e=>setMontoTotal(e.target.value)}
                placeholder="0.00" required
              />
            </div>
            <div className="cr-form-group">
              <label>Fecha de vencimiento</label>
              <input type="date" value={fechaVenc} onChange={e=>setFechaVenc(e.target.value)} />
            </div>
          </div>

          <div className="cr-form-group" style={{ marginBottom:16 }}>
            <label>Nota / Descripción</label>
            <input type="text" value={nota} onChange={e=>setNota(e.target.value)} placeholder="Ej: Maíz pilado junio 2026..." />
          </div>

          <button type="submit" className="cr-btn-abono" disabled={cargando}>
            {cargando ? 'Creando...' : '+ Crear crédito'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Creditos() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'ADMIN';

  const [creditos,      setCreditos]      = useState([]);
  const [cargando,      setCargando]      = useState(true);
  const [filtroEstado,  setFiltroEstado]  = useState('');
  const [creditoActivo, setCreditoActivo] = useState(null);  // id del crédito en modal
  const [mostrarNuevo,  setMostrarNuevo]  = useState(false);
  const [resumen,       setResumen]       = useState({ activos:0, vencidos:0, totalPendiente:0 });

  async function cargar() {
    setCargando(true);
    try {
      const params = filtroEstado ? `?estado=${filtroEstado}` : '';
      const [lista, res] = await Promise.all([
        api.get(`/creditos${params}`),
        api.get('/creditos/resumen'),
      ]);
      setCreditos(lista);
      setResumen(res);
    } catch (err) {
      console.error('Error cargando créditos:', err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [filtroEstado]);

  return (
    <div className="creditos-page">

      {/* HEADER */}
      <div className="cr-topbar">
        <h2 className="cr-page-titulo">Créditos</h2>
        <button className="btn-nuevo-cr" onClick={() => setMostrarNuevo(true)}>
          + Nuevo Crédito
        </button>
      </div>

      {/* CARDS RESUMEN */}
      <div className="cr-cards">
        <div className="cr-card" style={{ borderTopColor:'#f87171' }}>
          <p className="cr-card-label">Total Pendiente</p>
          <p className="cr-card-valor" style={{ color:'#f87171' }}>{formatMoney(resumen.totalPendiente)}</p>
        </div>
        <div className="cr-card" style={{ borderTopColor:'#fbbf24' }}>
          <p className="cr-card-label">Créditos Activos</p>
          <p className="cr-card-valor" style={{ color:'#fbbf24' }}>{resumen.activos}</p>
        </div>
        <div className="cr-card" style={{ borderTopColor: resumen.vencidos > 0 ? '#f87171' : 'var(--border)' }}>
          <p className="cr-card-label">Vencidos (+7 días)</p>
          <p className="cr-card-valor" style={{ color: resumen.vencidos > 0 ? '#f87171' : 'var(--text-secondary)' }}>
            {resumen.vencidos}
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="cr-filtros">
        {['', 'PENDIENTE', 'PAGADO', 'VENCIDO'].map(f => (
          <button
            key={f}
            className={`cr-filtro${filtroEstado === f ? ' cr-filtro--activo' : ''}`}
            onClick={() => setFiltroEstado(f)}
          >
            {f || 'Todos'}
          </button>
        ))}
      </div>

      {/* TABLA */}
      {cargando ? (
        <p style={{ color:'var(--text-secondary)', padding:20 }}>Cargando...</p>
      ) : creditos.length === 0 ? (
        <div className="cr-empty">
          <p>No hay créditos{filtroEstado ? ` en estado "${filtroEstado}"` : ''}</p>
        </div>
      ) : (
        <div className="cr-tabla-wrapper">
          <table className="cr-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Vence</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {creditos.map(c => {
                const vencido = esVencido(c);
                return (
                  <tr key={c.id} className={vencido && c.estado !== 'PAGADO' ? 'cr-fila-vencida' : ''}>
                    <td>
                      <div style={{ fontWeight:600 }}>{c.clienteNombre}</div>
                      {c.clienteTel    && <div style={{ fontSize:11, color:'var(--text-secondary)' }}>📞 {c.clienteTel}</div>}
                      {c.clienteCedula && <div style={{ fontSize:11, color:'var(--text-secondary)' }}>🪪 {c.clienteCedula}</div>}
                      {c.ventaId       && <div style={{ fontSize:11, color:'var(--text-secondary)' }}>Venta #{String(c.ventaId).padStart(4,'0')}</div>}
                    </td>
                    <td style={{ fontWeight:600 }}>{formatMoney(c.montoTotal)}</td>
                    <td style={{ color:'var(--accent-green)' }}>{formatMoney(c.montoPagado)}</td>
                    <td style={{ fontWeight:700, color: c.saldo > 0 ? '#f87171' : 'var(--accent-green)' }}>
                      {formatMoney(c.saldo)}
                    </td>
                    <td><BadgeEstado estado={c.estado} vencido={vencido} /></td>
                    <td style={{ color:'var(--text-secondary)', fontSize:13 }}>{fmtFechaLocal(c.createdAt)}</td>
                    <td style={{ color: c.fechaVencimiento && new Date(c.fechaVencimiento) < new Date() ? '#f87171' : 'var(--text-secondary)', fontSize:13 }}>
                      {fmtFechaLocal(c.fechaVencimiento)}
                    </td>
                    <td>
                      <button className="cr-btn-detalle" onClick={() => setCreditoActivo(c.id)}>
                        {c.estado !== 'PAGADO' ? 'Ver / Abonar' : 'Ver detalle'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODALES */}
      {creditoActivo && (
        <ModalCredito
          creditoId={creditoActivo}
          esAdmin={esAdmin}
          onCerrar={() => setCreditoActivo(null)}
          onCambio={cargar}
        />
      )}
      {mostrarNuevo && (
        <ModalNuevoCredito
          onCerrar={() => setMostrarNuevo(false)}
          onCreado={() => { setMostrarNuevo(false); cargar(); }}
        />
      )}

      <style>{`
        .creditos-page { display: flex; flex-direction: column; gap: 16px; }

        /* Topbar */
        .cr-topbar { display: flex; align-items: center; justify-content: space-between; }
        .cr-page-titulo { font-size: 22px; font-weight: 700; }
        .btn-nuevo-cr {
          background: var(--accent-purple); color: #fff; border: none;
          padding: 10px 18px; border-radius: 8px; font-size: 14px;
          font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .btn-nuevo-cr:hover { opacity: 0.85; }

        /* Cards */
        .cr-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 600px) { .cr-cards { grid-template-columns: 1fr 1fr; } }
        .cr-card {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 12px; padding: 16px 18px;
          border-top: 3px solid var(--border);
        }
        .cr-card-label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .cr-card-valor { font-size: 24px; font-weight: 700; }

        /* Filtros */
        .cr-filtros { display: flex; gap: 8px; flex-wrap: wrap; }
        .cr-filtro {
          padding: 6px 16px; border-radius: 20px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .cr-filtro:hover { background: var(--bg-card); color: var(--text-primary); }
        .cr-filtro--activo {
          background: rgba(124,106,247,0.15); color: var(--accent-purple);
          border-color: rgba(124,106,247,0.4);
        }

        /* Tabla */
        .cr-tabla-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); }
        .cr-tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
        .cr-tabla th {
          text-align: left; padding: 10px 14px; background: var(--bg-card);
          color: var(--text-secondary); font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.5px; border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .cr-tabla td { padding: 11px 14px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
        .cr-tabla tr:last-child td { border-bottom: none; }
        .cr-tabla tr:hover td { background: rgba(255,255,255,0.02); }
        .cr-fila-vencida td { background: rgba(248,113,113,0.05); }
        .cr-fila-vencida:hover td { background: rgba(248,113,113,0.08) !important; }

        .cr-btn-detalle {
          font-size: 12px; padding: 6px 12px; border-radius: 6px;
          background: rgba(124,106,247,0.12); color: var(--accent-purple);
          border: 1px solid rgba(124,106,247,0.3); cursor: pointer;
          font-weight: 600; transition: background 0.15s; white-space: nowrap;
        }
        .cr-btn-detalle:hover { background: rgba(124,106,247,0.22); }

        .cr-empty {
          text-align: center; padding: 40px 20px;
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
          color: var(--text-secondary); font-size: 14px;
        }

        /* Modal */
        .cr-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: flex-end;
          z-index: 300; padding: 16px;
        }
        .cr-panel {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 16px; width: 100%; max-width: 520px;
          max-height: 90vh; overflow-y: auto; padding: 24px;
          display: flex; flex-direction: column; gap: 0;
        }
        .cr-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 14px;
        }
        .cr-titulo { font-size: 20px; font-weight: 700; }
        .cr-cerrar {
          background: rgba(255,255,255,0.06); border: 1px solid var(--border);
          color: var(--text-secondary); width: 32px; height: 32px; border-radius: 8px;
          cursor: pointer; font-size: 14px; flex-shrink: 0;
        }
        .cr-cerrar:hover { background: rgba(248,113,113,0.15); color: #f87171; }
        .cr-btn-editar {
          background: rgba(124,106,247,0.1); border: 1px solid rgba(124,106,247,0.3);
          color: var(--accent-purple); width: 32px; height: 32px; border-radius: 8px;
          cursor: pointer; font-size: 14px; flex-shrink: 0;
        }

        /* Panel de edición */
        .cr-edit-panel {
          background: var(--bg-base); border: 1px solid var(--accent-purple);
          border-radius: 10px; padding: 14px; margin-bottom: 14px;
        }
        .cr-edit-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
        }
        .cr-label {
          display: flex; flex-direction: column; gap: 4px;
          font-size: 12px; color: var(--text-secondary);
        }
        .cr-input {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 6px; padding: 7px 10px;
          color: var(--text-primary); font-size: 13px; outline: none;
        }
        .cr-input:focus { border-color: var(--accent-purple); }
        .cr-btn-save {
          flex: 2; padding: 8px; border-radius: 7px;
          background: var(--accent-purple); color: #fff; border: none;
          font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .cr-btn-cancel {
          flex: 1; padding: 8px; border-radius: 7px;
          border: 1px solid var(--border); background: none;
          color: var(--text-secondary); font-size: 13px; cursor: pointer;
        }

        /* Resumen */
        .cr-resumen {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
          background: var(--bg-base); border-radius: 10px; padding: 14px;
          margin-bottom: 14px;
        }
        .cr-res-item { display: flex; flex-direction: column; gap: 4px; align-items: center; }
        .cr-res-label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; }
        .cr-res-valor { font-size: 16px; font-weight: 700; }

        .cr-section-title {
          font-size: 12px; font-weight: 700; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
        }

        /* Abonos */
        .cr-abonos-lista { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; }
        .cr-abono-item {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 10px 12px;
        }
        .cr-abono-badge {
          font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
          background: rgba(96,165,250,0.12); color: var(--accent-blue);
          border: 1px solid rgba(96,165,250,0.25);
        }
        .cr-btn-del-abono {
          background: none; border: none; color: #f87171; cursor: pointer;
          font-size: 12px; padding: 2px 5px; border-radius: 4px; opacity: 0.6;
          transition: opacity 0.15s;
        }
        .cr-btn-del-abono:hover { opacity: 1; background: rgba(248,113,113,0.1); }

        /* Formulario de abono */
        .cr-abono-form { border-top: 1px solid var(--border); padding-top: 16px; margin-top: 4px; }
        .cr-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        @media (max-width: 500px) { .cr-form-row { grid-template-columns: 1fr; } }
        .cr-form-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 0; }
        .cr-form-group label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
        .cr-form-group input,
        .cr-form-group select {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text-primary); padding: 8px 10px;
          font-size: 14px; outline: none; transition: border-color 0.15s;
        }
        .cr-form-group input:focus,
        .cr-form-group select:focus { border-color: var(--accent-purple); }
        .cr-error {
          background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3);
          color: #f87171; border-radius: 8px; padding: 8px 12px;
          font-size: 13px; margin-bottom: 10px;
        }
        .cr-btn-abono {
          width: 100%; padding: 11px; border-radius: 8px; border: none;
          background: var(--accent-purple); color: #fff; font-size: 14px;
          font-weight: 700; cursor: pointer; margin-top: 4px; transition: opacity 0.15s;
        }
        .cr-btn-abono:hover:not(:disabled) { opacity: 0.85; }
        .cr-btn-abono:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
