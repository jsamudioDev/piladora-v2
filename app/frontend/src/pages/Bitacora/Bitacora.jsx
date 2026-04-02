import { useState, useEffect } from 'react';
import api from '../../utils/api';

// Módulos disponibles para el filtro
const MODULOS = ['panel','venta','pilar','stock','dinero','creditos','config','auth','pulidura','devoluciones','traspasos'];
// Acciones disponibles para el filtro
const ACCIONES = ['login','crear','editar','editar-perfil','eliminar','registrar','devolucion','traspaso','abonar','egreso','movimiento'];

// Colores de badge por módulo
const MOD_COLOR = {
  auth:         { bg: 'rgba(248,113,113,0.15)',  color: '#f87171' },
  venta:        { bg: 'rgba(74,222,128,0.15)',   color: '#4ade80' },
  stock:        { bg: 'rgba(96,165,250,0.15)',   color: '#60a5fa' },
  dinero:       { bg: 'rgba(251,191,36,0.15)',   color: '#fbbf24' },
  creditos:     { bg: 'rgba(251,191,36,0.15)',   color: '#fbbf24' },
  pilar:        { bg: 'rgba(167,139,250,0.15)',  color: '#a78bfa' },
  pulidura:     { bg: 'rgba(167,139,250,0.15)',  color: '#a78bfa' },
  config:       { bg: 'rgba(148,163,184,0.15)',  color: '#94a3b8' },
  panel:        { bg: 'rgba(148,163,184,0.15)',  color: '#94a3b8' },
  devoluciones: { bg: 'rgba(248,113,113,0.15)',  color: '#f87171' },
  traspasos:    { bg: 'rgba(96,165,250,0.15)',   color: '#60a5fa' },
};

