import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatMoney } from '../../utils/format';

export default function HistorialPilar() {
  const [periodo, setPeriodo]   = useState('hoy');   // 'hoy' | 'semana'
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]   = useState(true);

  async function cargar(p) {
    setLoading(true);
    try {
      const data = await api.get(`/pilados/${p}`);
      setRegistros(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(periodo); }, [periodo]);

  const totalQQ     = registros.reduce((s, r) => s + r.qqEntrada, 0);
  const totalTandas = registros.reduce((s, r) => s + r.tandas, 0);
  const totalCosto  = registros.reduce((s, r) => s + r.costoEstimado, 0);
  const avgRend     = registros.length ? registros.reduce((s, r) => s + r.rendimiento, 0) / registros.length : 0;

  return (
    <div className="hp-wrap">
      {/* Toggle período */}
      <div className="hp-tabs">
        {[{ key: 'hoy', label: 'Hoy' }, { key: 'semana', label: 'Esta semana' }].map(t => (
          <button
            key={t.key}
            className={`hp-tab${periodo === t.key ? ' hp-tab--on' : ''}`}
            onClick={() => setPeriodo(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Resumen */}
      {registros.length > 0 && (
        <div className="hp-resumen">
          <div className="hp-stat"><span>QQ pilados</span><strong>{totalQQ.toFixed(1)}</strong></div>
          <div className="hp-stat"><span>Tandas</span><strong>{totalTandas}</strong></div>
          <div className="hp-stat"><span>Costo total</span><strong>{formatMoney(totalCosto)}</strong></div>
          <div className="hp-stat"><span>Rendimiento prom.</span><strong>{(avgRend * 100).toFixed(1)}%</strong></div>
        </div>
      )}

      {loading && <p className="hp-loading">Cargando...</p>}

      {!loading && registros.length === 0 && (
        <p className="hp-empty">Sin registros para este período.</p>
      )}

      {!loading && registros.length > 0 && (
        <div className="hp-table-wrap">
          <table className="hp-table">
            <thead>
              <tr>
                <th>Operario</th>
                <th>QQ</th>
                <th>Tandas</th>
                <th>Rendimiento</th>
                <th>Velocidad</th>
                <th>Costo</th>
                <th>Horario</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id}>
                  <td className="hp-op">{r.operario.nombre}</td>
                  <td className="num">{r.qqEntrada}</td>
                  <td className="num">{r.tandas}</td>
                  <td className="num" style={{ color: r.rendimiento >= 0.8 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {(r.rendimiento * 100).toFixed(1)}%
                  </td>
                  <td className="num">{r.velocidad.toFixed(1)} qq/h</td>
                  <td className="num cost">{formatMoney(r.costoEstimado)}</td>
                  <td className="hora">{r.horaInicio} – {r.horaFin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .hp-wrap { display: flex; flex-direction: column; gap: 12px; }
        .hp-tabs { display: flex; gap: 6px; }
        .hp-tab {
          padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 13px; cursor: pointer;
          transition: all 0.15s;
        }
        .hp-tab:hover { color: var(--text-primary); background: var(--bg-card); }
        .hp-tab--on { background: rgba(124,106,247,0.15); color: var(--accent-purple); border-color: var(--accent-purple); }

        .hp-resumen { display: flex; gap: 12px; flex-wrap: wrap; }
        .hp-stat {
          flex: 1; min-width: 100px;
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 10px; padding: 12px 14px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .hp-stat span { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
        .hp-stat strong { font-size: 20px; font-weight: 700; color: var(--text-primary); }

        .hp-loading, .hp-empty { color: var(--text-secondary); text-align: center; padding: 20px; font-size: 14px; }
        .hp-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
        .hp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .hp-table th {
          padding: 9px 12px; text-align: left;
          font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
          color: var(--text-secondary); background: var(--bg-card); border-bottom: 1px solid var(--border);
        }
        .hp-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); }
        .hp-table tr:last-child td { border-bottom: none; }
        .hp-table tr:hover td { background: rgba(255,255,255,0.02); }
        .hp-op { font-weight: 600; color: var(--accent-purple); }
        .num { text-align: right; }
        .cost { color: var(--accent-red); }
        .hora { color: var(--text-secondary); font-size: 12px; white-space: nowrap; }
      `}</style>
    </div>
  );
}
