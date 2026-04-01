import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { formatMoney } from '../../utils/format';
import { useToast, ToastContainer } from '../../components/Toast';
import HistorialPilar from './HistorialPilar';
import StatsComparativa from './StatsComparativa';

const FORM_INICIAL = {
  operarioId: '', qqEntrada: '', tandas: '',
  sacosPilado: '', sacosSubproducto: '',
  horaInicio: '', horaFin: '', nota: '',
};

function calcHoras(inicio, fin) {
  if (!inicio || !fin) return 0;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  const diff = h2 * 60 + m2 - (h1 * 60 + m1);
  return diff > 0 ? parseFloat((diff / 60).toFixed(2)) : 0;
}

export default function Pilar() {
  const [vista, setVista]         = useState('form');  // 'form' | 'historial' | 'stats'
  const [operarios, setOperarios] = useState([]);
  const [maizStock, setMaizStock] = useState(null);
  const [params, setParams]       = useState({});
  const [form, setForm]           = useState(FORM_INICIAL);
  const [enviando, setEnviando]   = useState(false);
  const [stats, setStats]         = useState([]);
  const { toasts, show }          = useToast();

  useEffect(() => {
    Promise.all([
      api.get('/config/operarios'),
      api.get('/stock'),
      api.get('/config/parametros'),
      api.get('/pilados/stats'),
    ]).then(([ops, productos, rawParams, statsData]) => {
      setOperarios(ops.filter(o => o.activo));
      const grano = productos.find(p => p.nombre?.includes('Maíz Grano'));
      setMaizStock(grano ?? null);
      const map = {};
      rawParams.forEach(p => { map[p.clave] = parseFloat(p.valor); });
      setParams(map);
      setStats(statsData);
    }).catch(e => show(e.message, 'error'));
  }, []);

  function set(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  // Preview calculado en tiempo real
  const preview = useMemo(() => {
    const qq    = Number(form.qqEntrada)    || 0;
    const sacos = Number(form.sacosPilado)  || 0;
    const tandas = Number(form.tandas)      || 0;
    const horas = calcHoras(form.horaInicio, form.horaFin);

    const rendimiento   = qq && sacos ? parseFloat(((sacos * 25) / (qq * 100)).toFixed(4)) : 0;
    const velocidad     = qq && horas ? parseFloat((qq / horas).toFixed(2)) : 0;
    const costo         = tandas ? parseFloat((tandas * (params.pago_por_tanda || 15)).toFixed(2)) : 0;

    return { rendimiento, velocidad, costo, horas };
  }, [form, params]);

  async function registrar(e) {
    e.preventDefault();

    // Validaciones frontend
    if (!form.operarioId)  { show('Selecciona un operario', 'error'); return; }
    if (!form.horaInicio || !form.horaFin) { show('Completa hora inicio y fin', 'error'); return; }
    if (preview.horas <= 0) { show('horaFin debe ser posterior a horaInicio', 'error'); return; }
    if (maizStock && Number(form.qqEntrada) > maizStock.stockActual) {
      show(`Stock insuficiente de Maíz Grano. Disponible: ${maizStock.stockActual} sacos`, 'error'); return;
    }

    setEnviando(true);
    try {
      await api.post('/pilados', {
        operarioId:      Number(form.operarioId),
        qqEntrada:       Number(form.qqEntrada),
        tandas:          Number(form.tandas),
        sacosPilado:     Number(form.sacosPilado),
        sacosSubproducto: Number(form.sacosSubproducto),
        horaInicio:      form.horaInicio,
        horaFin:         form.horaFin,
        nota:            form.nota || null,
      });
      setForm(FORM_INICIAL);

      // Refrescar stats y stock
      const [grano, stockData, statsData] = await Promise.all([
        api.get('/stock'),
        api.get('/stock'),
        api.get('/pilados/stats'),
      ]);
      const g = stockData.find(p => p.nombre?.includes('Maíz Grano'));
      setMaizStock(g ?? null);
      setStats(statsData);

      show(`Pilado registrado — Rendimiento: ${(preview.rendimiento * 100).toFixed(1)}%`, 'success');
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setEnviando(false);
    }
  }

  // Color del stock de maíz
  const maizColor = maizStock
    ? maizStock.stockActual <= maizStock.stockMinimo
      ? 'var(--accent-red)'
      : maizStock.stockActual <= maizStock.stockMinimo * 1.5
        ? '#facc15'
        : 'var(--accent-green)'
    : 'var(--text-secondary)';

  return (
    <div className="pilar-page">
      {/* Tabs */}
      <div className="pilar-tabs">
        {[['form','Registrar Pilado'], ['historial','Historial'], ['stats','Estadísticas']].map(([k, l]) => (
          <button key={k} className={`ptab${vista === k ? ' ptab--on' : ''}`} onClick={() => setVista(k)}>{l}</button>
        ))}
      </div>

      {/* Stock Maíz Grano — siempre visible */}
      {maizStock && (
        <div className="maiz-card" style={{ borderColor: maizColor }}>
          <span className="maiz-label">Maíz Grano en Piladora</span>
          <span className="maiz-stock" style={{ color: maizColor }}>
            {maizStock.stockActual} sacos
          </span>
          {maizStock.stockActual <= maizStock.stockMinimo && (
            <span className="maiz-alerta">⚠ Stock bajo del mínimo ({maizStock.stockMinimo})</span>
          )}
        </div>
      )}

      {/* Vista: Formulario */}
      {vista === 'form' && (
        <div className="pilar-layout">
          <form className="pilar-form" onSubmit={registrar}>
            <label className="pl-label">
              Operario
              <select className="pl-input" value={form.operarioId} onChange={e => set('operarioId', e.target.value)} required>
                <option value="">— Seleccionar —</option>
                {operarios.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </label>

            <div className="pl-row">
              <label className="pl-label">
                QQ entrada
                <input className="pl-input" type="number" min="1" step="0.5"
                  value={form.qqEntrada} onChange={e => set('qqEntrada', e.target.value)} required />
              </label>
              <label className="pl-label">
                Tandas
                <input className="pl-input" type="number" min="1" step="1"
                  value={form.tandas} onChange={e => set('tandas', e.target.value)} required />
              </label>
            </div>

            <div className="pl-row">
              <label className="pl-label">
                Sacos pilado (25lb)
                <input className="pl-input" type="number" min="0" step="1"
                  value={form.sacosPilado} onChange={e => set('sacosPilado', e.target.value)} required />
              </label>
              <label className="pl-label">
                Sacos subproducto (50lb)
                <input className="pl-input" type="number" min="0" step="1"
                  value={form.sacosSubproducto} onChange={e => set('sacosSubproducto', e.target.value)} />
              </label>
            </div>

            <div className="pl-row">
              <label className="pl-label">
                Hora inicio
                <input className="pl-input" type="time" value={form.horaInicio} onChange={e => set('horaInicio', e.target.value)} required />
              </label>
              <label className="pl-label">
                Hora fin
                <input className="pl-input" type="time" value={form.horaFin} onChange={e => set('horaFin', e.target.value)} required />
              </label>
            </div>

            <label className="pl-label">
              Nota (opcional)
              <input className="pl-input" value={form.nota} onChange={e => set('nota', e.target.value)} placeholder="Observaciones..." />
            </label>

            <button className="btn-registrar" type="submit" disabled={enviando}>
              {enviando ? 'Registrando...' : 'Registrar Pilado'}
            </button>
          </form>

          {/* Preview en tiempo real */}
          <div className="preview-panel">
            <h3 className="prev-title">Preview</h3>

            <div className="prev-stat">
              <span>Horas trabajadas</span>
              <strong>{preview.horas > 0 ? `${preview.horas} h` : '—'}</strong>
            </div>
            <div className="prev-stat">
              <span>Rendimiento</span>
              <strong style={{ color: preview.rendimiento >= 0.8 ? 'var(--accent-green)' : preview.rendimiento > 0 ? '#facc15' : 'var(--text-secondary)' }}>
                {preview.rendimiento > 0 ? `${(preview.rendimiento * 100).toFixed(1)}%` : '—'}
              </strong>
            </div>
            <div className="prev-stat">
              <span>Velocidad</span>
              <strong>{preview.velocidad > 0 ? `${preview.velocidad} qq/h` : '—'}</strong>
            </div>
            <div className="prev-stat">
              <span>Costo estimado</span>
              <strong style={{ color: 'var(--accent-red)' }}>
                {preview.costo > 0 ? formatMoney(preview.costo) : '—'}
              </strong>
            </div>

            {preview.rendimiento > 0 && (
              <div className="prev-bar-wrap">
                <div className="prev-bar-label">
                  <span>Rendimiento</span>
                  <span>{(preview.rendimiento * 100).toFixed(1)}%</span>
                </div>
                <div className="prev-bar-bg">
                  <div
                    className="prev-bar-fill"
                    style={{
                      width: `${Math.min(preview.rendimiento * 100, 100)}%`,
                      background: preview.rendimiento >= 0.8 ? 'var(--accent-green)' : '#facc15',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {vista === 'historial' && <HistorialPilar />}

      {vista === 'stats' && (
        <div>
          <h3 className="stats-title">Comparativa por operario</h3>
          <StatsComparativa stats={stats} />
        </div>
      )}

      <ToastContainer toasts={toasts} />

      <style>{`
        .pilar-page { display: flex; flex-direction: column; gap: 16px; }

        .pilar-tabs { display: flex; gap: 6px; }
        .ptab {
          padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 14px; cursor: pointer;
          transition: all 0.15s;
        }
        .ptab:hover { color: var(--text-primary); background: var(--bg-card); }
        .ptab--on { background: rgba(124,106,247,0.15); color: var(--accent-purple); border-color: var(--accent-purple); }

        /* Card maíz grano */
        .maiz-card {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          background: var(--bg-card); border: 1px solid; border-radius: 12px;
          padding: 14px 18px;
        }
        .maiz-label { font-size: 14px; color: var(--text-secondary); flex: 1; }
        .maiz-stock { font-size: 22px; font-weight: 700; }
        .maiz-alerta { font-size: 12px; font-weight: 600; }

        /* Layout form + preview */
        .pilar-layout { display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }

        /* Formulario */
        .pilar-form {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; padding: 22px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .pl-label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-secondary); }
        .pl-input {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .pl-input:focus { border-color: var(--accent-purple); }
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
        .prev-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
        .prev-stat {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 0; border-bottom: 1px solid var(--border);
        }
        .prev-stat:last-of-type { border-bottom: none; }
        .prev-stat span { font-size: 13px; color: var(--text-secondary); }
        .prev-stat strong { font-size: 18px; font-weight: 700; }

        .prev-bar-wrap { display: flex; flex-direction: column; gap: 6px; }
        .prev-bar-label { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); }
        .prev-bar-bg { height: 8px; background: var(--bg-base); border-radius: 4px; overflow: hidden; }
        .prev-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s ease; }

        .stats-title { font-size: 15px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }

        @media (max-width: 900px) {
          .pilar-layout { grid-template-columns: 1fr; }
          .pl-row { grid-template-columns: 1fr; }
          .preview-panel { position: static; }
        }
      `}</style>
    </div>
  );
}
