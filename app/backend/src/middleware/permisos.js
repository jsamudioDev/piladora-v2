// ─── Middleware de permisos granulares por rol ────────────────────────────────
// Funciona DESPUÉS de authMiddleware, que ya cargó req.usuario.
// Tres roles: ADMIN (acceso total), OPERARIO (piladora), VENDEDOR (local)

/**
 * requireRol(...roles) — Retorna middleware que verifica que el usuario
 * tenga uno de los roles permitidos.
 *
 * Uso:  router.get('/', requireRol('ADMIN', 'OPERARIO'), handler)
 */
function requireRol(...roles) {
  return function (req, res, next) {
    // req.usuario ya fue cargado por authMiddleware
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`,
      });
    }

    next();
  };
}

/**
 * requireUbicacion(ubicacion) — Para rutas de stock.
 * Verifica que el usuario tenga acceso a la ubicación solicitada:
 *   - ADMIN    → accede a cualquier ubicación
 *   - OPERARIO → solo 'piladora'
 *   - VENDEDOR → solo 'local'
 *
 * Uso:  router.post('/movimiento', requireUbicacion('piladora'), handler)
 * O en rutas dinámicas donde la ubicación viene en el body del producto.
 */
function requireUbicacion(ubicacion) {
  return function (req, res, next) {
    const rol = req.usuario?.rol;

    // ADMIN puede todo
    if (rol === 'ADMIN') return next();

    // OPERARIO solo puede operar en piladora
    if (rol === 'OPERARIO' && ubicacion !== 'piladora') {
      return res.status(403).json({
        error: 'Operario solo puede operar stock de la piladora',
      });
    }

    // VENDEDOR solo puede operar en local
    if (rol === 'VENDEDOR' && ubicacion !== 'local') {
      return res.status(403).json({
        error: 'Vendedor solo puede operar stock del local',
      });
    }

    next();
  };
}

module.exports = { requireRol, requireUbicacion };
