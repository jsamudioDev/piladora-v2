// ─── Módulo de Créditos y Abonos ─────────────────────────────────────────────
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatMoney, formatDate } from '../../utils/format';

// ─── Utilidades ───────────────────────────────────────────────────────────────

// Devuelve true si el crédito lleva más de 7 días sin ningún abono (o sin abonar nunca)
function esVencido(credito) {
  if (credito.estado === 'PAGADO') return false;
  const hace7 = new Date();
  hace7.setDate(hace7.getDate() - 7);

  // Si tiene abonos, revisar el más reciente
  if (credito.abonos && credito.abonos.length > 0) {
    const ultimoAbono = new Date(credito.abonos[credito.abonos.length - 1].createdAt);
    return ultimoAbono < hace7;
  }
  // Sin abonos: revisar fecha de creación
  return new Date(credito.createdAt) < hace7;
}

// Badge de estado del crédito
function BadgeEstado({ estado, vencido }) {
  const esReal = vencido && estado !== 'PAGADO' ? 'VENCIDO' : estado;
  const colores = {
    PENDIENTE: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', borde: 'rgba(251,191,36,0.3)' },
    PAGADO:    { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80', borde: 'rgba(74,222,128,0.3)' },
    VENCIDO:   { bg: 'rgba(248,113,113,0.15)', color: '#f87171', borde: 'rgba(248,113,113,0.3)' },
  };
  const c = colores[esReal] || colores.PENDIENTE;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.color, border: `1px solid ${c.borde}`,
    }}>
      {esReal}
    </span>
  );
}

