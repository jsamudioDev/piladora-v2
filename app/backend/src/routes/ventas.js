const router = require('express').Router();
const prisma  = require('../prisma');
const { validateVenta }  = require('../middleware/validators');
const { registrar }      = require('../services/bitacoraService');

// ── Helpers ────────────────────────────────────────────────────────────────────
function hoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/ventas — paginadas, limit=20
router.get('/', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const page  = Number(req.query.page)  || 1;
    const ventas = await prisma.venta.findMany({
      take: limit,
      skip: (page - 1) * limit,
      include: { detalles: { include: { producto: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ventas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ventas/hoy — ventas del día
router.get('/hoy', async (req, res) => {
  try {
    const ventas = await prisma.venta.findMany({
      where: { createdAt: { gte: hoy() } },
      include: { detalles: { include: { producto: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ventas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ventas — crear venta
// validateVenta: total > 0, metodoPago no vacío, detalles array con al menos 1 item
router.post('/', validateVenta, async (req, res) => {
  try {
    const { metodoPago, nota, cliente, ubicacion = 'piladora', detalles } = req.body;

    if (!detalles || detalles.length === 0)
      return res.status(400).json({ error: 'El carrito está vacío' });

    const stockField = ubicacion === 'local' ? 'stockLocal' : 'stockActual';

    // Validar stock disponible para cada producto
    for (const d of detalles) {
      const prod = await prisma.producto.findUnique({ where: { id: d.productoId } });
      if (!prod) return res.status(404).json({ error: `Producto ${d.productoId} no encontrado` });
      if (prod[stockField] < d.cantidad)
        return res.status(400).json({
          error: `Stock insuficiente para "${prod.nombre}". Disponible: ${prod[stockField]}`,
        });
    }

    // Calcular subtotales y total
    const detallesCalc = detalles.map(d => ({
      productoId: d.productoId,
      cantidad:   Number(d.cantidad),
      precioUnit: Number(d.precioUnit),
      subtotal:   Number(d.cantidad) * Number(d.precioUnit),
    }));
    const total = detallesCalc.reduce((s, d) => s + d.subtotal, 0);

    // Crear venta en transacción.
    // Si el método de pago es CREDITO:
    //   - Se crea la venta normalmente
    //   - Se crea un registro Credito con el monto total como saldo pendiente
    //   - NO se crea Ingreso (el ingreso se genera cuando el cliente abona)
    // Para cualquier otro método de pago, se crea el Ingreso de inmediato.
    const result = await prisma.$transaction(async (tx) => {
      const venta = await tx.venta.create({
        data: {
          total, metodoPago, nota: nota || null,
          cliente: cliente || null, ubicacion,
          detalles: { create: detallesCalc },
        },
        include: { detalles: { include: { producto: true } } },
      });

      if (metodoPago === 'CREDITO') {
        // Crear crédito asociado a esta venta
        const credito = await tx.credito.create({
          data: {
            clienteNombre: cliente || 'Cliente',
            montoTotal:    total,
            saldo:         total,
            ventaId:       venta.id,
          },
        });
        // Guardar creditoId en la venta para referencia
        await tx.venta.update({ where: { id: venta.id }, data: { creditoId: credito.id } });
      } else {
        // Venta de contado: crear ingreso de inmediato
        const ingreso = await tx.ingreso.create({
          data: {
            monto:       total,
            descripcion: `Venta #${venta.id}${cliente ? ` — ${cliente}` : ''}`,
            categoria:   'Venta',
            ventaId:     venta.id,
          },
        });
        await tx.venta.update({ where: { id: venta.id }, data: { ingresoId: ingreso.id } });
      }

      // Descontar stock (siempre, independientemente del método de pago)
      for (const d of detallesCalc) {
        await tx.producto.update({
          where: { id: d.productoId },
          data:  { [stockField]: { decrement: d.cantidad } },
        });
      }

      return venta;
    });

    registrar({ usuarioId: req.usuario?.id, nombre: req.usuario?.nombre, modulo: 'venta', accion: 'crear', detalle: { ventaId: result.id, total: result.total }, ip: req.ip });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ventas/:id — anular venta
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const venta = await prisma.venta.findUnique({
      where: { id },
      include: { detalles: true },
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const stockField = venta.ubicacion === 'local' ? 'stockLocal' : 'stockActual';

    await prisma.$transaction(async (tx) => {
      // Restaurar stock
      for (const d of venta.detalles) {
        await tx.producto.update({
          where: { id: d.productoId },
          data:  { [stockField]: { increment: d.cantidad } },
        });
      }
      // Eliminar detalles, venta e ingreso asociado
      await tx.detalleVenta.deleteMany({ where: { ventaId: id } });
      await tx.venta.delete({ where: { id } });
      if (venta.ingresoId) await tx.ingreso.delete({ where: { id: venta.ingresoId } }).catch(() => {});
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
