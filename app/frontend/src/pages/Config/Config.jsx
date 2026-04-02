import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast, ToastContainer } from '../../components/Toast';

// ─── Módulos del sistema con sus roles por defecto ────────────────────────────
const MODULOS_SISTEMA = [
  { key: 'panel',    label: 'Panel',    default: ['ADMIN'] },
  { key: 'venta',    label: 'Venta',    default: ['ADMIN', 'VENDEDOR'] },
  { key: 'pilar',    label: 'Pilar',    default: ['ADMIN', 'OPERARIO'] },
  { key: 'pulidura', label: 'Pulidura', default: ['ADMIN', 'OPERARIO'] },
  { key: 'stock',    label: 'Stock',    default: ['ADMIN', 'OPERARIO', 'VENDEDOR'] },
  { key: 'dinero',   label: 'Dinero',   default: ['ADMIN'] },
  { key: 'creditos', label: 'Créditos', default: ['ADMIN'] },
  { key: 'config',   label: 'Config',   default: ['ADMIN'] },
];

const ROLES_DISPONIBLES = ['ADMIN', 'OPERARIO', 'VENDEDOR'];

// ─── Tabs de la página Config ─────────────────────────────────────────────────
const TABS = [
  { key: 'perfil',     label: 'Mi Perfil' },
  { key: 'productos',  label: 'Productos' },
  { key: 'operarios',  label: 'Operarios' },
  { key: 'parametros', label: 'Parámetros' },
  { key: 'modulos',    label: 'Módulos' },
];

