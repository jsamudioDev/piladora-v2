const router = require('express').Router();
const prisma  = require('../prisma');
const { validateProducto, validateMovimiento } = require('../middleware/validators');
const { registrar } = require('../services/bitacoraService');

// ─── GET /api/stock — listar productos filtrados por rol ─────────────────────
// ADMIN    → todos los productos
// OPERARIO → solo productos de la piladora (ubicacion='piladora')
// VENDEDOR → solo productos del local      (ubicacion='local')
router.get('/', async (req, res) => {
  try {
    const rol = req.usuario.rol;

    const where = {};
    if (rol === 'OPERARIO') where.ubicacion = 'piladora';
    if (rol === 'VENDEDOR') where.ubicacion = 'local';

    const productos = await prisma.producto.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });

    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/stock/movimientos — historial de movimientos (últimos 100) ──────
router.get('/movimientos', async (req, res) => {
  try {
    const movimientos = await prisma.stockMovimiento.findMany({
      take: 100,
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
// NUEVO: acepta campo opcional 'ubicacion' en el body para indicar en cuál
// de los dos stocks (stockActual=piladora | stockLocal=local) se registra
// el movimiento. Si no se envía, usa la ubicación principal del producto.
//
// Restricciones de rol:
//   ADMIN    → puede especificar cualquier ubicacion
//   OPERARIO → siempre usa 'piladora'
//   VENDEDOR → siempre usa 'local'
router.post('/movimiento', validateMovimiento, async (req, res) => {
  try {
    const { productoId, tipo, cantidad, motivo, ubicacion: ubicacionBody } = req.body;
    const rol = req.usuario.rol;

    if (!['ENTRADA', 'SALIDA'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser ENTRADA o SALIDA' });
    }

    // Verificar que el producto exista
    const producto = await prisma.producto.findUnique({
      where:  { id: Number(productoId) },
      select: { id: true, ubicacion: true, stockActual: true, stockLocal: true },
    });

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Determinar la ubicación final del movimiento
    // ADMIN puede enviar 'piladora' o 'local'; OPERARIO y VENDEDOR tienen ubicación fija.
    let ubicacionFinal;
    if (rol === 'ADMIN') {
      // El admin puede elegir; si no envía, usa la ubicación principal del producto
      ubicacionFinal = ubicacionBody || producto.ubicacion;
    } else if (rol === 'OPERARIO') {
      ubicacionFinal = 'piladora';
    } else {
      ubicacionFinal = 'local';
    }

    // Validar que la ubicación sea válida
    if (!['piladora', 'local'].includes(ubicacionFinal)) {
      return res.status(400).json({ error: 'ubicacion debe ser "piladora" o "local"' });
    }

    // El campo de stock que se actualiza depende de la ubicación
    const stockField = ubicacionFinal === 'local' ? 'stockLocal' : 'stockActual';
    const delta      = tipo === 'ENTRADA' ? Number(cantidad) : -Number(cantidad);

    // Verificar stock suficiente en salidas
    if (tipo === 'SALIDA') {
      const stockDisponible = producto[stockField];
      if (stockDisponible < Number(cantidad)) {
        return res.status(400).json({
          error: `Stock insuficiente en ${ubicacionFinal}. Disponible: ${stockDisponible}`,
        });
      }
    }

    const [movimiento] = await prisma.$transaction([
      // Registrar el movimiento con la ubicación que se afectó
      prisma.stockMovimiento.create({
        data: {
          productoId: Number(productoId),
          tipo,
          cantidad:  Number(cantidad),
          motivo:    motivo || null,
          ubicacion: ubicacionFinal,
        },
      }),
      // Actualizar el campo correcto de stock
      prisma.producto.update({
        where: { id: Number(productoId) },
        data:  { [stockField]: { increment: delta } },
      }),
    ]);

    registrar({
      usuarioId: req.usuario?.id,
      nombre:    req.usuario?.nombre,
      modulo:    'stock',
      accion:    'movimiento',
      detalle:   { tipo, productoId: Number(productoId), cantidad: Number(cantidad), ubicacion: ubicacionFinal },
      ip:        req.ip,
    });

    res.status(201).json(movimiento);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
