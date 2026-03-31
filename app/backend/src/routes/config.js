const router = require('express').Router();
const prisma = require('../prisma');

// ── Operarios ──────────────────────────────────────────────────────────────

router.get('/operarios', async (req, res) => {
  const operarios = await prisma.operario.findMany({ orderBy: { nombre: 'asc' } });
  res.json(operarios);
});

router.post('/operarios', async (req, res) => {
  const { nombre } = req.body;
  const operario = await prisma.operario.create({ data: { nombre } });
  res.status(201).json(operario);
});

router.patch('/operarios/:id', async (req, res) => {
  const { activo } = req.body;
  const operario = await prisma.operario.update({
    where: { id: Number(req.params.id) },
    data: { activo },
  });
  res.json(operario);
});

// ── Parámetros ─────────────────────────────────────────────────────────────

router.get('/parametros', async (req, res) => {
  const params = await prisma.parametro.findMany();
  res.json(params);
});

router.put('/parametros/:clave', async (req, res) => {
  const { valor } = req.body;
  const param = await prisma.parametro.upsert({
    where: { clave: req.params.clave },
    update: { valor },
    create: { clave: req.params.clave, valor },
  });
  res.json(param);
});

module.exports = router;