// ─── Modal para crear/editar producto ────────────────────────────────────────
function ModalProductoConfig({ producto, onGuardar, onCerrar }) {
  const esNuevo = !producto;
  const [form, setForm] = useState({
    nombre:      producto?.nombre      ?? '',
    unidad:      producto?.unidad      ?? '',
    precio:      producto?.precio      ?? '',
    stockActual: producto?.stockActual ?? '',
    stockMinimo: producto?.stockMinimo ?? '',
    ubicacion:   producto?.ubicacion   ?? 'piladora',
    categoria:   producto?.categoria   ?? 'grano',
    activo:      producto?.activo      ?? true,
  });
  const [enviando, setEnviando] = useState(false);

  async function handleGuardar() {
    if (!form.nombre.trim() || !form.unidad.trim()) return;
    setEnviando(true);
    try {
      await onGuardar(form, producto?.id);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="cfg-overlay" onClick={onCerrar}>
      <div className="cfg-modal" onClick={e => e.stopPropagation()}>
        <div className="cfg-modal-header">
          <h3 className="cfg-modal-title">{esNuevo ? 'Nuevo Producto' : 'Editar Producto'}</h3>
          <button className="cfg-modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div className="cfg-modal-body">
          <label className="cfg-label">
            Nombre
            <input className="cfg-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </label>
          <div className="cfg-row2">
            <label className="cfg-label">
              Unidad
              <input className="cfg-input" value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} placeholder="saco, kg, lb…" />
            </label>
            <label className="cfg-label">
              Precio ($)
              <input className="cfg-input" type="number" min="0" step="0.01" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
            </label>
          </div>
          <div className="cfg-row2">
            {esNuevo && (
              <label className="cfg-label">
                Stock inicial
                <input className="cfg-input" type="number" min="0" step="0.5" value={form.stockActual} onChange={e => setForm(f => ({ ...f, stockActual: e.target.value }))} />
              </label>
            )}
            <label className="cfg-label">
              Stock mínimo
              <input className="cfg-input" type="number" min="0" step="0.5" value={form.stockMinimo} onChange={e => setForm(f => ({ ...f, stockMinimo: e.target.value }))} />
            </label>
          </div>
          <div className="cfg-row2">
            <label className="cfg-label">
              Ubicación
              <select className="cfg-input" value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}>
                <option value="piladora">Piladora</option>
                <option value="local">Local</option>
              </select>
            </label>
            <label className="cfg-label">
              Categoría
              <select className="cfg-input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                <option value="grano">Grano</option>
                <option value="pilado">Pilado</option>
                <option value="alimento">Alimento</option>
                <option value="otro">Otro</option>
              </select>
            </label>
          </div>
          {/* Toggle activo solo en edición */}
          {!esNuevo && (
            <label className="cfg-label cfg-label--row">
              Estado
              <button
                className={`badge ${form.activo ? 'badge--on' : 'badge--off'}`}
                onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
              >
                {form.activo ? 'Activo' : 'Inactivo'}
              </button>
            </label>
          )}
        </div>

        <div className="cfg-modal-footer">
          <button className="btn-cancelar-cfg" onClick={onCerrar}>Cancelar</button>
          <button className="btn-save" onClick={handleGuardar} disabled={enviando || !form.nombre.trim() || !form.unidad.trim()}>
            {enviando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Config() {
  const { usuario }            = useAuth();
  const { toasts, show }       = useToast();
  const [tab, setTab]          = useState('perfil');

  // ── Estado: Mi Perfil ──────────────────────────────────────────────────────
  const [pNombre,   setPNombre]   = useState(usuario?.nombre ?? '');
  const [pPwAct,    setPPwAct]    = useState('');
  const [pPwNew,    setPPwNew]    = useState('');
  const [guardandoP, setGuardandoP] = useState(false);

  // ── Estado: Productos ──────────────────────────────────────────────────────
  const [productos,    setProductos]    = useState([]);
  const [modalProd,    setModalProd]    = useState(null); // null | 'nuevo' | producto
  const [busqProd,     setBusqProd]     = useState('');

  // ── Estado: Operarios ──────────────────────────────────────────────────────
  const [operarios, setOperarios] = useState([]);
  const [editOp,    setEditOp]    = useState(null);
  const [nuevoOp,   setNuevoOp]   = useState('');

  // ── Estado: Parámetros ─────────────────────────────────────────────────────
  const [params, setParams] = useState({});

  // ── Estado: Módulos ────────────────────────────────────────────────────────
  // modulosDB: array de { clave, valor } desde BD
  const [modulosDB,    setModulosDB]    = useState([]);
  const [guardandoMod, setGuardandoMod] = useState('');

  // ── Cargas ─────────────────────────────────────────────────────────────────
  async function cargarProductos() {
    try {
      const data = await api.get('/config/productos');
      setProductos(data);
    } catch (e) { show(e.message, 'error'); }
  }

  async function cargarOperariosYParams() {
    try {
      const [ops, rawParams] = await Promise.all([
        api.get('/config/operarios'),
        api.get('/config/parametros'),
      ]);
      setOperarios(ops);
      const map = {};
      rawParams.forEach(p => { map[p.clave] = p.valor; });
      setParams(map);
    } catch (e) { show(e.message, 'error'); }
  }

  async function cargarModulos() {
    try {
      const data = await api.get('/config/modulos');
      setModulosDB(data);
    } catch (e) { show(e.message, 'error'); }
  }

  // Carga según tab activo
  useEffect(() => {
    if (tab === 'productos')  cargarProductos();
    if (tab === 'operarios' || tab === 'parametros') cargarOperariosYParams();
    if (tab === 'modulos')    cargarModulos();
  }, [tab]);

  // ── Mi Perfil ───────────────────────────────────────────────────────────────
  async function guardarPerfil() {
    if (!pNombre.trim() && !pPwNew) {
      show('Ingresa un nombre o una nueva contraseña', 'error'); return;
    }
    setGuardandoP(true);
    try {
      await api.put('/auth/perfil', {
        nombre:        pNombre.trim() || undefined,
        passwordActual: pPwAct || undefined,
        passwordNuevo:  pPwNew || undefined,
      });
      show('Perfil actualizado', 'success');
      setPPwAct(''); setPPwNew('');
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setGuardandoP(false);
    }
  }

  // ── Productos ───────────────────────────────────────────────────────────────
  async function handleGuardarProducto(form, id) {
    try {
      if (id) {
        await api.put(`/config/productos/${id}`, form);
        show('Producto actualizado', 'success');
      } else {
        await api.post('/config/productos', form);
        show('Producto creado', 'success');
      }
      setModalProd(null);
      cargarProductos();
    } catch (e) {
      show(e.message, 'error');
      throw e; // para que el modal no cierre el spinner
    }
  }

  const prodFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqProd.toLowerCase())
  );

  // ── Operarios ───────────────────────────────────────────────────────────────
  async function crearOperario() {
    if (!nuevoOp.trim()) return;
    try {
      await api.post('/config/operarios', { nombre: nuevoOp.trim() });
      setNuevoOp('');
      show('Operario agregado', 'success');
      cargarOperariosYParams();
    } catch (e) { show(e.message, 'error'); }
  }

  async function guardarOperario() {
    if (!editOp) return;
    try {
      await api.put(`/config/operarios/${editOp.id}`, { nombre: editOp.nombre, activo: editOp.activo });
      setEditOp(null);
      show('Operario actualizado', 'success');
      cargarOperariosYParams();
    } catch (e) { show(e.message, 'error'); }
  }

  // ── Parámetros ──────────────────────────────────────────────────────────────
  async function guardarParam(clave, valor) {
    try {
      await api.put(`/config/parametros/${clave}`, { valor: String(valor) });
      show('Guardado', 'success');
    } catch (e) { show(e.message, 'error'); }
  }

  // ── Módulos ─────────────────────────────────────────────────────────────────
  // Obtiene los roles actuales de un módulo (de la BD o del default)
  function rolesActuales(modKey) {
    const db = modulosDB.find(m => m.clave === `modulo_${modKey}`);
    if (db) return db.valor.split(',').filter(Boolean);
    return MODULOS_SISTEMA.find(m => m.key === modKey)?.default ?? [];
  }

  async function toggleModuloRol(modKey, rol, activo) {
    // Protección: no se puede quitar ADMIN de Panel ni de Config
    if (!activo && rol === 'ADMIN' && (modKey === 'panel' || modKey === 'config')) {
      show(`El ADMIN no puede perder acceso a "${modKey}"`, 'error'); return;
    }

    const actuales = rolesActuales(modKey);
    const nuevos   = activo
      ? [...new Set([...actuales, rol])]
      : actuales.filter(r => r !== rol);

    const valor = nuevos.join(',');
    setGuardandoMod(modKey);
    try {
      const updated = await api.put(`/config/modulos/modulo_${modKey}`, { valor });
      // Actualizar estado local
      setModulosDB(prev => {
        const idx = prev.findIndex(m => m.clave === `modulo_${modKey}`);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
      show(`Módulo "${modKey}" actualizado`, 'success');
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setGuardandoMod('');
    }
  }

  // ─── Renders por tab ────────────────────────────────────────────────────────

  function renderPerfil() {
    return (
      <div className="cfg-card">
        <h3 className="cfg-card-title">Datos personales</h3>
        <div className="cfg-form">
          <label className="cfg-label">
            Nombre
            <input className="cfg-input" value={pNombre} onChange={e => setPNombre(e.target.value)} placeholder="Tu nombre" />
          </label>
          <hr className="cfg-sep" />
          <p className="cfg-sub">Cambiar contraseña (opcional)</p>
          <label className="cfg-label">
            Contraseña actual
            <input className="cfg-input" type="password" value={pPwAct} onChange={e => setPPwAct(e.target.value)} placeholder="••••••••" />
          </label>
          <label className="cfg-label">
            Nueva contraseña
            <input className="cfg-input" type="password" value={pPwNew} onChange={e => setPPwNew(e.target.value)} placeholder="••••••••" />
          </label>
          <button className="btn-save" onClick={guardarPerfil} disabled={guardandoP}>
            {guardandoP ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    );
  }

  function renderProductos() {
    return (
      <>
        <div className="cfg-toolbar">
          <input
            className="cfg-search"
            placeholder="Buscar producto..."
            value={busqProd}
            onChange={e => setBusqProd(e.target.value)}
          />
          <button className="btn-save" onClick={() => setModalProd('nuevo')}>+ Nuevo</button>
        </div>

        <div className="cfg-table-wrap">
          <table className="cfg-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Unidad</th>
                <th>Precio</th>
                <th>Stock Act.</th>
                <th>Stock Loc.</th>
                <th>Mínimo</th>
                <th>Ubic.</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prodFiltrados.length === 0 && (
                <tr><td colSpan={9} className="cfg-empty">Sin productos</td></tr>
              )}
              {prodFiltrados.map(p => (
                <tr key={p.id} className="cfg-row">
                  <td className="cfg-nombre">{p.nombre}</td>
                  <td className="cfg-muted">{p.unidad}</td>
                  <td className="cfg-num">${p.precio?.toFixed(2) ?? '0.00'}</td>
                  <td className="cfg-num">{p.stockActual}</td>
                  <td className="cfg-num">{p.stockLocal}</td>
                  <td className="cfg-num cfg-muted">{p.stockMinimo}</td>
                  <td className="cfg-muted">{p.ubicacion}</td>
                  <td>
                    <span className={`badge ${p.activo !== false ? 'badge--on' : 'badge--off'}`}>
                      {p.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-mini" onClick={() => setModalProd(p)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {modalProd && (
          <ModalProductoConfig
            producto={modalProd === 'nuevo' ? null : modalProd}
            onGuardar={handleGuardarProducto}
            onCerrar={() => setModalProd(null)}
          />
        )}
      </>
    );
  }

  function renderOperarios() {
    return (
      <div className="cfg-card">
        <h3 className="cfg-card-title">Operarios</h3>
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
        <div className="op-add">
          <input
            placeholder="Nombre del operario"
            value={nuevoOp}
            onChange={e => setNuevoOp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && crearOperario()}
          />
          <button className="btn-save btn-save--sm" onClick={crearOperario}>+ Agregar</button>
        </div>
      </div>
    );
  }

  function renderParametros() {
    return (
      <>
        <div className="cfg-card">
          <h3 className="cfg-card-title">Negocio</h3>
          <div className="cfg-form">
            <label className="cfg-label">
              Nombre del negocio
              <input className="cfg-input" value={params.nombre_negocio ?? ''} onChange={e => setParams(p => ({ ...p, nombre_negocio: e.target.value }))} />
            </label>
            <label className="cfg-label">
              Meta de margen (%)
              <input className="cfg-input" type="number" min="0" max="100" step="1" value={params.meta_margen ?? ''} onChange={e => setParams(p => ({ ...p, meta_margen: e.target.value }))} />
            </label>
            <button className="btn-save" onClick={() => { guardarParam('nombre_negocio', params.nombre_negocio); guardarParam('meta_margen', params.meta_margen); }}>
              Guardar negocio
            </button>
          </div>
        </div>

        <div className="cfg-card">
          <h3 className="cfg-card-title">Parámetros Piladora</h3>
          <div className="cfg-form cfg-form--grid">
            <label className="cfg-label">
              Pago por tanda ($)
              <input className="cfg-input" type="number" min="0" step="0.5" value={params.pago_por_tanda ?? ''} onChange={e => setParams(p => ({ ...p, pago_por_tanda: e.target.value }))} />
            </label>
            <label className="cfg-label">
              Precio pilado ($)
              <input className="cfg-input" type="number" min="0" step="0.01" value={params.precio_pilado ?? ''} onChange={e => setParams(p => ({ ...p, precio_pilado: e.target.value }))} />
            </label>
            <label className="cfg-label">
              Lb por hora
              <input className="cfg-input" type="number" min="0" step="10" value={params.lb_por_hora ?? ''} onChange={e => setParams(p => ({ ...p, lb_por_hora: e.target.value }))} />
            </label>
            <label className="cfg-label">
              Días operativos / período
              <input className="cfg-input" type="number" min="1" max="31" value={params.dias_op_periodo ?? ''} onChange={e => setParams(p => ({ ...p, dias_op_periodo: e.target.value }))} />
            </label>
          </div>
          <button className="btn-save" onClick={() => { ['pago_por_tanda','precio_pilado','lb_por_hora','dias_op_periodo'].forEach(k => guardarParam(k, params[k])); }}>
            Guardar parámetros
          </button>
        </div>
      </>
    );
  }

  function renderModulos() {
    return (
      <div className="cfg-card">
        <h3 className="cfg-card-title">Visibilidad de Módulos por Rol</h3>
        <p className="cfg-aviso">
          Los cambios aplican al próximo inicio de sesión. No se puede quitar el acceso de ADMIN a Panel ni Config.
        </p>
        <div className="mod-table-wrap">
          <table className="mod-table">
            <thead>
              <tr>
                <th>Módulo</th>
                {ROLES_DISPONIBLES.map(r => <th key={r}>{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {MODULOS_SISTEMA.map(mod => {
                const actuales = rolesActuales(mod.key);
                const guardando = guardandoMod === mod.key;
                return (
                  <tr key={mod.key} className="mod-row">
                    <td className="mod-nombre">{mod.label}</td>
                    {ROLES_DISPONIBLES.map(rol => {
                      const checked = actuales.includes(rol);
                      // ADMIN sobre Panel y Config: checkbox deshabilitado
                      const protegido = rol === 'ADMIN' && (mod.key === 'panel' || mod.key === 'config');
                      return (
                        <td key={rol} className="mod-check-cell">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={guardando || protegido}
                            onChange={e => toggleModuloRol(mod.key, rol, e.target.checked)}
                            className="mod-checkbox"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="cfg-page">
      <h2 className="cfg-title">Configuración</h2>

      {/* Tabs de sección */}
      <div className="cfg-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`cfg-tab${tab === t.key ? ' cfg-tab--on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="cfg-content">
        {tab === 'perfil'     && renderPerfil()}
        {tab === 'productos'  && renderProductos()}
        {tab === 'operarios'  && renderOperarios()}
        {tab === 'parametros' && renderParametros()}
        {tab === 'modulos'    && renderModulos()}
      </div>

      <ToastContainer toasts={toasts} />

      <style>{`
        .cfg-page    { display: flex; flex-direction: column; gap: 16px; max-width: 800px; }
        .cfg-title   { font-size: 22px; margin-bottom: 4px; }
        .cfg-loading { color: var(--text-secondary); text-align: center; padding: 40px; }

        /* Tabs */
        .cfg-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .cfg-tab {
          padding: 8px 18px; border-radius: 8px; border: 1px solid var(--border);
          background: none; color: var(--text-secondary); font-size: 14px; font-weight: 500;
          cursor: pointer; transition: all 0.15s;
        }
        .cfg-tab:hover { color: var(--text-primary); background: var(--bg-card); }
        .cfg-tab--on {
          background: rgba(124,106,247,0.15); color: var(--accent-purple);
          border-color: var(--accent-purple); font-weight: 600;
        }

        .cfg-content { display: flex; flex-direction: column; gap: 20px; }

        /* Card */
        .cfg-card {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 14px; padding: 22px 24px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .cfg-card-title { font-size: 14px; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

        .cfg-form { display: flex; flex-direction: column; gap: 14px; }
        .cfg-form--grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .cfg-label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--text-secondary); }
        .cfg-label--row { flex-direction: row; align-items: center; justify-content: space-between; }
        .cfg-input {
          background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .cfg-input:focus { border-color: var(--accent-purple); }
        .cfg-sep  { border: none; border-top: 1px solid var(--border); margin: 4px 0; }
        .cfg-sub  { font-size: 12px; color: var(--text-secondary); }
        .cfg-aviso {
          font-size: 13px; color: #fbbf24;
          background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2);
          border-radius: 8px; padding: 8px 12px;
        }

        /* Botones */
        .btn-save {
          align-self: flex-start;
          background: var(--accent-purple); color: #fff;
          border: none; border-radius: 8px; padding: 9px 20px;
          font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .btn-save:hover:not(:disabled) { opacity: 0.85; }
        .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-save--sm { padding: 9px 14px; align-self: auto; }
        .btn-cancelar-cfg {
          background: none; border: 1px solid var(--border);
          color: var(--text-secondary); border-radius: 8px;
          padding: 9px 18px; font-size: 14px; cursor: pointer;
        }
        .btn-cancelar-cfg:hover { border-color: var(--text-secondary); }

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
        .op-add { display: flex; gap: 10px; }
        .op-add input {
          flex: 1; background: var(--bg-base); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .op-add input:focus { border-color: var(--accent-purple); }

        /* Badges */
        .badge { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; border: none; cursor: pointer; white-space: nowrap; }
        .badge--on  { background: rgba(74,222,128,0.15); color: var(--accent-green); }
        .badge--off { background: rgba(248,113,113,0.15); color: var(--accent-red); }
        .btn-mini {
          background: none; border: 1px solid var(--border);
          color: var(--text-secondary); border-radius: 6px;
          padding: 4px 10px; font-size: 12px; cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .btn-mini:hover { color: var(--text-primary); border-color: var(--text-primary); }
        .btn-mini--ok { border-color: var(--accent-green); color: var(--accent-green); }
        .btn-mini--ok:hover { background: rgba(74,222,128,0.1); }

        /* Toolbar productos */
        .cfg-toolbar { display: flex; gap: 10px; align-items: center; }
        .cfg-search {
          flex: 1; background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 8px; padding: 9px 12px;
          color: var(--text-primary); font-size: 14px; outline: none;
        }
        .cfg-search:focus { border-color: var(--accent-purple); }

        /* Tabla productos */
        .cfg-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
        .cfg-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .cfg-table th {
          padding: 9px 12px; text-align: left;
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          color: var(--text-secondary); background: var(--bg-card);
          border-bottom: 1px solid var(--border);
        }
        .cfg-row td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
        .cfg-row:last-child td { border-bottom: none; }
        .cfg-row:hover td { background: rgba(255,255,255,0.02); }
        .cfg-nombre { font-weight: 500; color: var(--text-primary); }
        .cfg-num    { text-align: right; font-weight: 600; }
        .cfg-muted  { color: var(--text-secondary); }
        .cfg-empty  { text-align: center; padding: 24px; color: var(--text-secondary); }

        /* Modal producto */
        .cfg-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px;
        }
        .cfg-modal {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 16px; padding: 24px; width: 100%; max-width: 460px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .cfg-modal-header { display: flex; justify-content: space-between; align-items: center; }
        .cfg-modal-title  { font-size: 16px; font-weight: 700; }
        .cfg-modal-close  { background: none; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer; padding: 4px 8px; }
        .cfg-modal-body   { display: flex; flex-direction: column; gap: 12px; }
        .cfg-modal-footer { display: flex; gap: 8px; justify-content: flex-end; }
        .cfg-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        /* Tabla módulos */
        .mod-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
        .mod-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .mod-table th {
          padding: 10px 14px; text-align: center;
          font-size: 12px; font-weight: 600; text-transform: uppercase;
          color: var(--text-secondary); background: var(--bg-card);
          border-bottom: 1px solid var(--border);
        }
        .mod-table th:first-child { text-align: left; }
        .mod-row td { padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .mod-row:last-child td { border-bottom: none; }
        .mod-nombre { font-weight: 500; color: var(--text-primary); }
        .mod-check-cell { text-align: center; }
        .mod-checkbox { width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent-purple); }
        .mod-checkbox:disabled { cursor: not-allowed; opacity: 0.5; }

        @media (max-width: 600px) {
          .cfg-form--grid, .cfg-row2 { grid-template-columns: 1fr; }
          .op-add { flex-direction: column; }
          .btn-save--sm { align-self: flex-start; }
        }
      `}</style>
    </div>
  );
}
