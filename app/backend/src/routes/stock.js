const router = require('express').Router();
const prisma = require('../prisma');

// GET /api/stock — todos los productos con stock
router.get('/', async (req, res) => {
  const productos = await prisma.producto.findMany({ orderBy: { nombre: 'asc' } });
  res.json(productos);
});

// POST /api/stock/productos — crear producto
router.post('/productos', async (req, res) => {
  const { nombre, unidad, stockMinimo } = req.body;
  const producto = await prisma.producto.create({ data: { nombre, unidad, stockMinimo } });
  res.status(201).json(producto);
});

// POST /api/stock/movimiento — registrar entrada o salida
router.post('/movimiento', async (req, res) => {
  const { productoId, tipo, cantidad, motivo } = req.body;
  const delta = tipo === 'ENTRADA' ? cantidad : -cantidad;

  const [movimiento] = await prisma.$transaction([
    prisma.stockMovimiento.create({ data: { productoId, tipo, cantidad, motivo } }),
    prisma.producto.update({
      where: { id: productoId },
      data: { stockActual: { increment: delta } },
    }),
  ]);
  res.status(201).json(movimiento);
});

module.exports = router;
