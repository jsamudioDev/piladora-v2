// ─── Rutas de traspasos ────────────────────────────────────────────────────────
// Un traspaso mueve stock entre Piladora y Local (o viceversa).
const router = require('express').Router();
const prisma  = require('../prisma');

const UBICACIONES_VALIDAS = ['piladora', 'local'];

// GET /api/traspasos — Últimos 30 traspasos con nombre de producto
router.get('/', async (req, res) => {
  try {
    const traspasos = await prisma.traspaso.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: {
        producto: { select: { nombre: true, unidad: true } },
      },
    });
    res.json(traspasos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/traspasos — Registrar traspaso
// Body: { productoId, cantidad, origen, destino, motivo }
router.post('/', async (req, res) => {
  const { productoId, cantidad, origen, destino, motivo } = req.body;

  if (!productoId || !cantidad || !origen || !destino) {
    return res.status(400).json({ error: 'productoId, cantidad, origen y destino son requeridos' });
  }

  // 1. Validar que origen y destino sean distintos y válidos
  if (origen === destino) {
    return res.status(400).json({ error: 'El origen y destino deben ser distintos' });
  }
  if (!UBICACIONES_VALIDAS.includes(origen) || !UBICACIONES_VALIDAS.includes(destino)) {
    return res.status(400).json({ error: 'origen y destino deben ser "piladora" o "local"' });
  }
  if (Number(cantidad) <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 2. Obtener el producto
      const producto = await tx.producto.findUnique({ where: { id: Number(productoId) } });
      if (!producto) throw new Error('Producto no encontrado');

      // 3. Verificar que hay stock suficiente en el origen
      const stockOrigen = origen === 'local' ? producto.stockLocal : producto.stockActual;
      if (stockOrigen < Number(cantidad)) {
        throw new Error(
          `Stock insuficiente en ${origen}. Disponible: ${stockOrigen} ${producto.unidad}`
        );
      }

      // 4. Actualizar stock: descontar del origen y agregar al destino
      const updateData =
        origen === 'piladora'
          ? { stockActual: { decrement: Number(cantidad) }, stockLocal: { increment: Number(cantidad) } }
          : { stockLocal: { decrement: Number(cantidad) }, stockActual: { increment: Number(cantidad) } };

      await tx.producto.update({ where: { id: Number(productoId) }, data: updateData });

      // 5. Registrar dos movimientos de stock: SALIDA del origen y ENTRADA al destino
      const motivoBase = motivo ? motivo.trim() : null;
      await tx.stockMovimiento.createMany({
        data: [
          {
            productoId: Number(productoId),
            tipo:       'SALIDA',
            cantidad:   Number(cantidad),
            motivo:     motivoBase ? `Traspaso a ${destino}: ${motivoBase}` : `Traspaso a ${destino}`,
            ubicacion:  origen,
          },
          {
            productoId: Number(productoId),
            tipo:       'ENTRADA',
            cantidad:   Number(cantidad),
            motivo:     motivoBase ? `Traspaso desde ${origen}: ${motivoBase}` : `Traspaso desde ${origen}`,
            ubicacion:  destino,
          },
        ],
      });

      // 6. Crear registro de traspaso
      const traspaso = await tx.traspaso.create({
        data: {
          productoId: Number(productoId),
          cantidad:   Number(cantidad),
          origen,
          destino,
          motivo:     motivoBase,
        },
      });

      return traspaso;
    });

    res.status(201).json(resultado);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
