import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useToast, ToastContainer } from '../../components/Toast';

// ─── Card genérica ────────────────────────────────────────────────────────────
function Card({ title, children }) {
  return (
    <div className="cfg-card">
      <h3 className="cfg-card-title">{title}</h3>
      {children}
    </div>
  );
}

// ─── Config principal ─────────────────────────────────────────────────────────
export default function Config() {
  const [params, setParams]         = useState({});
  const [operarios, setOperarios]   = useState([]);
  const [editOp, setEditOp]         = useState(null);   // operario en edición
  const [nuevoOp, setNuevoOp]       = useState('');
  const [loading, setLoading]       = useState(true);
  const { toasts, show }            = useToast();

  // ── Carga inicial ────────────────────────────────────────────────────────────
  async function cargar() {
    try {
      const [rawParams, ops] = await Promise.all([
        api.get('/config/parametros'),
        api.get('/config/operarios'),
      ]);
      const map = {};
      rawParams.forEach(p => { map[p.clave] = p.valor; });
      setParams(map);
      setOperarios(ops);
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  // ── Guardar parámetro ────────────────────────────────────────────────────────
  async function guardarParam(clave, valor) {
    try {
      await api.put(`/config/parametros/${clave}`, { valor: String(valor) });
      show('Guardado', 'success');
    } catch (e) {
      show(e.message, 'error');
    }
  }

  // ── Operarios ────────────────────────────────────────────────────────────────
  async function crearOperario() {
    if (!nuevoOp.trim()) return;
    try {
      await api.post('/config/operarios', { nombre: nuevoOp.trim() });
      setNuevoOp('');
      show('Operario agregado', 'success');
      cargar();
    } catch (e) {
      show(e.message, 'error');
    }
  }

  async function guardarOperario() {
    if (!editOp) return;
    try {
      await api.put(`/config/operarios/${editOp.id}`, {
        nombre: editOp.nombre,
        activo: editOp.activo,
      });
      setEditOp(null);
      show('Operario actualizado', 'success');
      cargar();
    } catch (e) {
      show(e.message, 'error');
    }
  }

  if (loading) return <p className="cfg-loading">Cargando...</p>;

  return (
    <div className="cfg-page">
      <h2 className="cfg-title">Configuración</h2>

      {/* Card 1 — Negocio */}
      <Card title="Negocio">
        <div className="cfg-form">
          <label>
            Nombre del negocio
            <input
              value={params.nombre_negocio ?? ''}
              onChange={e => setParams(p => ({ ...p, nombre_negocio: e.target.value }))}
            />
          </label>
          <label>
            Meta de margen (%)
            <input
              type="number" min="0" max="100" step="1"
              value={params.meta_margen ?? ''}
              onChange={e => setParams(p => ({ ...p, meta_margen: e.target.value }))}
            />
          </label>
          <button
            className="btn-save"
            onClick={() => {
              guardarParam('nombre_negocio', params.nombre_negocio);
              guardarParam('meta_margen', params.meta_margen);
            }}
          >
            Guardar negocio
          </button>
        </div>
      </Card>

      {/* Card 2 — Parámetros Piladora */}
      <Card title="Parámetros Piladora">
        <div className="cfg-form cfg-form--grid">
          <label>
            Pago por tanda ($)
            <input
              type="number" min="0" step="0.5"
              value={params.pago_por_tanda ?? ''}
              onChange={e => setParams(p => ({ ...p, pago_por_tanda: e.target.value }))}
            />
          </label>
          <label>
            Precio pilado ($)
            <input
              type="number" min="0" step="0.01"
              value={params.precio_pilado ?? ''}
              onChange={e => setParams(p => ({ ...p, precio_pilado: e.target.value }))}
            />
          </label>
          <label>
            Lb por hora
            <input
              type="number" min="0" step="10"
              value={params.lb_por_hora ?? ''}
              onChange={e => setParams(p => ({ ...p, lb_por_hora: e.target.value }))}
            />
          </label>
          <label>
            Días operativos / período
            <input
              type="number" min="1" max="31"
              value={params.dias_op_periodo ?? ''}
              onChange={e => setParams(p => ({ ...p, dias_op_periodo: e.target.value }))}
            />
          </label>
        </div>
        <button
          className="btn-save"
          onClick={() => {
            ['pago_por_tanda', 'precio_pilado', 'lb_por_hora', 'dias_op_periodo']
              .forEach(k => guardarParam(k, params[k]));
          }}
        >
          Guardar parámetros
        </button>
      </Card>

      {/* Card 3 — Operarios */}
      <Card title="Operarios">
        {/* Lista */}
        <ul className="op-list">
          {operarios.map(op => (
            <li key={op.id} className="op-item">
              {editOp?.id === op.id ? (
                <>
                  <input
                    className="op-edit-input"
                    value={editOp.nombre}
                    onChange={e => setEditOp(prev => ({ ...prev, nombre: e.target.value }))}
                  />
                  <button
                    className={`badge ${editOp.activo ? 'badge--on' : 'badge--off'}`}
                    onClick={() => setEditOp(prev => ({ ...prev, activo: !prev.activo }))}
                  >
                    {editOp.activo ? 'Activo' : 'Inactivo'}
                  </button>
                  <button className="btn-mini btn-mini--ok" onClick={guardarOperario}>✓</button>
                  <button className="btn-mini" onClick={() => setEditOp(null)}>✕</button>
                </>
              ) : (
                <>
                  <span className="op-nombre">{op.nombre}</span>
                  <span className={`badge ${op.activo ? 'badge--on' : 'badge--off'}`}>
                    {op.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  <button className="btn-mini" onClick={() => setEditOp({ ...op })}>Editar</button>
                </>
              )}
            </li>
          ))}
        </ul>

        {/* Agregar */}
        <div className="op-add">
          <input
            placeholder="Nombre del operario"
            value={nuevoOp}
            onChange={e => setNuevoOp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && crearOperario()}
          />
          <button className="btn-save btn-save--sm" onClick={crearOperario}>+ Agregar</button>
        </div>
      </Card>

      <ToastContainer toasts={toasts} />

      <style>{`
        .cfg-page { display: flex; flex-direction: column; gap: 20px; max-width: 680px; }
        .cfg-title { font-size: 22px; margin-bottom: 4px; }
        .cfg-loading { color: var(--text-secondary); text-align: center; padding: 40px; }

        .cfg-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 22px 24px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .cfg-card-title { font-size: 15px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

        .cfg-form { display: flex; flex-direction: column; gap: 14px; }
        .cfg-form label {
          display: flex; flex-direction: column; gap: 6px;
          font-size: 13px; color: var(--text-secondary);
        }
        .cfg-form input {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .cfg-form input:focus { border-color: var(--accent-purple); }
        .cfg-form--grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .btn-save {
          align-self: flex-start;
          background: var(--accent-purple); color: #fff;
          border: none; border-radius: 8px; padding: 9px 20px;
          font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .btn-save:hover { opacity: 0.85; }
        .btn-save--sm { padding: 9px 14px; align-self: auto; }

        /* Operarios */
        .op-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .op-item {
          display: flex; align-items: center; gap: 10px;
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 10px 14px;
        }
        .op-nombre { flex: 1; font-size: 14px; color: var(--text-primary); }
        .op-edit-input {
          flex: 1; background: var(--bg-card); border: 1px solid var(--accent-purple);
          border-radius: 6px; padding: 5px 10px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }

        .badge {
          font-size: 12px; font-weight: 600; padding: 3px 10px;
          border-radius: 20px; border: none; cursor: pointer; white-space: nowrap;
        }
        .badge--on  { background: rgba(74,222,128,0.15); color: var(--accent-green); }
        .badge--off { background: rgba(248,113,113,0.15); color: var(--accent-red); }

        .btn-mini {
          background: none; border: 1px solid var(--border);
          color: var(--text-secondary); border-radius: 6px;
          padding: 4px 10px; font-size: 12px; cursor: pointer;
          transition: all 0.15s; white-space: nowrap;
        }
        .btn-mini:hover { color: var(--text-primary); border-color: var(--text-primary); }
        .btn-mini--ok { border-color: var(--accent-green); color: var(--accent-green); }
        .btn-mini--ok:hover { background: rgba(74,222,128,0.1); }

        .op-add { display: flex; gap: 10px; }
        .op-add input {
          flex: 1; background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .op-add input:focus { border-color: var(--accent-purple); }

        @media (max-width: 600px) {
          .cfg-form--grid { grid-template-columns: 1fr; }
          .op-add { flex-direction: column; }
          .btn-save--sm { align-self: flex-start; }
        }
      `}</style>
    </div>
  );
}
