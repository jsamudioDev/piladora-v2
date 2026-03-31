const router = require('express').Router();
const prisma = require('../prisma');

// GET /api/ventas — listar ventas
router.get('/', async (req, res) => {
  const ventas = await prisma.venta.findMany({
    include: { detalles: { include: { producto: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(ventas);
});

// GET /api/ventas/:id
router.get('/:id', async (req, res) => {
  const venta = await prisma.venta.findUnique({
    where: { id: Number(req.params.id) },
    include: { detalles: { include: { producto: true } } },
  });
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json(venta);
});

// POST /api/ventas — crear venta con detalles
router.post('/', async (req, res) => {
  const { metodoPago, nota, detalles } = req.body;
  const total = detalles.reduce((sum, d) => sum + d.subtotal, 0);

  const venta = await prisma.venta.create({
    data: {
      total,
      metodoPago,
      nota,
      detalles: {
        create: detalles.map((d) => ({
          productoId: d.productoId,
          cantidad: d.cantidad,
          precioUnit: d.precioUnit,
          subtotal: d.subtotal,
        })),
      },
    },
    include: { detalles: true },
  });
  res.status(201).json(venta);
});

module.exports = router;
