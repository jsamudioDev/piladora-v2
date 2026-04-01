const router = require('express').Router();
const prisma = require('../prisma');

const CATEGORIAS_VALIDAS = ['Compra Maíz', 'Flete', 'Salarios', 'Mantenimiento', 'Otro'];

// GET /api/dinero/resumen
router.get('/resumen', async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    const hace7 = new Date(hoy);
    hace7.setDate(hace7.getDate() - 6);

    const [ingresosHoyAgg, egresosHoyAgg, ingresosSemanales, egresosSemanales] = await Promise.all([
      prisma.ingreso.aggregate({
        where: { createdAt: { gte: hoy, lt: manana } },
        _sum: { monto: true },
      }),
      prisma.egreso.aggregate({
        where: { createdAt: { gte: hoy, lt: manana } },
        _sum: { monto: true },
      }),
      prisma.ingreso.findMany({
        where: { createdAt: { gte: hace7 } },
        select: { monto: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.egreso.findMany({
        where: { createdAt: { gte: hace7 } },
        select: { monto: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const ingresosHoy = Number(ingresosHoyAgg._sum.monto) || 0;
    const egresosHoy  = Number(egresosHoyAgg._sum.monto) || 0;

    // Construir mapa de 7 días
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

    res.json({
      ingresosHoy,
      egresosHoy,
      gananciaHoy: ingresosHoy - egresosHoy,
      flujoNeto:   ingresosHoy - egresosHoy,
      ingresosSemanales: Object.values(diasMap),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dinero/ingresos — últimos 30
router.get('/ingresos', async (req, res) => {
  try {
    const ingresos = await prisma.ingreso.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
    });
    res.json(ingresos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dinero/egresos — últimos 30
router.get('/egresos', async (req, res) => {
  try {
    const egresos = await prisma.egreso.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
    });
    res.json(egresos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/dinero/egresos
router.post('/egresos', async (req, res) => {
  try {
    const { monto, descripcion, categoria } = req.body;
    if (!monto || Number(monto) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }
    if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({ error: 'La descripción es obligatoria' });
    }
    if (!CATEGORIAS_VALIDAS.includes(categoria)) {
      return res.status(400).json({ error: `Categoría inválida. Opciones: ${CATEGORIAS_VALIDAS.join(', ')}` });
    }
    const egreso = await prisma.egreso.create({
      data: { monto: Number(monto), descripcion: descripcion.trim(), categoria },
    });
    res.status(201).json(egreso);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dinero/flujo — últimos 7 días agrupado por día
router.get('/flujo', async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hace7 = new Date(hoy);
    hace7.setDate(hace7.getDate() - 6);

    const [ingresos, egresos] = await Promise.all([
      prisma.ingreso.findMany({
        where: { createdAt: { gte: hace7 } },
        select: { monto: true, createdAt: true },
      }),
      prisma.egreso.findMany({
        where: { createdAt: { gte: hace7 } },
        select: { monto: true, createdAt: true },
      }),
    ]);

    const diasMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(hace7);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      diasMap[key] = { fecha: key, ingresos: 0, egresos: 0, neto: 0 };
    }
    ingresos.forEach(r => {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      if (diasMap[key]) diasMap[key].ingresos += Number(r.monto);
    });
    egresos.forEach(r => {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      if (diasMap[key]) diasMap[key].egresos += Number(r.monto);
    });
    Object.values(diasMap).forEach(d => { d.neto = d.ingresos - d.egresos; });

    res.json(Object.values(diasMap));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
