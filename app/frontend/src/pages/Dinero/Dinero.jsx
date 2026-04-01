import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatMoney } from '../../utils/format';
import { useToast, ToastContainer } from '../../components/Toast';

const CATEGORIAS = ['Compra Maíz', 'Flete', 'Salarios', 'Mantenimiento', 'Otro'];

const CAT_COLOR = {
  'Compra Maíz':   '#f59e0b',
  'Flete':         '#60a5fa',
  'Salarios':      '#a78bfa',
  'Mantenimiento': '#fb923c',
  'Otro':          '#94a3b8',
  'Venta':         '#4ade80',
  'Pilado':        '#818cf8',
};

export default function Dinero() {
  const [tab, setTab]           = useState('movimientos');
  const [resumen, setResumen]   = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [egresos, setEgresos]   = useState([]);
  const [flujo, setFlujo]       = useState([]);
  const [cargando, setCargando] = useState(true);

  const [monto, setMonto]       = useState('');
  const [descripcion, setDesc]  = useState('');
  const [categoria, setCat]     = useState('Compra Maíz');
  const [enviando, setEnviando] = useState(false);

  const { toasts, show } = useToast();

  async function cargarDatos() {
    try {
      const [res, ing, egr, fl] = await Promise.all([
        api.get('/dinero/resumen'),
        api.get('/dinero/ingresos'),
        api.get('/dinero/egresos'),
        api.get('/dinero/flujo'),
      ]);
      setResumen(res);
      setIngresos(ing);
      setEgresos(egr);
      setFlujo(fl);
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarDatos(); }, []);

  async function guardarEgreso(e) {
    e.preventDefault();
    if (!monto || Number(monto) <= 0) { show('El monto debe ser mayor a 0', 'error'); return; }
    if (!descripcion.trim())          { show('La descripción es obligatoria', 'error'); return; }
    setEnviando(true);
    try {
      await api.post('/dinero/egresos', {
        monto: Number(monto), descripcion: descripcion.trim(), categoria,
      });
      setMonto(''); setDesc(''); setCat('Compra Maíz');
      show('Egreso registrado', 'success');
      cargarDatos();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <p style={{ color: 'var(--text-secondary)', padding: 20 }}>Cargando...</p>;

  // Mezclar ingresos y egresos, ordenar por fecha desc
  const movimientos = [
    ...ingresos.map(i => ({ ...i, tipo: 'ingreso' })),
    ...egresos.map(e => ({ ...e, tipo: 'egreso' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30);

  const maxFlujo = Math.max(...flujo.map(d => Math.max(d.ingresos, d.egresos, 1)));

  return (
    <div className="din-page">
      {/* STAT CARDS */}
      <div className="din-stats">
        <StatCard titulo="Ingresos Hoy" valor={formatMoney(resumen?.ingresosHoy || 0)} color="var(--accent-green)"  />
        <StatCard titulo="Ganancia Hoy" valor={formatMoney(resumen?.gananciaHoy || 0)} color="var(--accent-blue)"   />
        <StatCard titulo="Egresos Hoy"  valor={formatMoney(resumen?.egresosHoy  || 0)} color="var(--accent-red)"    />
        <StatCard titulo="Flujo Neto"   valor={formatMoney(resumen?.flujoNeto   || 0)} color="var(--accent-purple)" />
      </div>

      {/* TABS */}
      <div className="din-tabs">
        {[
          { id: 'movimientos', label: 'Movimientos' },
          { id: 'egreso',      label: 'Registrar Egreso' },
          { id: 'flujo',       label: 'Flujo Semanal' },
        ].map(t => (
          <button
            key={t.id}
            className={`din-tab${tab === t.id ? ' din-tab--on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB MOVIMIENTOS */}
      {tab === 'movimientos' && (
        <div className="din-card">
          {movimientos.length === 0 ? (
            <p className="din-empty">Sin movimientos registrados</p>
          ) : (
            <ul className="mov-list">
              {movimientos.map(m => {
                const color = CAT_COLOR[m.categoria] || '#94a3b8';
                return (
                  <li key={`${m.tipo}-${m.id}`} className="mov-item">
                    <span className={`mov-icon ${m.tipo === 'ingreso' ? 'mov-icon--up' : 'mov-icon--down'}`}>
                      {m.tipo === 'ingreso' ? '↑' : '↓'}
                    </span>
                    <div className="mov-info">
                      <span className="mov-desc">{m.descripcion}</span>
                      <span className="mov-meta">
                        {m.categoria && (
                          <span className="mov-pill" style={{
                            background: color + '22',
                            color,
                            border: `1px solid ${color}44`,
                          }}>
                            {m.categoria}
                          </span>
                        )}
                        {m.metodoPago && (
                          <span className="mov-pill" style={{
                            background: 'rgba(96,165,250,0.12)',
                            color: 'var(--accent-blue)',
                            border: '1px solid rgba(96,165,250,0.25)',
                          }}>
                            {m.metodoPago}
                          </span>
                        )}
                        <span className="mov-fecha">
                          {new Date(m.createdAt).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    </div>
                    <span className={`mov-monto ${m.tipo === 'ingreso' ? 'mov-monto--ing' : 'mov-monto--egr'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{formatMoney(m.monto)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* TAB REGISTRAR EGRESO */}
      {tab === 'egreso' && (
        <div className="din-card">
          <form className="egr-form" onSubmit={guardarEgreso}>
            <label className="field-label">
              Monto ($)
              <input
                className="field-input"
                type="number" min="0.01" step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="0.00"
                required
              />
            </label>
            <label className="field-label">
              Descripción
              <input
                className="field-input"
                value={descripcion}
                onChange={e => setDesc(e.target.value)}
                placeholder="Ej: Compra de 50 qq de maíz"
                required
              />
            </label>
            <label className="field-label">
              Categoría
              <select className="field-input" value={categoria} onChange={e => setCat(e.target.value)}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <button className="btn-guardar" type="submit" disabled={enviando}>
              {enviando ? 'Guardando...' : 'Guardar Egreso'}
            </button>
          </form>
        </div>
      )}

      {/* TAB FLUJO SEMANAL */}
      {tab === 'flujo' && (
        <div className="din-card">
          <div className="flujo-legend">
            <span><span className="leg-dot" style={{ background: 'var(--accent-green)' }} />Ingresos</span>
            <span><span className="leg-dot" style={{ background: 'var(--accent-red)' }} />Egresos</span>
          </div>
          <div className="flujo-chart">
            {flujo.map(d => {
              const ingH = Math.max((d.ingresos / maxFlujo) * 160, d.ingresos > 0 ? 4 : 0);
              const egrH = Math.max((d.egresos / maxFlujo) * 160, d.egresos > 0 ? 4 : 0);
              const dia  = new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-PA', { weekday: 'short', day: 'numeric' });
              return (
                <div key={d.fecha} className="flujo-col">
                  <div className="flujo-bars">
                    <div className="flujo-bar flujo-bar--ing" style={{ height: ingH }}
                         title={`Ingresos: ${formatMoney(d.ingresos)}`} />
                    <div className="flujo-bar flujo-bar--egr" style={{ height: egrH }}
                         title={`Egresos: ${formatMoney(d.egresos)}`} />
                  </div>
                  <span className={`flujo-neto ${d.neto >= 0 ? 'flujo-neto--pos' : 'flujo-neto--neg'}`}>
                    {d.neto >= 0 ? '+' : ''}{formatMoney(d.neto)}
                  </span>
                  <span className="flujo-dia">{dia}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />

      <style>{`
        .din-page { display: flex; flex-direction: column; gap: 16px; }

        .din-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 768px) { .din-stats { grid-template-columns: repeat(2, 1fr); } }

        .din-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .din-tab {
          padding: 8px 18px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 14px; cursor: pointer; transition: all 0.15s;
        }
        .din-tab:hover { color: var(--text-primary); background: var(--bg-card); }
        .din-tab--on { background: rgba(124,106,247,0.15); color: var(--accent-purple); border-color: var(--accent-purple); }

        .din-card {
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px;
        }
        .din-empty { color: var(--text-secondary); font-size: 14px; text-align: center; padding: 30px 0; }

        /* Movimientos */
        .mov-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .mov-item {
          display: flex; align-items: center; gap: 12px;
          background: var(--bg-base); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;
        }
        .mov-icon {
          font-size: 16px; font-weight: 700; width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .mov-icon--up   { background: rgba(74,222,128,0.15);  color: var(--accent-green); }
        .mov-icon--down { background: rgba(248,113,113,0.15); color: var(--accent-red); }
        .mov-info { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .mov-desc { font-size: 14px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mov-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .mov-pill { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 20px; }
        .mov-fecha { font-size: 12px; color: var(--text-secondary); }
        .mov-monto { font-weight: 700; font-size: 15px; flex-shrink: 0; }
        .mov-monto--ing { color: var(--accent-green); }
        .mov-monto--egr { color: var(--accent-red); }

        /* Formulario egreso */
        .egr-form { display: flex; flex-direction: column; gap: 16px; max-width: 480px; }
        .field-label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-secondary); }
        .field-input {
          background: var(--bg-base); border: 1px solid var(--border); border-radius: 8px;
          padding: 9px 12px; color: var(--text-primary); font-size: 14px; outline: none;
        }
        .field-input:focus { border-color: var(--accent-purple); }
        .btn-guardar {
          background: var(--accent-green); color: #0a2010; border: none; border-radius: 8px;
          padding: 11px; font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity 0.15s;
        }
        .btn-guardar:hover:not(:disabled) { opacity: 0.85; }
        .btn-guardar:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Flujo chart */
        .flujo-legend { display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); align-items: center; }
        .leg-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
        .flujo-chart {
          display: flex; align-items: flex-end; justify-content: space-around; gap: 6px;
          height: 220px; padding-bottom: 42px;
        }
        .flujo-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
        .flujo-bars { display: flex; gap: 3px; align-items: flex-end; height: 160px; }
        .flujo-bar { width: 16px; border-radius: 4px 4px 0 0; transition: height 0.3s; }
        .flujo-bar--ing { background: var(--accent-green); }
        .flujo-bar--egr { background: var(--accent-red); }
        .flujo-neto { font-size: 10px; font-weight: 700; }
        .flujo-neto--pos { color: var(--accent-green); }
        .flujo-neto--neg { color: var(--accent-red); }
        .flujo-dia { font-size: 11px; color: var(--text-secondary); text-align: center; }
      `}</style>
    </div>
  );
}

function StatCard({ titulo, valor, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '16px 18px', borderTop: `3px solid ${color}`,
    }}>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {titulo}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color }}>{valor}</p>
    </div>
  );
}