function badgeStyle(modulo) {
  return MOD_COLOR[modulo] || { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' };
}

// Formatea una fecha ISO a dd/mm/yyyy hh:mm
function fmtFecha(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Intenta parsear el detalle JSON y lo muestra como clave: valor
function DetalleCell({ detalle }) {
  try {
    const obj = typeof detalle === 'string' ? JSON.parse(detalle) : detalle;
    if (typeof obj !== 'object' || obj === null) return <span className="bit-detalle-raw">{detalle}</span>;
    return (
      <span className="bit-detalle-obj">
        {Object.entries(obj).map(([k, v]) => (
          <span key={k} className="bit-kv"><span className="bit-key">{k}:</span> {String(v)}</span>
        ))}
      </span>
    );
  } catch {
    return <span className="bit-detalle-raw">{detalle}</span>;
  }
}

export default function Bitacora() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]     = useState(false);

  // Filtros
  const [fModulo,  setFModulo]  = useState('');
  const [fAccion,  setFAccion]  = useState('');
  const [fDesde,   setFDesde]   = useState('');
  const [fHasta,   setFHasta]   = useState('');

  async function buscar() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limite: 200 });
      if (fModulo) params.set('modulo', fModulo);
      if (fAccion) params.set('accion', fAccion);
      if (fDesde)  params.set('fechaDesde', fDesde);
      if (fHasta)  params.set('fechaHasta', fHasta);

      const data = await api.get(`/bitacora?${params.toString()}`);
      setRegistros(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function limpiar() {
    setFModulo(''); setFAccion(''); setFDesde(''); setFHasta('');
    // Recargar sin filtros
    setLoading(true);
    api.get('/bitacora?limite=200')
      .then(data => setRegistros(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { buscar(); }, []);

  return (
    <div className="bit-page">
      <h2 className="bit-title">Bitácora de Auditoría</h2>

      {/* Barra de filtros */}
      <div className="bit-filters">
        <select className="bit-select" value={fModulo} onChange={e => setFModulo(e.target.value)}>
          <option value="">Todos los módulos</option>
          {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select className="bit-select" value={fAccion} onChange={e => setFAccion(e.target.value)}>
          <option value="">Todas las acciones</option>
          {ACCIONES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <input
          className="bit-date"
          type="date"
          value={fDesde}
          onChange={e => setFDesde(e.target.value)}
          title="Desde"
        />
        <input
          className="bit-date"
          type="date"
          value={fHasta}
          onChange={e => setFHasta(e.target.value)}
          title="Hasta"
        />

        <button className="bit-btn-buscar" onClick={buscar} disabled={loading}>
          {loading ? '...' : 'Buscar'}
        </button>
        <button className="bit-btn-limpiar" onClick={limpiar}>
          Limpiar
        </button>
      </div>

      {/* Contador */}
      <p className="bit-count">{registros.length} registros</p>

      {/* Tabla */}
      {loading ? (
        <p className="bit-empty">Cargando...</p>
      ) : registros.length === 0 ? (
        <p className="bit-empty">Sin registros para los filtros seleccionados.</p>
      ) : (
        <div className="bit-table-wrap">
          <table className="bit-table">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Usuario</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Detalle</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => {
                const bs = badgeStyle(r.modulo);
                return (
                  <tr key={r.id} className="bit-row">
                    <td className="bit-fecha">{fmtFecha(r.createdAt)}</td>
                    <td className="bit-usuario">{r.nombre || <span className="bit-null">—</span>}</td>
                    <td>
                      <span className="bit-badge" style={{ background: bs.bg, color: bs.color }}>
                        {r.modulo}
                      </span>
                    </td>
                    <td className="bit-accion">{r.accion}</td>
                    <td><DetalleCell detalle={r.detalle} /></td>
                    <td className="bit-ip">{r.ip || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .bit-page { display: flex; flex-direction: column; gap: 16px; }
        .bit-title { font-size: 22px; margin-bottom: 4px; }

        .bit-filters {
          display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 16px;
        }
        .bit-select, .bit-date {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 8px 12px;
          color: var(--text-primary); font-size: 13px; outline: none;
        }
        .bit-select:focus, .bit-date:focus { border-color: var(--accent-purple); }
        .bit-date { color-scheme: dark; }

        .bit-btn-buscar {
          background: var(--accent-purple); color: #fff; border: none;
          border-radius: 8px; padding: 8px 18px; font-size: 13px;
          font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .bit-btn-buscar:hover:not(:disabled) { opacity: 0.85; }
        .bit-btn-buscar:disabled { opacity: 0.5; cursor: not-allowed; }

        .bit-btn-limpiar {
          background: none; border: 1px solid var(--border);
          color: var(--text-secondary); border-radius: 8px;
          padding: 8px 14px; font-size: 13px; cursor: pointer;
          transition: border-color 0.15s;
        }
        .bit-btn-limpiar:hover { border-color: var(--text-secondary); }

        .bit-count { font-size: 13px; color: var(--text-secondary); }
        .bit-empty { color: var(--text-secondary); text-align: center; padding: 40px; font-size: 14px; }

        .bit-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
        .bit-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .bit-table th {
          padding: 10px 14px; text-align: left;
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          color: var(--text-secondary); background: var(--bg-card);
          border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .bit-row td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
        .bit-row:last-child td { border-bottom: none; }
        .bit-row:hover td { background: rgba(255,255,255,0.02); }

        .bit-fecha   { color: var(--text-secondary); white-space: nowrap; font-size: 12px; }
        .bit-usuario { font-weight: 500; color: var(--text-primary); }
        .bit-accion  { color: var(--text-primary); }
        .bit-ip      { color: var(--text-secondary); font-size: 12px; }
        .bit-null    { color: var(--text-secondary); }

        .bit-badge {
          display: inline-block; font-size: 11px; font-weight: 600;
          padding: 2px 8px; border-radius: 10px; white-space: nowrap;
        }

        /* Detalle formateado */
        .bit-detalle-obj { display: flex; flex-direction: column; gap: 2px; }
        .bit-kv { font-size: 12px; color: var(--text-secondary); }
        .bit-key { font-weight: 600; color: var(--text-primary); }
        .bit-detalle-raw { font-size: 12px; color: var(--text-secondary); word-break: break-all; }

        @media (max-width: 768px) {
          .bit-filters { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </div>
  );
}
