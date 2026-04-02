// ─── Rutas del módulo Pulidura ────────────────────────────────────────────────
// Registra el proceso de secado: pulidura húmeda → pulidura seca.
// Acceso: ADMIN y OPERARIO (controlado en index.js con requireRol)
const router = require('express').Router();
const prisma  = require('../prisma');
const { requireRol } = require('../middleware/permisos');

// ─── GET /api/pulidura — listar últimos 30 registros con nombre de operario ───
router.get('/', async (req, res) => {
  try {
    const registros = await prisma.secadoPulidura.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: {
        operario: { select: { nombre: true } },
      },
    });
    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/pulidura/hoy — registros del día actual ───────────────────────
router.get('/hoy', async (req, res) => {
  try {
    const hoy    = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const registros = await prisma.secadoPulidura.findMany({
      where: { createdAt: { gte: hoy, lt: manana } },
      orderBy: { createdAt: 'desc' },
      include: {
        operario: { select: { nombre: true } },
      },
    });
    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/pulidura/stats — estadísticas por operario (solo ADMIN) ────────
router.get('/stats', requireRol('ADMIN'), async (req, res) => {
  try {
    // Agrupar por operario: total operaciones, sacos húmedos, secos, rendimiento promedio
    const stats = await prisma.secadoPulidura.groupBy({
      by: ['operarioId'],
      _count:  { id: true },
      _sum:    { sacosHumedos: true, sacosSecs: true, lbsHumedas: true, lbsSecas: true },
      _avg:    { rendimiento: true },
    });

    // Obtener nombres de operarios
    const operarios = await prisma.operario.findMany({
      select: { id: true, nombre: true },
    });
    const mapaOperario = Object.fromEntries(operarios.map(o => [o.id, o.nombre]));

    const resultado = stats.map(s => ({
      operarioId:         s.operarioId,
      operarioNombre:     mapaOperario[s.operarioId] || 'Desconocido',
      totalOperaciones:   s._count.id,
      totalSacosHumedos:  s._sum.sacosHumedos || 0,
      totalSacosSecs:     s._sum.sacosSecs    || 0,
      totalLbsHumedas:    s._sum.lbsHumedas   || 0,
      totalLbsSecas:      s._sum.lbsSecas     || 0,
      rendimientoPromedio: parseFloat((s._avg.rendimiento || 0).toFixed(1)),
    }));

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/pulidura — registrar un secado ────────────────────────────────
// Body: { operarioId, sacosHumedos, sacosSecs, nota }
// Calcula pesos desde parámetros de BD, actualiza stock de pulidura si existe.
router.post('/', async (req, res) => {
  try {
    const { operarioId, sacosHumedos, sacosSecs, nota } = req.body;

    // Validaciones básicas
    if (!operarioId) return res.status(400).json({ error: 'operarioId es requerido' });
    if (!sacosHumedos || Number(sacosHumedos) <= 0) {
      return res.status(400).json({ error: 'sacosHumedos debe ser mayor a 0' });
    }
    if (sacosSecs === undefined || sacosSecs === null || Number(sacosSecs) < 0) {
      return res.status(400).json({ error: 'sacosSecs no puede ser negativo' });
    }

    // Obtener pesos desde parámetros de configuración
    const [paramHumedo, paramSeco] = await Promise.all([
      prisma.parametro.findUnique({ where: { clave: 'peso_saco_humedo' } }),
      prisma.parametro.findUnique({ where: { clave: 'peso_saco_seco' } }),
    ]);

    const pesoHumedo = parseFloat(paramHumedo?.valor || '63');
    const pesoSeco   = parseFloat(paramSeco?.valor   || '50');

    // Calcular métricas del secado
    const sh         = Number(sacosHumedos);
    const ss         = Number(sacosSecs);
    const lbsHumedas = parseFloat((sh * pesoHumedo).toFixed(2));
    const lbsSecas   = parseFloat((ss * pesoSeco).toFixed(2));
    const rendimiento = lbsHumedas > 0
      ? parseFloat(((lbsSecas / lbsHumedas) * 100).toFixed(2))
      : 0;

    // Crear el registro de secado
    const registro = await prisma.secadoPulidura.create({
      data: {
        operarioId:  Number(operarioId),
        sacosHumedos: sh,
        sacosSecs:    ss,
        pesoHumedo,
        pesoSeco,
        rendimiento,
        lbsHumedas,
        lbsSecas,
        nota:         nota || null,
        usuarioId:    req.usuario?.id || null,
      },
      include: {
        operario: { select: { nombre: true } },
      },
    });

    // Actualizar stock de pulidura en inventario (si el producto existe)
    // Se busca el producto cuyo nombre contenga 'pulidura' y sea de categoría 'pilado'
    const productoPulidura = await prisma.producto.findFirst({
      where: {
        nombre:    { contains: 'pulidura' },
        categoria: 'pilado',
      },
    });

    if (productoPulidura) {
      // Sacos húmedos salen del stock (se convirtieron en húmedos → ya no sirven como secos)
      // Sacos secos entran al stock
      const delta = ss - sh;
      await prisma.producto.update({
        where: { id: productoPulidura.id },
        data:  { stockActual: { increment: delta } },
      });
    }

    res.status(201).json(registro);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
