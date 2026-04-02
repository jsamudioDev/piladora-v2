// ─── Ruta de Bitácora — solo ADMIN ───────────────────────────────────────────
const router  = require('express').Router();
const prisma  = require('../prisma');
const { requireRol } = require('../middleware/permisos');

// GET /api/bitacora — lista con filtros opcionales
// Query params: modulo, accion, usuarioId, fechaDesde, fechaHasta, limite (default 200)
router.get('/', requireRol('ADMIN'), async (req, res) => {
  try {
    const { modulo, accion, usuarioId, fechaDesde, fechaHasta, limite = 200 } = req.query;

    const where = {};
    if (modulo)    where.modulo    = modulo;
    if (accion)    where.accion    = accion;
    if (usuarioId) where.usuarioId = Number(usuarioId);
    if (fechaDesde || fechaHasta) {
      where.createdAt = {};
      if (fechaDesde) where.createdAt.gte = new Date(fechaDesde);
      if (fechaHasta) {
        const fin = new Date(fechaHasta);
        fin.setHours(23, 59, 59, 999);
        where.createdAt.lte = fin;
      }
    }

    const registros = await prisma.bitacora.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    Math.min(Number(limite), 500),
    });

    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener bitácora' });
  }
});

// GET /api/bitacora/resumen — conteo por módulo (ADMIN)
router.get('/resumen', requireRol('ADMIN'), async (req, res) => {
  try {
    const resumen = await prisma.bitacora.groupBy({
      by:      ['modulo'],
      _count:  { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    res.json(resumen);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

module.exports = router;
