const router = require('express').Router();
const prisma  = require('../prisma');
const { validateProducto, validateMovimiento } = require('../middleware/validators');

// ─── GET /api/stock — listar productos filtrados por rol ─────────────────────
// ADMIN    → todos los productos
// OPERARIO → solo productos de la piladora (ubicacion='piladora')
// VENDEDOR → solo productos del local      (ubicacion='local')
router.get('/', async (req, res) => {
  try {
    const rol = req.usuario.rol;

    // Construir filtro de ubicación según rol
    const where = {};
    if (rol === 'OPERARIO') where.ubicacion = 'piladora';
    if (rol === 'VENDEDOR') where.ubicacion = 'local';
    // ADMIN: where queda vacío → devuelve todos

    const productos = await prisma.producto.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });

    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/stock/movimientos — historial de movimientos (últimos 50) ──────
router.get('/movimientos', async (req, res) => {
  try {
    const movimientos = await prisma.stockMovimiento.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        producto: { select: { nombre: true, unidad: true } },
      },
    });
    res.json(movimientos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/stock/alertas — productos con stock bajo ───────────────────────
// Solo accesible por ADMIN (el panel es ADMIN-only y es quien usa alertas)
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

// ─── POST /api/stock/productos — crear producto ───────────────────────────────
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

// ─── PUT /api/stock/productos/:id — actualizar producto ───────────────────────
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

// ─── POST /api/stock/movimiento — registrar entrada o salida ──────────────────
// validateMovimiento: productoId entero, tipo ENTRADA/SALIDA, cantidad > 0
// Restricción por rol: OPERARIO solo puede mover productos de 'piladora',
//                      VENDEDOR solo puede mover productos de 'local'.
router.post('/movimiento', validateMovimiento, async (req, res) => {
  try {
    const { productoId, tipo, cantidad, motivo } = req.body;
    const rol = req.usuario.rol;

    if (!['ENTRADA', 'SALIDA'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser ENTRADA o SALIDA' });
    }

    // Verificar que el producto exista y obtener su ubicación
    const producto = await prisma.producto.findUnique({
      where: { id: Number(productoId) },
      select: { id: true, ubicacion: true },
    });

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Verificar que el rol tenga permiso sobre la ubicación del producto
    if (rol === 'OPERARIO' && producto.ubicacion !== 'piladora') {
      return res.status(403).json({ error: 'Operario solo puede mover stock de la piladora' });
    }
    if (rol === 'VENDEDOR' && producto.ubicacion !== 'local') {
      return res.status(403).json({ error: 'Vendedor solo puede mover stock del local' });
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
