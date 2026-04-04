const router = require('express').Router();
const prisma  = require('../prisma');
const { validateVenta }  = require('../middleware/validators');
const { registrar }      = require('../services/bitacoraService');
const { requireRol }     = require('../middleware/permisos');
const { enviarFactura, generarHTMLFactura } = require('../services/emailService');

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

// ─── PUT /api/ventas/:id/editar — editar datos del ticket/factura ─────────────
// Permite corregir: cliente, nota, clienteRuc, clienteDireccion (no modifica total ni detalles)
router.put('/:id/editar', requireRol('ADMIN'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { cliente, nota, clienteRuc, clienteDireccion } = req.body;

    const data = {};
    if (cliente          !== undefined) data.cliente          = cliente?.trim()          || null;
    if (nota             !== undefined) data.nota             = nota?.trim()             || null;
    if (clienteRuc       !== undefined) data.clienteRuc       = clienteRuc?.trim()       || null;
    if (clienteDireccion !== undefined) data.clienteDireccion = clienteDireccion?.trim() || null;

    const venta = await prisma.venta.update({
      where:   { id },
      data,
      include: { detalles: { include: { producto: true } } },
    });

    // Si hay crédito asociado y cambió el nombre del cliente, sincronizar
    if (venta.creditoId && cliente !== undefined) {
      await prisma.credito.update({
        where: { id: venta.creditoId },
        data:  { clienteNombre: cliente?.trim() || 'Cliente' },
      });
    }

    registrar({ usuarioId: req.usuario?.id, nombre: req.usuario?.nombre, modulo: 'venta', accion: 'editar', detalle: { ventaId: id, cambios: Object.keys(data) }, ip: req.ip });
    res.json(venta);
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

    // Obtener todos los parámetros de la empresa (incluye dv_empresa, email_empresa)
    const params = await prisma.parametro.findMany({
      where: { clave: { in: ['nombre_empresa', 'ruc_empresa', 'dv_empresa', 'direccion_empresa', 'telefono_empresa', 'email_empresa', 'itbms_porcentaje'] } },
    });
    const empresa = Object.fromEntries(params.map(p => [p.clave, p.valor]));

    res.json({ venta, empresa });
  } catch (err) {
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
      where: { clave: { in: ['nombre_empresa', 'ruc_empresa', 'dv_empresa', 'direccion_empresa', 'telefono_empresa', 'email_empresa', 'itbms_porcentaje'] } },
    });
    const empresa = Object.fromEntries(params.map(p => [p.clave, p.valor]));

    // Si aplicaITBMS, el total ya incluye el impuesto (precio con IVA)
    // → base = total / (1 + pct)
    const itbmsPct      = parseFloat(empresa.itbms_porcentaje || '7') / 100;
    const baseImponible = venta.aplicaITBMS
      ? parseFloat((venta.total / (1 + itbmsPct)).toFixed(2))
      : venta.total;
    const itbmsMonto    = venta.aplicaITBMS
      ? parseFloat((venta.total - baseImponible).toFixed(2))
      : 0;

    res.json({ venta, empresa, baseImponible, itbmsMonto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener factura' });
  }
});

// ─── POST /api/ventas/:id/factura/email — Enviar factura por correo ───────────
// Requiere que la venta ya tenga facturaNum. Usa SMTP configurado en Parametros.
router.post('/:id/factura/email', requireRol('ADMIN'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { emailDestinatario } = req.body;

    if (!emailDestinatario || !emailDestinatario.includes('@')) {
      return res.status(400).json({ error: 'Correo electrónico inválido' });
    }

    const venta = await prisma.venta.findUnique({
      where: { id },
      include: {
        detalles: { include: { producto: true } },
        usuario:  { select: { nombre: true } },
      },
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    if (!venta.facturaNum) {
      return res.status(400).json({ error: 'Esta venta no tiene factura generada. Genera la factura primero.' });
    }

    // Obtener todos los parámetros (necesarios para el HTML y el SMTP)
    const params  = await prisma.parametro.findMany();
    const empresa = Object.fromEntries(params.map(p => [p.clave, p.valor]));

    const html = generarHTMLFactura(venta, empresa);

    await enviarFactura({
      destinatario: emailDestinatario,
      asunto: `Factura F-${String(venta.facturaNum).padStart(4, '0')} — ${empresa.nombre_empresa || 'Piladora'}`,
      html,
    });

    registrar({ usuarioId: req.usuario?.id, nombre: req.usuario?.nombre, modulo: 'venta', accion: 'email_factura', detalle: { ventaId: id, facturaNum: venta.facturaNum, destinatario: emailDestinatario }, ip: req.ip });
    res.json({ ok: true, mensaje: `Factura enviada a ${emailDestinatario}` });
  } catch (err) {
    // Error descriptivo si el SMTP no está configurado o falla autenticación
    if (err.message.includes('SMTP') || err.message.includes('auth') || err.message.includes('connect') || err.message.includes('configurado')) {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