// ─── Modal de detalle + abonos ────────────────────────────────────────────────
function ModalCredito({ credito, onCerrar, onAbonoRegistrado }) {
  const [monto,      setMonto]      = useState('');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [referencia, setReferencia] = useState('');
  const [nota,       setNota]       = useState('');
  const [cargando,   setCargando]   = useState(false);
  const [error,      setError]      = useState('');

  async function registrarAbono(e) {
    e.preventDefault();
    setError('');
    if (!monto || Number(monto) <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    try {
      setCargando(true);
      await api.post(`/creditos/${credito.id}/abono`, {
        monto: Number(monto), metodoPago, referencia, nota,
      });
      setMonto(''); setReferencia(''); setNota('');
      onAbonoRegistrado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const porcentajePagado = credito.montoTotal > 0
    ? Math.min((credito.montoPagado / credito.montoTotal) * 100, 100)
    : 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-panel">
        {/* Header del modal */}
        <div className="modal-header">
          <div>
            <h3 className="modal-titulo">{credito.clienteNombre}</h3>
            {credito.clienteTel && (
              <span className="modal-tel">📞 {credito.clienteTel}</span>
            )}
          </div>
          <button className="modal-cerrar" onClick={onCerrar}>✕</button>
        </div>

        {/* Resumen del crédito */}
        <div className="modal-resumen">
          <div className="resumen-item">
            <span className="resumen-label">Total</span>
            <span className="resumen-valor">{formatMoney(credito.montoTotal)}</span>
          </div>
          <div className="resumen-item">
            <span className="resumen-label">Pagado</span>
            <span className="resumen-valor" style={{ color: 'var(--accent-green)' }}>
              {formatMoney(credito.montoPagado)}
            </span>
          </div>
          <div className="resumen-item">
            <span className="resumen-label">Saldo</span>
            <span className="resumen-valor" style={{ color: credito.saldo > 0 ? '#f87171' : 'var(--accent-green)' }}>
              {formatMoney(credito.saldo)}
            </span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div style={{ margin: '0 0 16px' }}>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, transition: 'width 0.4s',
              width: `${porcentajePagado}%`,
              background: porcentajePagado >= 100 ? 'var(--accent-green)' : '#fbbf24',
            }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
            {porcentajePagado.toFixed(0)}% pagado
          </span>
        </div>

        {/* Historial de abonos */}
        <div style={{ marginBottom: 20 }}>
          <h4 className="modal-section-title">Historial de abonos</h4>
          {credito.abonos && credito.abonos.length > 0 ? (
            <div className="abonos-lista">
              {credito.abonos.map(a => (
                <div key={a.id} className="abono-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: 15 }}>
                      +{formatMoney(a.monto)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {new Date(a.createdAt).toLocaleDateString('es-PA', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <span className="abono-badge">{a.metodoPago}</span>
                    {a.referencia && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ref: {a.referencia}</span>}
                    {a.nota && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.nota}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
              Sin abonos registrados
            </p>
          )}
        </div>

        {/* Formulario de abono — solo si hay saldo pendiente */}
        {credito.estado !== 'PAGADO' && (
          <form onSubmit={registrarAbono} className="abono-form">
            <h4 className="modal-section-title">Registrar Abono</h4>

            {error && <p className="form-error">{error}</p>}

            <div className="form-row">
              <div className="form-group">
                <label>Monto ($)</label>
                <input
                  type="number" step="0.01" min="0.01"
                  max={credito.saldo}
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  placeholder={`Máx: ${formatMoney(credito.saldo)}`}
                  required
                />
              </div>
              <div className="form-group">
                <label>Método de pago</label>
                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="YAPPY">Yappy</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Referencia <span style={{ color: 'var(--text-secondary)' }}>(opcional)</span></label>
                <input
                  type="text" value={referencia}
                  onChange={e => setReferencia(e.target.value)}
                  placeholder="Nº cheque, comprobante..."
                />
              </div>
              <div className="form-group">
                <label>Nota <span style={{ color: 'var(--text-secondary)' }}>(opcional)</span></label>
                <input
                  type="text" value={nota}
                  onChange={e => setNota(e.target.value)}
                  placeholder="Observación..."
                />
              </div>
            </div>

            <button type="submit" className="btn-abono" disabled={cargando}>
              {cargando ? 'Guardando...' : '✓ Registrar abono'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Modal para crear crédito manual ─────────────────────────────────────────
function ModalNuevoCredito({ onCerrar, onCreado }) {
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTel,    setClienteTel]    = useState('');
  const [montoTotal,    setMontoTotal]    = useState('');
  const [nota,          setNota]          = useState('');
  const [cargando,      setCargando]      = useState(false);
  const [error,         setError]         = useState('');

  async function crear(e) {
    e.preventDefault();
    setError('');
    try {
      setCargando(true);
      await api.post('/creditos', { clienteNombre, clienteTel, montoTotal, nota });
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-panel" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3 className="modal-titulo">Nuevo Crédito</h3>
          <button className="modal-cerrar" onClick={onCerrar}>✕</button>
        </div>

        <form onSubmit={crear}>
          {error && <p className="form-error">{error}</p>}

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Nombre del cliente *</label>
            <input
              type="text" value={clienteNombre}
              onChange={e => setClienteNombre(e.target.value)}
              placeholder="Nombre completo"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Teléfono <span style={{ color: 'var(--text-secondary)' }}>(opcional)</span></label>
              <input
                type="text" value={clienteTel}
                onChange={e => setClienteTel(e.target.value)}
                placeholder="6000-0000"
              />
            </div>
            <div className="form-group">
              <label>Monto total ($) *</label>
              <input
                type="number" step="0.01" min="0.01"
                value={montoTotal}
                onChange={e => setMontoTotal(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Nota <span style={{ color: 'var(--text-secondary)' }}>(opcional)</span></label>
            <input
              type="text" value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Descripción del crédito..."
            />
          </div>

          <button type="submit" className="btn-abono" disabled={cargando}>
            {cargando ? 'Creando...' : '+ Crear crédito'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Creditos() {
  const { esAdmin } = useAuth();

  const [creditos,       setCreditos]       = useState([]);
  const [cargando,       setCargando]       = useState(true);
  const [filtroEstado,   setFiltroEstado]   = useState('');
  const [creditoActivo,  setCreditoActivo]  = useState(null);   // para el modal de detalle
  const [mostrarNuevo,   setMostrarNuevo]   = useState(false);  // modal nuevo crédito
  const [resumen,        setResumen]        = useState({ activos: 0, vencidos: 0, totalPendiente: 0 });

  async function cargar() {
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

  // Cuando se registra un abono, recargar todo y actualizar el crédito activo
  async function onAbonoRegistrado() {
    await cargar();
    if (creditoActivo) {
      try {
        const actualizado = await api.get(`/creditos/${creditoActivo.id}`);
        setCreditoActivo(actualizado);
      } catch (_) {}
    }
  }

  return (
    <div className="creditos-page">
      {/* HEADER */}
      <div className="cred-topbar">
        <h2 className="cred-titulo">Créditos</h2>
        <button className="btn-nuevo" onClick={() => setMostrarNuevo(true)}>
          + Nuevo Crédito
        </button>
      </div>

      {/* CARDS RESUMEN */}
      <div className="cred-cards">
        <div className="cred-card">
          <p className="cred-card-label">Total Pendiente</p>
          <p className="cred-card-valor" style={{ color: '#f87171' }}>
            {formatMoney(resumen.totalPendiente)}
          </p>
        </div>
        <div className="cred-card">
          <p className="cred-card-label">Créditos Activos</p>
          <p className="cred-card-valor" style={{ color: '#fbbf24' }}>
            {resumen.activos}
          </p>
        </div>
        <div className="cred-card" style={{ borderTopColor: resumen.vencidos > 0 ? '#f87171' : 'var(--border)' }}>
          <p className="cred-card-label">Vencidos (+7 días)</p>
          <p className="cred-card-valor" style={{ color: resumen.vencidos > 0 ? '#f87171' : 'var(--text-secondary)' }}>
            {resumen.vencidos}
          </p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="cred-filtros">
        {['', 'PENDIENTE', 'PAGADO', 'VENCIDO'].map(f => (
          <button
            key={f}
            className={`filtro-btn${filtroEstado === f ? ' filtro-btn--activo' : ''}`}
            onClick={() => setFiltroEstado(f)}
          >
            {f || 'Todos'}
          </button>
        ))}
      </div>

      {/* TABLA */}
      {cargando ? (
        <p style={{ color: 'var(--text-secondary)', padding: 20 }}>Cargando...</p>
      ) : creditos.length === 0 ? (
        <div className="cred-empty">
          <p>No hay créditos{filtroEstado ? ` con estado "${filtroEstado}"` : ''}</p>
        </div>
      ) : (
        <div className="cred-tabla-wrapper">
          <table className="cred-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Monto Total</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {creditos.map(c => {
                const vencido = esVencido(c);
                return (
                  <tr
                    key={c.id}
                    className={vencido && c.estado !== 'PAGADO' ? 'fila-vencida' : ''}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.clienteNombre}</div>
                      {c.clienteTel && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.clienteTel}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(c.montoTotal)}</td>
                    <td style={{ color: 'var(--accent-green)' }}>{formatMoney(c.montoPagado)}</td>
                    <td style={{ fontWeight: 700, color: c.saldo > 0 ? '#f87171' : 'var(--accent-green)' }}>
                      {formatMoney(c.saldo)}
                    </td>
                    <td><BadgeEstado estado={c.estado} vencido={vencido} /></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {formatDate(c.createdAt)}
                    </td>
                    <td>
                      <button
                        className="btn-detalle"
                        onClick={() => setCreditoActivo(c)}
                      >
                        Ver / Abonar
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
          credito={creditoActivo}
          onCerrar={() => setCreditoActivo(null)}
          onAbonoRegistrado={onAbonoRegistrado}
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
        .cred-topbar { display: flex; align-items: center; justify-content: space-between; }
        .cred-titulo  { font-size: 22px; font-weight: 700; }
        .btn-nuevo {
          background: var(--accent-purple); color: #fff; border: none;
          padding: 10px 18px; border-radius: 8px; font-size: 14px;
          font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .btn-nuevo:hover { opacity: 0.85; }

        /* Cards resumen */
        .cred-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 600px) { .cred-cards { grid-template-columns: 1fr 1fr; } }
        .cred-card {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 12px; padding: 16px 18px; border-top: 3px solid var(--border);
        }
        .cred-card-label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .cred-card-valor  { font-size: 24px; font-weight: 700; }

        /* Filtros */
        .cred-filtros { display: flex; gap: 8px; flex-wrap: wrap; }
        .filtro-btn {
          padding: 6px 16px; border-radius: 20px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .filtro-btn:hover { background: var(--bg-card); color: var(--text-primary); }
        .filtro-btn--activo {
          background: rgba(124,106,247,0.15); color: var(--accent-purple);
          border-color: rgba(124,106,247,0.4);
        }

        /* Tabla */
        .cred-tabla-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); }
        .cred-tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
        .cred-tabla th {
          text-align: left; padding: 10px 14px; background: var(--bg-card);
          color: var(--text-secondary); font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.5px; border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .cred-tabla td { padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
        .cred-tabla tr:last-child td { border-bottom: none; }
        .cred-tabla tr:hover td { background: rgba(255,255,255,0.02); }

        /* Fila vencida: fondo rojo sutil */
        .fila-vencida td { background: rgba(248,113,113,0.05); }
        .fila-vencida:hover td { background: rgba(248,113,113,0.08) !important; }

        .btn-detalle {
          font-size: 12px; padding: 6px 12px; border-radius: 6px;
          background: rgba(124,106,247,0.12); color: var(--accent-purple);
          border: 1px solid rgba(124,106,247,0.3); cursor: pointer;
          font-weight: 600; transition: background 0.15s; white-space: nowrap;
        }
        .btn-detalle:hover { background: rgba(124,106,247,0.22); }

        .cred-empty {
          text-align: center; padding: 40px 20px;
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
          color: var(--text-secondary); font-size: 14px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: flex-end;
          z-index: 300; padding: 16px;
        }
        .modal-panel {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 16px; width: 100%; max-width: 520px;
          max-height: 90vh; overflow-y: auto; padding: 24px;
          display: flex; flex-direction: column; gap: 0;
        }
        .modal-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 16px;
        }
        .modal-titulo { font-size: 20px; font-weight: 700; }
        .modal-tel    { font-size: 13px; color: var(--text-secondary); display: block; margin-top: 2px; }
        .modal-cerrar {
          background: rgba(255,255,255,0.06); border: 1px solid var(--border);
          color: var(--text-secondary); width: 32px; height: 32px; border-radius: 8px;
          cursor: pointer; font-size: 14px; flex-shrink: 0;
        }
        .modal-cerrar:hover { background: rgba(248,113,113,0.15); color: #f87171; }

        .modal-resumen {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
          background: var(--bg-base); border-radius: 10px; padding: 14px;
          margin-bottom: 14px;
        }
        .resumen-item { display: flex; flex-direction: column; gap: 4px; align-items: center; }
        .resumen-label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; }
        .resumen-valor { font-size: 16px; font-weight: 700; }

        .modal-section-title {
          font-size: 12px; font-weight: 700; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
        }

        /* Lista de abonos */
        .abonos-lista {
          display: flex; flex-direction: column; gap: 8px;
          max-height: 220px; overflow-y: auto;
        }
        .abono-item {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 10px 12px;
        }
        .abono-badge {
          font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
          background: rgba(96,165,250,0.12); color: var(--accent-blue);
          border: 1px solid rgba(96,165,250,0.25);
        }

        /* Formulario de abono */
        .abono-form {
          border-top: 1px solid var(--border); padding-top: 16px; margin-top: 4px;
        }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        @media (max-width: 500px) { .form-row { grid-template-columns: 1fr; } }
        .form-group { display: flex; flex-direction: column; gap: 4px; }
        .form-group label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
        .form-group input,
        .form-group select {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text-primary); padding: 8px 10px;
          font-size: 14px; outline: none; transition: border-color 0.15s;
        }
        .form-group input:focus,
        .form-group select:focus { border-color: var(--accent-purple); }
        .form-error {
          background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3);
          color: #f87171; border-radius: 8px; padding: 8px 12px;
          font-size: 13px; margin-bottom: 10px;
        }
        .btn-abono {
          width: 100%; padding: 11px; border-radius: 8px; border: none;
          background: var(--accent-purple); color: #fff; font-size: 14px;
          font-weight: 700; cursor: pointer; margin-top: 4px; transition: opacity 0.15s;
        }
        .btn-abono:hover:not(:disabled) { opacity: 0.85; }
        .btn-abono:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
