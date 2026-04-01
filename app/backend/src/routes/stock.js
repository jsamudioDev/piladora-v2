const router = require('express').Router();
const prisma = require('../prisma');
const { validateProducto, validateMovimiento } = require('../middleware/validators');

// GET /api/stock — todos los productos
router.get('/', async (req, res) => {
  try {
    const productos = await prisma.producto.findMany({
      orderBy: { nombre: 'asc' },
    });
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stock/alertas — productos donde stockActual <= stockMinimo
router.get('/alertas', async (req, res) => {
  try {
    const alertas = await prisma.$queryRaw`
      SELECT * FROM Producto WHERE stockActual <= stockMinimo ORDER BY nombre ASC
    `;
    res.json(alertas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stock/productos — crear producto
// validateProducto: nombre y unidad no vacíos, stockMinimo >= 0
router.post('/productos', validateProducto, async (req, res) => {
  try {
    const { nombre, unidad, stockActual, stockLocal, stockMinimo, ubicacion, categoria } = req.body;
    const producto = await prisma.producto.create({
      data: {
        nombre,
        unidad,
        stockActual: Number(stockActual) || 0,
        stockLocal:  Number(stockLocal)  || 0,
        stockMinimo: Number(stockMinimo) || 0,
        ubicacion:   ubicacion  || 'piladora',
        categoria:   categoria  || 'grano',
      },
    });
    res.status(201).json(producto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/stock/productos/:id — actualizar producto
// validateProducto: nombre y unidad no vacíos, stockMinimo >= 0
router.put('/productos/:id', validateProducto, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, unidad, stockActual, stockLocal, stockMinimo, ubicacion, categoria } = req.body;
    const producto = await prisma.producto.update({
      where: { id },
      data: {
        ...(nombre      !== undefined && { nombre }),
        ...(unidad      !== undefined && { unidad }),
        ...(stockActual !== undefined && { stockActual: Number(stockActual) }),
        ...(stockLocal  !== undefined && { stockLocal:  Number(stockLocal) }),
        ...(stockMinimo !== undefined && { stockMinimo: Number(stockMinimo) }),
        ...(ubicacion   !== undefined && { ubicacion }),
        ...(categoria   !== undefined && { categoria }),
      },
    });
    res.json(producto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stock/movimiento — registrar entrada o salida
// validateMovimiento: productoId entero, tipo ENTRADA/SALIDA, cantidad > 0
router.post('/movimiento', validateMovimiento, async (req, res) => {
  try {
    const { productoId, tipo, cantidad, motivo } = req.body;
    if (!['ENTRADA', 'SALIDA'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser ENTRADA o SALIDA' });
    }
    const delta = tipo === 'ENTRADA' ? Number(cantidad) : -Number(cantidad);

    const [movimiento] = await prisma.$transaction([
      prisma.stockMovimiento.create({
        data: { productoId: Number(productoId), tipo, cantidad: Number(cantidad), motivo },
      }),
      prisma.producto.update({
        where: { id: Number(productoId) },
        data:  { stockActual: { increment: delta } },
      }),
    ]);
    res.status(201).json(movimiento);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
