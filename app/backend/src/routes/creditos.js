// ─── Rutas de créditos y abonos ───────────────────────────────────────────────
const router = require('express').Router();
const prisma  = require('../prisma');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { registrar } = require('../services/bitacoraService');

// Todas las rutas requieren token JWT válido
router.use(authMiddleware);

// ─── GET /api/creditos — listar créditos con filtro opcional por estado ───────
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;

    const where = {};
    if (estado && ['PENDIENTE', 'PAGADO', 'VENCIDO'].includes(estado)) {
      where.estado = estado;
    }

    const creditos = await prisma.credito.findMany({
      where,
      include: {
        abonos: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(creditos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/creditos/resumen — totales para el Panel ───────────────────────
router.get('/resumen', async (req, res) => {
  try {
    const hace7dias = new Date();
    hace7dias.setDate(hace7dias.getDate() - 7);

    const [pendientes, vencidos, totalPendienteAgg] = await Promise.all([
      prisma.credito.count({
        where: { estado: { in: ['PENDIENTE', 'VENCIDO'] } },
      }),
      prisma.credito.count({
        where: {
          estado:    { in: ['PENDIENTE', 'VENCIDO'] },
          createdAt: { lt: hace7dias },
        },
      }),
      prisma.credito.aggregate({
        where: { estado: { in: ['PENDIENTE', 'VENCIDO'] } },
        _sum:  { saldo: true },
      }),
    ]);

    res.json({
      activos:        pendientes,
      vencidos:       vencidos,
      totalPendiente: Number(totalPendienteAgg._sum.saldo) || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/creditos/:id — detalle con abonos ───────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const credito = await prisma.credito.findUnique({
      where: { id },
      include: {
        abonos: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!credito) return res.status(404).json({ error: 'Crédito no encontrado' });

    res.json(credito);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/creditos — crear crédito manualmente (sin venta asociada) ─────
router.post('/', async (req, res) => {
  try {
    const { clienteNombre, clienteTel, clienteCedula, montoTotal, nota, fechaVencimiento } = req.body;

    if (!clienteNombre || !clienteNombre.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }
    if (!montoTotal || Number(montoTotal) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const credito = await prisma.credito.create({
      data: {
        clienteNombre:    clienteNombre.trim(),
        clienteTel:       clienteTel?.trim()    || null,
        clienteCedula:    clienteCedula?.trim()  || null,
        montoTotal:       Number(montoTotal),
        saldo:            Number(montoTotal),
        nota:             nota?.trim() || null,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      },
    });

    registrar({
      usuarioId: req.usuario?.id,
      nombre:    req.usuario?.nombre,
      modulo:    'creditos',
      accion:    'crear',
      detalle:   { creditoId: credito.id, clienteNombre: credito.clienteNombre, total: credito.montoTotal },
      ip:        req.ip,
    });

    res.status(201).json(credito);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/creditos/:id — actualizar datos del crédito ────────────────────
// Permite editar: nota, estado, clienteNombre, clienteTel, clienteCedula, fechaVencimiento
// Solo ADMIN puede cambiar estado a VENCIDO manualmente
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nota, estado, clienteNombre, clienteTel, clienteCedula, fechaVencimiento } = req.body;

    if (estado === 'VENCIDO' && req.usuario?.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el administrador puede marcar créditos como vencidos' });
    }

    const data = {};
    if (nota             !== undefined) data.nota             = nota?.trim() || null;
    if (clienteNombre    !== undefined) data.clienteNombre    = clienteNombre.trim() || 'Cliente';
    if (clienteTel       !== undefined) data.clienteTel       = clienteTel?.trim()    || null;
    if (clienteCedula    !== undefined) data.clienteCedula    = clienteCedula?.trim()  || null;
    if (fechaVencimiento !== undefined) {
      data.fechaVencimiento = fechaVencimiento ? new Date(fechaVencimiento) : null;
    }
    if (estado !== undefined) {
      if (!['PENDIENTE', 'PAGADO', 'VENCIDO'].includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }
      data.estado = estado;
    }

    const credito = await prisma.credito.update({
      where: { id },
      data,
      include: { abonos: { orderBy: { createdAt: 'asc' } } },
    });

    registrar({
      usuarioId: req.usuario?.id,
      nombre:    req.usuario?.nombre,
      modulo:    'creditos',
      accion:    'editar',
      detalle:   { creditoId: id, cambios: Object.keys(data) },
      ip:        req.ip,
    });

    res.json(credito);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/creditos/:id/abono — registrar un abono ───────────────────────
// Transacción atómica:
//   1. Crear Abono
//   2. Recalcular montoPagado = suma de todos los abonos
//   3. Actualizar saldo = montoTotal - montoPagado
//   4. Si saldo <= 0 → estado = PAGADO
//   5. Crear Ingreso automático en módulo Dinero
router.post('/:id/abono', async (req, res) => {
  try {
    const creditoId = Number(req.params.id);
    const { monto, metodoPago, referencia, nota } = req.body;

    if (!monto || Number(monto) <= 0) {
      return res.status(400).json({ error: 'El monto del abono debe ser mayor a 0' });
    }
    const metodosValidos = ['EFECTIVO', 'YAPPY', 'TRANSFERENCIA', 'CHEQUE'];
    if (metodoPago && !metodosValidos.includes(metodoPago)) {
      return res.status(400).json({ error: 'Método de pago inválido' });
    }

    const credito = await prisma.credito.findUnique({ where: { id: creditoId } });
    if (!credito) return res.status(404).json({ error: 'Crédito no encontrado' });
    if (credito.estado === 'PAGADO') {
      return res.status(400).json({ error: 'Este crédito ya está pagado' });
    }
    // Tolerancia de 1 centavo para evitar errores de redondeo
    if (Number(monto) > credito.saldo + 0.01) {
      return res.status(400).json({
        error: `El abono ($${Number(monto).toFixed(2)}) supera el saldo pendiente ($${credito.saldo.toFixed(2)})`,
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const abono = await tx.abono.create({
        data: {
          creditoId,
          monto:      Number(monto),
          metodoPago: metodoPago || 'EFECTIVO',
          referencia: referencia?.trim() || null,
          nota:       nota?.trim() || null,
          usuarioId:  req.usuario?.id || null,
        },
      });

      const agg = await tx.abono.aggregate({
        where: { creditoId },
        _sum:  { monto: true },
      });
      const montoPagado = Number(agg._sum.monto) || 0;
      const nuevoSaldo  = parseFloat((credito.montoTotal - montoPagado).toFixed(2));
      const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADO' : credito.estado;

      const creditoActualizado = await tx.credito.update({
        where: { id: creditoId },
        data:  { montoPagado, saldo: Math.max(nuevoSaldo, 0), estado: nuevoEstado },
        include: { abonos: { orderBy: { createdAt: 'asc' } } },
      });

      // Registrar ingreso en módulo Dinero
      await tx.ingreso.create({
        data: {
          monto:       Number(monto),
          descripcion: `Abono crédito - ${credito.clienteNombre}`,
          categoria:   'credito',
        },
      });

      return { abono, credito: creditoActualizado };
    });

    registrar({
      usuarioId: req.usuario?.id,
      nombre:    req.usuario?.nombre,
      modulo:    'creditos',
      accion:    'abonar',
      detalle:   { creditoId, monto: Number(monto), metodoPago: metodoPago || 'EFECTIVO' },
      ip:        req.ip,
    });

    res.status(201).json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/creditos/:id/abono/:abonoId — eliminar un abono (ADMIN) ──────
// Solo ADMIN. Recalcula el saldo del crédito tras eliminar el abono.
router.delete('/:id/abono/:abonoId', requireAdmin, async (req, res) => {
  try {
    const creditoId = Number(req.params.id);
    const abonoId   = Number(req.params.abonoId);

    const credito = await prisma.credito.findUnique({ where: { id: creditoId } });
    if (!credito) return res.status(404).json({ error: 'Crédito no encontrado' });

    const abono = await prisma.abono.findUnique({ where: { id: abonoId } });
    if (!abono || abono.creditoId !== creditoId) {
      return res.status(404).json({ error: 'Abono no encontrado en este crédito' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.abono.delete({ where: { id: abonoId } });

      const agg = await tx.abono.aggregate({
        where: { creditoId },
        _sum:  { monto: true },
      });
      const montoPagado = Number(agg._sum.monto) || 0;
      const nuevoSaldo  = parseFloat((credito.montoTotal - montoPagado).toFixed(2));
      // Si el crédito estaba PAGADO y ahora hay saldo, vuelve a PENDIENTE
      const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADO'
        : (credito.estado === 'PAGADO' ? 'PENDIENTE' : credito.estado);

      await tx.credito.update({
        where: { id: creditoId },
        data:  { montoPagado, saldo: Math.max(nuevoSaldo, 0), estado: nuevoEstado },
      });
    });

    const creditoActualizado = await prisma.credito.findUnique({
      where:   { id: creditoId },
      include: { abonos: { orderBy: { createdAt: 'asc' } } },
    });

    registrar({
      usuarioId: req.usuario?.id,
      nombre:    req.usuario?.nombre,
      modulo:    'creditos',
      accion:    'eliminar_abono',
      detalle:   { creditoId, abonoId, monto: abono.monto },
      ip:        req.ip,
    });

    res.json(creditoActualizado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
