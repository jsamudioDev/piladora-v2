const router = require('express').Router();
const prisma = require('../prisma');

// ── Operarios ──────────────────────────────────────────────────────────────

router.get('/operarios', async (req, res) => {
  try {
    const operarios = await prisma.operario.findMany({ orderBy: { nombre: 'asc' } });
    res.json(operarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/operarios', async (req, res) => {
  try {
    const { nombre } = req.body;
    const operario = await prisma.operario.create({ data: { nombre } });
    res.status(201).json(operario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/operarios/:id', async (req, res) => {
  try {
    const { nombre, activo } = req.body;
    const operario = await prisma.operario.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });
    res.json(operario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Parámetros ─────────────────────────────────────────────────────────────

router.get('/parametros', async (req, res) => {
  try {
    const params = await prisma.parametro.findMany({ orderBy: { clave: 'asc' } });
    res.json(params);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/parametros/:clave', async (req, res) => {
  try {
    const { valor } = req.body;
    const param = await prisma.parametro.upsert({
      where:  { clave: req.params.clave },
      update: { valor },
      create: { clave: req.params.clave, valor },
    });
    res.json(param);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
