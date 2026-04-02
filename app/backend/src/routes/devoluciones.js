// ─── Rutas de devoluciones ────────────────────────────────────────────────────
const router = require('express').Router();
const prisma  = require('../prisma');
const { registrar } = require('../services/bitacoraService');

// GET /api/devoluciones — Últimas 30 devoluciones con detalles, producto y cliente
router.get('/', async (req, res) => {
  try {
    const devoluciones = await prisma.devolucion.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: {
        detalles: {
          include: {
            producto: { select: { nombre: true, unidad: true } },
          },
        },
      },
    });
    res.json(devoluciones);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/devoluciones/:id — Detalle completo de una devolución
router.get('/:id', async (req, res) => {
  try {
    const dev = await prisma.devolucion.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        detalles: {
          include: {
            producto: { select: { nombre: true, unidad: true } },
          },
        },
      },
    });
    if (!dev) return res.status(404).json({ error: 'Devolución no encontrada' });
    res.json(dev);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/devoluciones — Registrar devolución
// Body: { ventaId, motivo, detalles: [{ productoId, cantidad, precioUnit }] }
router.post('/', async (req, res) => {
  const { ventaId, motivo, detalles } = req.body;

  if (!ventaId || !motivo || !Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ error: 'ventaId, motivo y detalles son requeridos' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Verificar que la venta existe con sus detalles originales
      const venta = await tx.venta.findUnique({
        where: { id: Number(ventaId) },
        include: { detalles: true },
      });
      if (!venta) throw new Error('Venta no encontrada');

      // 2. Indexar detalles originales por productoId para validar cantidades
      const originales = {};
      for (const d of venta.detalles) {
        originales[d.productoId] = d;
      }

      // 3. Validar que cada ítem a devolver exista en la venta y no supere lo vendido
      for (const item of detalles) {
        const original = originales[item.productoId];
        if (!original) {
          throw new Error(`Producto ${item.productoId} no pertenece a esta venta`);
        }
        if (Number(item.cantidad) <= 0) {
          throw new Error('La cantidad debe ser mayor a 0');
        }
        if (Number(item.cantidad) > original.cantidad) {
          throw new Error(
            `Cantidad a devolver (${item.cantidad}) supera lo vendido (${original.cantidad})`
          );
        }
      }

      // 4. Calcular total devuelto
      const totalDevuelto = detalles.reduce(
        (s, i) => s + Number(i.cantidad) * Number(i.precioUnit),
        0
      );

      // 5. Crear registro principal de devolución
      const devolucion = await tx.devolucion.create({
        data: { ventaId: Number(ventaId), totalDevuelto, motivo },
      });

      // 6. Crear cada DetalleDevolucion y reintegrar stock por ubicación de la venta
      for (const item of detalles) {
        await tx.detalleDevolucion.create({
          data: {
            devolucionId: devolucion.id,
            productoId:   Number(item.productoId),
            cantidad:     Number(item.cantidad),
            precioUnit:   Number(item.precioUnit),
            ubicacion:    venta.ubicacion, // hereda la ubicación donde se realizó la venta
          },
        });

        // 7. Reintegrar stock según la ubicación de la venta original
        if (venta.ubicacion === 'local') {
          await tx.producto.update({
            where: { id: Number(item.productoId) },
            data:  { stockLocal: { increment: Number(item.cantidad) } },
          });
        } else {
          // piladora o cualquier otro valor por defecto
          await tx.producto.update({
            where: { id: Number(item.productoId) },
            data:  { stockActual: { increment: Number(item.cantidad) } },
          });
        }
      }

      // 8. Si la venta era a CRÉDITO, reducir el saldo del crédito
      if (venta.metodoPago === 'CREDITO' && venta.creditoId) {
        const credito = await tx.credito.findUnique({ where: { id: venta.creditoId } });
        if (credito) {
          const nuevoTotal = credito.montoTotal - totalDevuelto;
          const nuevoSaldo = nuevoTotal - credito.montoPagado;
          await tx.credito.update({
            where: { id: venta.creditoId },
            data: {
              montoTotal: nuevoTotal,
              saldo:      nuevoSaldo <= 0 ? 0 : nuevoSaldo,
              estado:     nuevoSaldo <= 0 ? 'PAGADO' : credito.estado,
            },
          });
        }
      }

      // 9. Si no era crédito, registrar egreso por el dinero que se devuelve al cliente
      if (venta.metodoPago !== 'CREDITO') {
        await tx.egreso.create({
          data: {
            monto:       totalDevuelto,
            descripcion: `Devolución venta #${ventaId}`,
            categoria:   'devolucion',
          },
        });
      }

      return devolucion;
    });

    registrar({ usuarioId: req.usuario?.id, nombre: req.usuario?.nombre, modulo: 'devoluciones', accion: 'devolucion', detalle: { devolucionId: resultado.id, ventaId: Number(ventaId) }, ip: req.ip });
    res.status(201).json(resultado);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
