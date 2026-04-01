const router = require('express').Router();
const prisma = require('../prisma');

// GET /api/panel
router.get('/', async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    const hace7 = new Date(hoy);
    hace7.setDate(hace7.getDate() - 6);

    const [
      ventasHoySum,
      ventasHoyCount,
      ingresosHoyAgg,
      egresosHoyAgg,
      piladoHoyAgg,
      ultimasVentas,
      productos,
      ingresosSemanales,
      egresosSemanales,
      nombreNegocio,
    ] = await Promise.all([
      prisma.venta.aggregate({
        where: { createdAt: { gte: hoy, lt: manana } },
        _sum: { total: true },
      }),
      prisma.venta.count({
        where: { createdAt: { gte: hoy, lt: manana } },
      }),
      prisma.ingreso.aggregate({
        where: { createdAt: { gte: hoy, lt: manana } },
        _sum: { monto: true },
      }),
      prisma.egreso.aggregate({
        where: { createdAt: { gte: hoy, lt: manana } },
        _sum: { monto: true },
      }),
      prisma.pilado.aggregate({
        where: { createdAt: { gte: hoy, lt: manana } },
        _sum: { qqEntrada: true },
      }),
      prisma.venta.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { detalles: { include: { producto: true } } },
      }),
      prisma.producto.findMany({ orderBy: { stockActual: 'asc' } }),
      prisma.ingreso.findMany({
        where: { createdAt: { gte: hace7 } },
        select: { monto: true, createdAt: true },
      }),
      prisma.egreso.findMany({
        where: { createdAt: { gte: hace7 } },
        select: { monto: true, createdAt: true },
      }),
      prisma.parametro.findUnique({ where: { clave: 'nombre_negocio' } }),
    ]);

    // Alertas de stock bajo (filtrado en JS para evitar comparación de campos en DB)
    const stockAlertas = productos.filter(p => p.stockActual <= p.stockMinimo);

    // Flujo 7 días
    const diasMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(hace7);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      diasMap[key] = { fecha: key, ingresos: 0, egresos: 0, neto: 0 };
    }
    ingresosSemanales.forEach(r => {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      if (diasMap[key]) diasMap[key].ingresos += Number(r.monto);
    });
    egresosSemanales.forEach(r => {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      if (diasMap[key]) diasMap[key].egresos += Number(r.monto);
    });
    Object.values(diasMap).forEach(d => { d.neto = d.ingresos - d.egresos; });

    const ingHoy = Number(ingresosHoyAgg._sum.monto) || 0;
    const egrHoy = Number(egresosHoyAgg._sum.monto) || 0;

    res.json({
      nombreNegocio: nombreNegocio?.valor || 'Piladora',
      ventasHoy: {
        total: Number(ventasHoySum._sum.total) || 0,
        count: ventasHoyCount,
      },
      gananciaHoy: ingHoy - egrHoy,
      piladoHoy:   Number(piladoHoyAgg._sum.qqEntrada) || 0,
      egresosHoy:  egrHoy,
      stockAlertas,
      ultimasVentas,
      flujo7dias:  Object.values(diasMap),
      productos,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
