const router = require('express').Router();
const prisma = require('../prisma');

// GET /api/dinero/ingresos
router.get('/ingresos', async (req, res) => {
  const ingresos = await prisma.ingreso.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(ingresos);
});

// POST /api/dinero/ingresos
router.post('/ingresos', async (req, res) => {
  const { monto, descripcion, categoria } = req.body;
  const ingreso = await prisma.ingreso.create({ data: { monto, descripcion, categoria } });
  res.status(201).json(ingreso);
});

// GET /api/dinero/egresos
router.get('/egresos', async (req, res) => {
  const egresos = await prisma.egreso.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(egresos);
});

// POST /api/dinero/egresos
router.post('/egresos', async (req, res) => {
  const { monto, descripcion, categoria } = req.body;
  const egreso = await prisma.egreso.create({ data: { monto, descripcion, categoria } });
  res.status(201).json(egreso);
});

// GET /api/dinero/flujo — resumen total
router.get('/flujo', async (req, res) => {
  const [ingresos, egresos] = await Promise.all([
    prisma.ingreso.aggregate({ _sum: { monto: true } }),
    prisma.egreso.aggregate({ _sum: { monto: true } }),
  ]);
  const totalIngresos = ingresos._sum.monto || 0;
  const totalEgresos = egresos._sum.monto || 0;
  res.json({ totalIngresos, totalEgresos, balance: totalIngresos - totalEgresos });
});

module.exports = router;
