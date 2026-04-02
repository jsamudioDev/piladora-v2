import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { formatMoney, formatQQ } from '../../utils/format';

export default function Panel() {
  const [data,     setData]     = useState(null);
  const [creditos, setCreditos] = useState({ activos: 0, vencidos: 0, totalPendiente: 0 });
  const [error,    setError]    = useState(null);
  const navigate                = useNavigate();

  async function cargar() {
    try {
      // Cargamos el panel y el resumen de créditos en paralelo
      const [d, cred] = await Promise.all([
        api.get('/panel'),
        api.get('/creditos/resumen'),
      ]);
      setData(d);
      setCreditos(cred);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 30000);
    return () => clearInterval(id);
  }, []);

  if (error) return <p style={{ color: 'var(--accent-red)', padding: 20 }}>Error: {error}</p>;
  if (!data)  return <p style={{ color: 'var(--text-secondary)', padding: 20 }}>Cargando...</p>;

  const stockAlertas = data.stockAlertas || [];
  const flujo7       = data.flujo7dias   || [];
  const productos    = data.productos    || [];
  const ultimasVentas = data.ultimasVentas || [];

  const maxFlujo = Math.max(...flujo7.map(d => Math.max(d.ingresos, d.egresos, 1)));
  const top3 = [...productos].sort((a, b) => b.stockActual - a.stockActual).slice(0, 3);

  return (
    <div className="panel-page">
      {/* TOPBAR */}
      <div className="panel-topbar">
        <h2 className="panel-titulo">{data.nombreNegocio || 'Piladora'}</h2>
        <span className="panel-live">
          <span className="live-dot" />EN VIVO
        </span>
      </div>

      {/* ALERTA STOCK BAJO */}
      {stockAlertas.length > 0 && (
        <button className="panel-alerta" onClick={() => navigate('/stock')}>
          ⚠ {stockAlertas.length} producto{stockAlertas.length > 1 ? 's' : ''} con stock bajo — click para ver inventario
        </button>
      )}

      {/* STAT CARDS */}
      <div className="panel-stats">
        <StatCard
          titulo="Ventas Hoy"
          valor={formatMoney(data.ventasHoy?.total || 0)}
          sub={`${data.ventasHoy?.count || 0} venta${data.ventasHoy?.count !== 1 ? 's' : ''}`}
          color="var(--accent-green)"
        />
        <StatCard
          titulo="Ganancia"
          valor={formatMoney(data.gananciaHoy || 0)}
          sub="ingresos − egresos"
          color="var(--accent-blue)"
        />
        <StatCard
          titulo="Pilado Hoy"
          valor={formatQQ(data.piladoHoy || 0)}
          sub="quintales procesados"
          color="var(--accent-purple)"
        />
        <StatCard
          titulo="Egresos Hoy"
          valor={formatMoney(data.egresosHoy || 0)}
          sub="gastos del día"
          color="var(--accent-red)"
        />
      </div>

      {/* GRID: ÚLTIMAS VENTAS + STOCK CLAVE */}
      <div className="panel-grid">
        {/* ÚLTIMAS VENTAS */}
        <div className="panel-card">
          <h3 className="panel-section-title">Últimas Ventas</h3>
          {ultimasVentas.length === 0 ? (
            <p className="panel-empty">Sin ventas registradas hoy</p>
          ) : (
            <table className="uv-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Método</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {ultimasVentas.map(v => (
                  <tr key={v.id}>
                    <td className="uv-hora">
                      {new Date(v.createdAt).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{v.cliente || '—'}</td>
                    <td>
                      <span className="uv-metodo">{v.metodoPago}</span>
                    </td>
                    <td className="uv-total">{formatMoney(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* STOCK CLAVE */}
        <div className="panel-card">
          <h3 className="panel-section-title">Stock Clave</h3>
          {top3.length === 0 ? (
            <p className="panel-empty">Sin productos registrados</p>
          ) : (
            <div className="sk-list">
              {top3.map(p => {
                const ref   = p.stockMinimo > 0 ? p.stockMinimo * 3 : p.stockActual || 1;
                const pct   = Math.min((p.stockActual / ref) * 100, 100);
                const bajo  = p.stockActual <= p.stockMinimo;
                const medio = !bajo && p.stockActual <= p.stockMinimo * 1.5;
                const color = bajo ? 'var(--accent-red)' : medio ? '#f59e0b' : 'var(--accent-green)';
                return (
                  <div key={p.id} className="sk-item">
                    <div className="sk-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="sk-dot" style={{ background: color }} />
                        <span className="sk-nombre">{p.nombre}</span>
                      </div>
                      <span className="sk-qty" style={{ color }}>{p.stockActual} {p.unidad}</span>
                    </div>
                    <div className="sk-bar-bg">
                      <div className="sk-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="sk-min">Mínimo: {p.stockMinimo} {p.unidad}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FLUJO 7 DÍAS */}
      <div className="panel-card">
        <h3 className="panel-section-title">Flujo 7 días</h3>
        <div className="flujo-legend">
          <span><span className="leg-dot" style={{ background: 'var(--accent-green)' }} />Ingresos</span>
          <span><span className="leg-dot" style={{ background: 'var(--accent-red)' }} />Egresos</span>
        </div>
        <div className="flujo-chart">
          {flujo7.map(d => {
            const ingH = Math.max((d.ingresos / maxFlujo) * 140, d.ingresos > 0 ? 4 : 0);
            const egrH = Math.max((d.egresos / maxFlujo) * 140, d.egresos > 0 ? 4 : 0);
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

      <style>{`
        .panel-page { display: flex; flex-direction: column; gap: 16px; }

        /* Topbar */
        .panel-topbar { display: flex; align-items: center; justify-content: space-between; }
        .panel-titulo  { font-size: 22px; font-weight: 700; }
        .panel-live {
          display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
          color: var(--accent-green); background: rgba(74,222,128,0.1);
          border: 1px solid rgba(74,222,128,0.3); padding: 5px 12px; border-radius: 20px; letter-spacing: 0.5px;
        }
        .live-dot {
          width: 8px; height: 8px; border-radius: 50%; background: var(--accent-green);
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.8); }
        }

        /* Alerta stock */
        .panel-alerta {
          background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.4);
          color: var(--accent-red); border-radius: 10px; padding: 12px 16px;
          font-size: 14px; font-weight: 600; cursor: pointer; text-align: left;
          width: 100%; transition: background 0.15s;
        }
        .panel-alerta:hover { background: rgba(248,113,113,0.18); }

        /* Stats */
        .panel-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 768px) { .panel-stats { grid-template-columns: repeat(2, 1fr); } }

        /* Grid 2 cols */
        .panel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 900px) { .panel-grid { grid-template-columns: 1fr; } }

        .panel-card {
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px;
        }
        .panel-section-title {
          font-size: 13px; font-weight: 600; color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px;
        }
        .panel-empty { color: var(--text-secondary); font-size: 14px; text-align: center; padding: 20px 0; }

        /* Últimas ventas */
        .uv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .uv-table th {
          color: var(--text-secondary); font-weight: 600; padding: 6px 8px;
          text-align: left; border-bottom: 1px solid var(--border);
          font-size: 11px; text-transform: uppercase;
        }
        .uv-table td { padding: 9px 8px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
        .uv-table tr:last-child td { border-bottom: none; }
        .uv-hora   { color: var(--text-secondary); }
        .uv-metodo {
          font-size: 11px; background: rgba(96,165,250,0.12); color: var(--accent-blue);
          border: 1px solid rgba(96,165,250,0.25); padding: 2px 8px; border-radius: 20px; font-weight: 600;
        }
        .uv-total { font-weight: 700; color: var(--accent-green); text-align: right; }

        /* Stock clave */
        .sk-list  { display: flex; flex-direction: column; gap: 14px; }
        .sk-item  { display: flex; flex-direction: column; gap: 6px; }
        .sk-top   { display: flex; justify-content: space-between; align-items: center; }
        .sk-dot   { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .sk-nombre{ font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .sk-qty   { font-size: 13px; font-weight: 700; }
        .sk-bar-bg{ height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
        .sk-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
        .sk-min   { font-size: 11px; color: var(--text-secondary); }

        /* Flujo chart */
        .flujo-legend { display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); align-items: center; }
        .leg-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
        .flujo-chart { display: flex; align-items: flex-end; justify-content: space-around; gap: 6px; height: 200px; padding-bottom: 38px; }
        .flujo-col  { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
        .flujo-bars { display: flex; gap: 3px; align-items: flex-end; height: 140px; }
        .flujo-bar  { width: 14px; border-radius: 4px 4px 0 0; transition: height 0.3s; }
        .flujo-bar--ing { background: var(--accent-green); }
        .flujo-bar--egr { background: var(--accent-red); }
        .flujo-neto { font-size: 10px; font-weight: 700; }
        .flujo-neto--pos { color: var(--accent-green); }
        .flujo-neto--neg { color: var(--accent-red); }
        .flujo-dia  { font-size: 10px; color: var(--text-secondary); text-align: center; }
      `}</style>
    </div>
  );
}

function StatCard({ titulo, valor, sub, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '16px 18px', borderTop: `3px solid ${color}`,
    }}>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {titulo}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color, marginBottom: 4 }}>{valor}</p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</p>
    </div>
  );
}
