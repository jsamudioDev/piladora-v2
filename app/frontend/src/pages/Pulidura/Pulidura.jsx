// ─── Módulo: Proceso de Pulidura ─────────────────────────────────────────────
// Registra el secado de pulidura húmeda → pulidura seca.
// Acceso: ADMIN y OPERARIO
import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast, ToastContainer } from '../../components/Toast';

const FORM_INICIAL = {
  operarioId:   '',
  sacosHumedos: '',
  sacosSecs:    '',
  nota:         '',
};

// Peso por defecto mientras carga desde BD
const PESO_HUMEDO_DEF = 63;
const PESO_SECO_DEF   = 50;

// Color del rendimiento: verde >70%, amarillo 50-70%, rojo <50%
function colorRendimiento(pct) {
  if (pct <= 0)  return 'var(--text-secondary)';
  if (pct >= 70) return 'var(--accent-green)';
  if (pct >= 50) return '#facc15';
  return 'var(--accent-red)';
}

// Formato de fecha legible
function fmtFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });
}

export default function Pulidura() {
  const { esAdmin }        = useAuth();
  const [vista, setVista]  = useState('form'); // 'form' | 'historial' | 'stats'

  const [operarios, setOperarios] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [stats, setStats]         = useState([]);
  const [pesos, setPesos]         = useState({ humedo: PESO_HUMEDO_DEF, seco: PESO_SECO_DEF });
  const [form, setForm]           = useState(FORM_INICIAL);
  const [enviando, setEnviando]   = useState(false);
  const { toasts, show }          = useToast();

  // ─── Carga inicial de datos ──────────────────────────────────────────────
  useEffect(() => {
    const peticiones = [
      api.get('/config/operarios'),
      api.get('/config/parametros'),
      api.get('/pulidura'),
    ];
    if (esAdmin) peticiones.push(api.get('/pulidura/stats'));

    Promise.all(peticiones)
      .then(([ops, params, hist, statsData]) => {
        setOperarios(ops.filter(o => o.activo));

        // Leer pesos desde parámetros de BD
        const mapP = {};
        params.forEach(p => { mapP[p.clave] = parseFloat(p.valor); });
        setPesos({
          humedo: mapP.peso_saco_humedo || PESO_HUMEDO_DEF,
          seco:   mapP.peso_saco_seco   || PESO_SECO_DEF,
        });

        setRegistros(hist);
        if (esAdmin && statsData) setStats(statsData);
      })
      .catch(e => show(e.message, 'error'));
  }, [esAdmin]);

  function set(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  // ─── Preview en tiempo real (sin fetch) ─────────────────────────────────
  const preview = useMemo(() => {
    const sh = Number(form.sacosHumedos) || 0;
    const ss = Number(form.sacosSecs)    || 0;

    const lbsHumedas   = parseFloat((sh * pesos.humedo).toFixed(1));
    const lbsSecas     = parseFloat((ss * pesos.seco).toFixed(1));
    const rendimiento  = lbsHumedas > 0
      ? parseFloat(((lbsSecas / lbsHumedas) * 100).toFixed(1))
      : 0;

    return { sh, ss, lbsHumedas, lbsSecas, rendimiento };
  }, [form.sacosHumedos, form.sacosSecs, pesos]);

  // ─── Enviar formulario ────────────────────────────────────────────────────
  async function registrar(e) {
    e.preventDefault();
    if (!form.operarioId)       { show('Selecciona un operario', 'error');     return; }
    if (preview.sh <= 0)        { show('Ingresa sacos húmedos', 'error');      return; }
    if (preview.ss < 0)         { show('Sacos secos no puede ser negativo', 'error'); return; }

    setEnviando(true);
    try {
      await api.post('/pulidura', {
        operarioId:  Number(form.operarioId),
        sacosHumedos: preview.sh,
        sacosSecs:    preview.ss,
        nota:         form.nota || null,
      });

      setForm(FORM_INICIAL);

      // Refrescar historial y stats
      const [hist, statsData] = await Promise.all([
        api.get('/pulidura'),
        esAdmin ? api.get('/pulidura/stats') : Promise.resolve(stats),
      ]);
      setRegistros(hist);
      if (esAdmin) setStats(statsData);

      show(`Secado registrado — Rendimiento: ${preview.rendimiento}%`, 'success');
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  // ─── Tabs disponibles ─────────────────────────────────────────────────────
  const TABS = [
    ['form',      'Registrar Secado'],
    ['historial', 'Historial'],
    ...(esAdmin ? [['stats', 'Estadísticas']] : []),
  ];

  return (
    <div className="pul-page">
      {/* Tabs de navegación */}
      <div className="pul-tabs">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            className={`ptab${vista === k ? ' ptab--on' : ''}`}
            onClick={() => setVista(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── VISTA 1: Formulario de registro ───────────────────────────────── */}
      {vista === 'form' && (
        <div className="pul-layout">
          <form className="pul-form" onSubmit={registrar}>
            <h2 className="pul-form-title">Registrar Secado de Pulidura</h2>

            {/* Selector de operario */}
            <label className="pl-label">
              Operario
              <select
                className="pl-input"
                value={form.operarioId}
                onChange={e => set('operarioId', e.target.value)}
                required
              >
                <option value="">— Seleccionar —</option>
                {operarios.map(o => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </label>

            {/* Sacos húmedos y secos */}
            <div className="pl-row">
              <label className="pl-label">
                Sacos húmedos entrada
                <input
                  className="pl-input"
                  type="number" min="1" step="1"
                  placeholder={`~${pesos.humedo} lbs/saco`}
                  value={form.sacosHumedos}
                  onChange={e => set('sacosHumedos', e.target.value)}
                  required
                />
              </label>
              <label className="pl-label">
                Sacos secos obtenidos
                <input
                  className="pl-input"
                  type="number" min="0" step="1"
                  placeholder={`~${pesos.seco} lbs/saco`}
                  value={form.sacosSecs}
                  onChange={e => set('sacosSecs', e.target.value)}
                  required
                />
              </label>
            </div>

            {/* Nota */}
            <label className="pl-label">
              Observaciones (opcional)
              <textarea
                className="pl-input pl-textarea"
                value={form.nota}
                onChange={e => set('nota', e.target.value)}
                placeholder="Condiciones del secado, incidencias..."
                rows={3}
              />
            </label>

            <button className="btn-registrar" type="submit" disabled={enviando}>
              {enviando ? 'Registrando...' : 'Registrar Secado'}
            </button>
          </form>

          {/* Preview en tiempo real */}
          <div className="preview-panel">
            <h3 className="prev-title">Preview en Tiempo Real</h3>

            <div className="prev-stat">
              <span>Libras húmedas</span>
              <strong>
                {preview.lbsHumedas > 0 ? `${preview.lbsHumedas} lbs` : '—'}
              </strong>
            </div>
            <div className="prev-stat">
              <span>Libras secas</span>
              <strong>
                {preview.lbsSecas > 0 ? `${preview.lbsSecas} lbs` : '—'}
              </strong>
            </div>
            <div className="prev-stat">
              <span>Rendimiento</span>
              <strong style={{ color: colorRendimiento(preview.rendimiento) }}>
                {preview.rendimiento > 0 ? `${preview.rendimiento}%` : '—'}
              </strong>
            </div>

            {/* Barra de progreso del rendimiento */}
            {preview.rendimiento > 0 && (
              <div className="prev-bar-wrap">
                <div className="prev-bar-label">
                  <span>Rendimiento</span>
                  <span style={{ color: colorRendimiento(preview.rendimiento) }}>
                    {preview.rendimiento}%
                  </span>
                </div>
                <div className="prev-bar-bg">
                  <div
                    className="prev-bar-fill"
                    style={{
                      width:      `${Math.min(preview.rendimiento, 100)}%`,
                      background: colorRendimiento(preview.rendimiento),
                    }}
                  />
                </div>
                {/* Referencia visual de umbrales */}
                <div className="prev-bar-refs">
                  <span>0%</span>
                  <span style={{ color: '#facc15' }}>50%</span>
                  <span style={{ color: 'var(--accent-green)' }}>70%</span>
                  <span>100%</span>
                </div>
              </div>
            )}

            {/* Nota sobre los pesos configurados */}
            <p className="prev-nota">
              Pesos: {pesos.humedo} lbs/saco húmedo · {pesos.seco} lbs/saco seco
            </p>
          </div>
        </div>
      )}

      {/* ── VISTA 2: Historial ────────────────────────────────────────────── */}
      {vista === 'historial' && (
        <div className="pul-historial">
          <h3 className="pul-section-title">Historial de Secados</h3>
          {registros.length === 0 ? (
            <p className="pul-empty">Sin registros aún</p>
          ) : (
            <div className="pul-table-wrap">
              <table className="pul-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Operario</th>
                    <th>Sacos Húm.</th>
                    <th>Sacos Secos</th>
                    <th>Lbs Húmedas</th>
                    <th>Lbs Secas</th>
                    <th>Rendimiento</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map(r => (
                    <tr key={r.id} className="pul-row">
                      <td className="muted">{fmtFecha(r.createdAt)}</td>
                      <td className="nombre">{r.operario?.nombre || '—'}</td>
                      <td className="num">{r.sacosHumedos}</td>
                      <td className="num">{r.sacosSecs}</td>
                      <td className="num">{r.lbsHumedas}</td>
                      <td className="num">{r.lbsSecas}</td>
                      <td className="num">
                        <span
                          className="rend-badge"
                          style={{
                            color:       colorRendimiento(r.rendimiento),
                            background:  colorRendimiento(r.rendimiento) + '22',
                          }}
                        >
                          {r.rendimiento.toFixed(1)}%
                        </span>
                      </td>
                      <td className="muted nota-cell">{r.nota || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VISTA 3: Estadísticas (solo ADMIN) ──────────────────────────── */}
      {vista === 'stats' && esAdmin && (
        <div className="pul-stats">
          <h3 className="pul-section-title">Estadísticas por Operario</h3>

          {/* Cards resumen */}
          <div className="stats-cards">
            <div className="stats-card">
              <span className="sc-label">Total operaciones</span>
              <span className="sc-value">
                {stats.reduce((a, s) => a + s.totalOperaciones, 0)}
              </span>
            </div>
            <div className="stats-card">
              <span className="sc-label">Rendimiento promedio general</span>
              <span
                className="sc-value"
                style={{
                  color: colorRendimiento(
                    stats.length
                      ? stats.reduce((a, s) => a + s.rendimientoPromedio, 0) / stats.length
                      : 0
                  ),
                }}
              >
                {stats.length
                  ? (stats.reduce((a, s) => a + s.rendimientoPromedio, 0) / stats.length).toFixed(1)
                  : 0}%
              </span>
            </div>
            <div className="stats-card">
              <span className="sc-label">Total sacos secos producidos</span>
              <span className="sc-value">
                {stats.reduce((a, s) => a + s.totalSacosSecs, 0)} sacos
              </span>
            </div>
          </div>

          {/* Tabla por operario */}
          {stats.length === 0 ? (
            <p className="pul-empty">Sin datos aún</p>
          ) : (
            <div className="pul-table-wrap">
              <table className="pul-table">
                <thead>
                  <tr>
                    <th>Operario</th>
                    <th>Operaciones</th>
                    <th>Total Sacos Húm.</th>
                    <th>Total Sacos Secos</th>
                    <th>Rendimiento Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(s => (
                    <tr key={s.operarioId} className="pul-row">
                      <td className="nombre">{s.operarioNombre}</td>
                      <td className="num">{s.totalOperaciones}</td>
                      <td className="num">{s.totalSacosHumedos}</td>
                      <td className="num">{s.totalSacosSecs}</td>
                      <td className="num">
                        <span
                          className="rend-badge"
                          style={{
                            color:      colorRendimiento(s.rendimientoPromedio),
                            background: colorRendimiento(s.rendimientoPromedio) + '22',
                          }}
                        >
                          {s.rendimientoPromedio.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ToastContainer toasts={toasts} />

      <style>{`
        .pul-page { display: flex; flex-direction: column; gap: 16px; }

        /* Tabs */
        .pul-tabs { display: flex; gap: 6px; }
        .ptab {
          padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 14px; cursor: pointer;
          transition: all 0.15s;
        }
        .ptab:hover { color: var(--text-primary); background: var(--bg-card); }
        .ptab--on {
          background: rgba(124,106,247,0.15); color: var(--accent-purple);
          border-color: var(--accent-purple);
        }

        /* Layout form + preview */
        .pul-layout {
          display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start;
        }

        /* Formulario */
        .pul-form {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; padding: 22px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .pul-form-title {
          font-size: 16px; font-weight: 700; color: var(--text-primary);
          margin-bottom: 4px;
        }
        .pl-label {
          display: flex; flex-direction: column; gap: 6px;
          font-size: 13px; color: var(--text-secondary);
        }
        .pl-input {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
          font-family: inherit;
        }
        .pl-input:focus { border-color: var(--accent-purple); }
        .pl-textarea { resize: vertical; min-height: 72px; }
        .pl-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .btn-registrar {
          background: var(--accent-purple); color: #fff; border: none;
          border-radius: 8px; padding: 11px; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: opacity 0.15s; margin-top: 4px;
        }
        .btn-registrar:hover:not(:disabled) { opacity: 0.85; }
        .btn-registrar:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Preview panel */
        .preview-panel {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; padding: 22px;
          display: flex; flex-direction: column; gap: 14px;
          position: sticky; top: 16px;
        }
        .prev-title {
          font-size: 12px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.5px; color: var(--text-secondary);
        }
        .prev-stat {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 0; border-bottom: 1px solid var(--border);
        }
        .prev-stat:last-of-type { border-bottom: none; }
        .prev-stat span { font-size: 13px; color: var(--text-secondary); }
        .prev-stat strong { font-size: 18px; font-weight: 700; }

        .prev-bar-wrap { display: flex; flex-direction: column; gap: 6px; }
        .prev-bar-label {
          display: flex; justify-content: space-between;
          font-size: 12px; color: var(--text-secondary);
        }
        .prev-bar-bg { height: 8px; background: var(--bg-base); border-radius: 4px; overflow: hidden; }
        .prev-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s ease; }
        .prev-bar-refs {
          display: flex; justify-content: space-between;
          font-size: 10px; color: var(--text-secondary);
        }
        .prev-nota {
          font-size: 11px; color: var(--text-secondary);
          border-top: 1px solid var(--border); padding-top: 8px;
        }

        /* Secciones de historial y stats */
        .pul-section-title {
          font-size: 14px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.5px; color: var(--text-secondary); margin-bottom: 12px;
        }
        .pul-empty { color: var(--text-secondary); text-align: center; padding: 40px; }

        /* Tabla */
        .pul-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
        .pul-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .pul-table th {
          padding: 10px 14px; text-align: left;
          font-size: 12px; font-weight: 600; text-transform: uppercase;
          color: var(--text-secondary); background: var(--bg-card);
          border-bottom: 1px solid var(--border);
        }
        .pul-row td { padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .pul-row:last-child td { border-bottom: none; }
        .pul-row:hover td { background: rgba(255,255,255,0.02); }
        .nombre { font-weight: 500; color: var(--text-primary); }
        .num { font-weight: 600; text-align: right; }
        .muted { color: var(--text-secondary); font-size: 13px; }
        .nota-cell { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Badge de rendimiento */
        .rend-badge {
          padding: 2px 8px; border-radius: 6px; font-size: 13px; font-weight: 700;
        }

        /* Cards de estadísticas */
        .stats-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .stats-card {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 12px; padding: 16px 20px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .sc-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.4px; }
        .sc-value { font-size: 26px; font-weight: 700; color: var(--text-primary); }

        @media (max-width: 900px) {
          .pul-layout { grid-template-columns: 1fr; }
          .pl-row { grid-template-columns: 1fr; }
          .preview-panel { position: static; }
          .stats-cards { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 600px) {
          .stats-cards { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
