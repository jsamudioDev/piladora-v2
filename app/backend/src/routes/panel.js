const router = require('express').Router();
const prisma = require('../prisma');

// GET /api/panel — resumen general para el dashboard
router.get('/', async (req, res) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [ventasHoy, ingresos, egresos, stockBajo, ultimasVentas] = await Promise.all([
    prisma.venta.aggregate({
      where: { createdAt: { gte: hoy } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.ingreso.aggregate({ _sum: { monto: true } }),
    prisma.egreso.aggregate({ _sum: { monto: true } }),
    prisma.producto.findMany({
      where: { stockActual: { lte: prisma.producto.fields.stockMinimo } },
    }),
    prisma.venta.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { detalles: { include: { producto: true } } },
    }),
  ]);

  res.json({
    ventasHoy: {
      total: ventasHoy._sum.total || 0,
      cantidad: ventasHoy._count,
    },
    balance: {
      ingresos: ingresos._sum.monto || 0,
      egresos: egresos._sum.monto || 0,
    },
    stockBajoCount: stockBajo.length,
    ultimasVentas,
  });
});

module.exports = router;
