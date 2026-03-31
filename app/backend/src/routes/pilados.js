const router = require('express').Router();
const prisma = require('../prisma');

// GET /api/pilados
router.get('/', async (req, res) => {
  const pilados = await prisma.pilado.findMany({
    include: { operario: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(pilados);
});

// POST /api/pilados
router.post('/', async (req, res) => {
  const { operarioId, qqEntrada, rendimiento, nota } = req.body;
  const qqSalida = qqEntrada * rendimiento;

  const pilado = await prisma.pilado.create({
    data: { operarioId, qqEntrada, rendimiento, qqSalida, nota },
    include: { operario: true },
  });
  res.status(201).json(pilado);
});

module.exports = router;
