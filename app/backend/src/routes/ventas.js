const router = require('express').Router();
const prisma  = require('../prisma');
const { validateVenta }  = require('../middleware/validators');
const { registrar }      = require('../services/bitacoraService');
const { requireRol }     = require('../middleware/permisos');

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

// ─── GET /api/ventas/:id/ticket — Datos completos para imprimir ticket ────────
router.get('/:id/ticket', requireRol('ADMIN', 'VENDEDOR'), async (req, res) => {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        detalles: { include: { producto: true } },
        usuario:  { select: { nombre: true } },
      },
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    // Obtener parámetros de la empresa
    const params = await prisma.parametro.findMany({
      where: { clave: { in: ['nombre_empresa', 'ruc_empresa', 'direccion_empresa', 'telefono_empresa', 'itbms_porcentaje'] } },
    });
    const empresa = Object.fromEntries(params.map(p => [p.clave, p.valor]));

    res.json({ venta, empresa });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener datos del ticket' });
  }
});

// ─── POST /api/ventas/:id/factura — Asignar número correlativo de factura ─────
// Solo ADMIN
router.post('/:id/factura', requireRol('ADMIN'), async (req, res) => {
  try {
    const { clienteNombre, clienteRuc, clienteDireccion, aplicaITBMS } = req.body;
    const ventaId = Number(req.params.id);

    // Verificar que la venta existe y no tiene factura aún
    const venta = await prisma.venta.findUnique({ where: { id: ventaId } });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    if (venta.facturaNum) {
      return res.status(409).json({ error: 'Esta venta ya tiene factura asignada', facturaNum: venta.facturaNum });
    }

    // Incrementar correlativo y actualizar la venta en una sola transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const param    = await tx.parametro.findUnique({ where: { clave: 'ultimo_num_factura' } });
      const nuevoNum = (parseInt(param?.valor) || 0) + 1;

      await tx.parametro.update({
        where: { clave: 'ultimo_num_factura' },
        data:  { valor: String(nuevoNum) },
      });

      const ventaActualizada = await tx.venta.update({
        where: { id: ventaId },
        data: {
          facturaNum:       nuevoNum,
          cliente:          clienteNombre  || venta.cliente,
          clienteRuc:       clienteRuc     || null,
          clienteDireccion: clienteDireccion || null,
          aplicaITBMS:      aplicaITBMS === true,
        },
        include: {
          detalles: { include: { producto: true } },
          usuario:  { select: { nombre: true } },
        },
      });

      return { ventaActualizada, nuevoNum };
    });

    registrar({
      usuarioId: req.usuario.id,
      nombre:    req.usuario.nombre,
      modulo:    'venta',
      accion:    'factura',
      detalle:   { ventaId, facturaNum: resultado.nuevoNum },
      ip:        req.ip,
    });

    res.status(201).json(resultado.ventaActualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar factura' });
  }
});

// ─── GET /api/ventas/:id/factura — Datos completos para imprimir factura ──────
router.get('/:id/factura', requireRol('ADMIN', 'VENDEDOR'), async (req, res) => {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        detalles: { include: { producto: true } },
        usuario:  { select: { nombre: true } },
      },
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    if (!venta.facturaNum) return res.status(404).json({ error: 'Esta venta no tiene factura generada' });

    const params = await prisma.parametro.findMany({
      where: { clave: { in: ['nombre_empresa', 'ruc_empresa', 'direccion_empresa', 'telefono_empresa', 'itbms_porcentaje'] } },
    });
    const empresa = Object.fromEntries(params.map(p => [p.clave, p.valor]));

    // Calcular montos con/sin ITBMS
    const subtotal     = venta.total;
    const itbmsPct     = parseFloat(empresa.itbms_porcentaje || '7') / 100;
    const itbmsMonto   = venta.aplicaITBMS ? parseFloat((subtotal * itbmsPct).toFixed(2)) : 0;
    const totalConITBMS = parseFloat((subtotal + itbmsMonto).toFixed(2));

    res.json({ venta, empresa, subtotal, itbmsMonto, totalConITBMS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener factura' });
  }
});

module.exports = router;
