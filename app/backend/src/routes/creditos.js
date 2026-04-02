// ─── Rutas de créditos y abonos ───────────────────────────────────────────────
const router = require('express').Router();
const prisma  = require('../prisma');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

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
    // Calcular la fecha límite: hace 7 días
    const hace7dias = new Date();
    hace7dias.setDate(hace7dias.getDate() - 7);

    // Créditos pendientes (incluyendo vencidos)
    const [pendientes, vencidos, totalPendienteAgg] = await Promise.all([
      // Cantidad de créditos activos (PENDIENTE o VENCIDO)
      prisma.credito.count({
        where: { estado: { in: ['PENDIENTE', 'VENCIDO'] } },
      }),
      // Créditos con más de 7 días sin ningún abono (o creados hace más de 7 días y sin pagar)
      prisma.credito.count({
        where: {
          estado: { in: ['PENDIENTE', 'VENCIDO'] },
          createdAt: { lt: hace7dias },
        },
      }),
      // Suma del saldo pendiente total
      prisma.credito.aggregate({
        where: { estado: { in: ['PENDIENTE', 'VENCIDO'] } },
        _sum: { saldo: true },
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
    const { clienteNombre, clienteTel, montoTotal, nota } = req.body;

    if (!clienteNombre || !clienteNombre.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }
    if (!montoTotal || Number(montoTotal) <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const credito = await prisma.credito.create({
      data: {
        clienteNombre: clienteNombre.trim(),
        clienteTel:    clienteTel?.trim() || null,
        montoTotal:    Number(montoTotal),
        saldo:         Number(montoTotal),
        nota:          nota?.trim() || null,
      },
    });

    res.status(201).json(credito);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/creditos/:id/abono — registrar un abono ───────────────────────
// Transacción:
//   1. Crear Abono
//   2. Recalcular montoPagado = suma de todos los abonos del crédito
//   3. Actualizar saldo = montoTotal - montoPagado
//   4. Si saldo <= 0: estado = PAGADO
//   5. Crear Ingreso automáticamente
router.post('/:id/abono', async (req, res) => {
  try {
    const creditoId = Number(req.params.id);
    const { monto, metodoPago, referencia, nota } = req.body;

    // Validaciones básicas
    if (!monto || Number(monto) <= 0) {
      return res.status(400).json({ error: 'El monto del abono debe ser mayor a 0' });
    }
    const metodosValidos = ['EFECTIVO', 'YAPPY', 'TRANSFERENCIA', 'CHEQUE'];
    if (metodoPago && !metodosValidos.includes(metodoPago)) {
      return res.status(400).json({ error: 'Método de pago inválido' });
    }

    // Verificar que el crédito exista y no esté ya pagado
    const credito = await prisma.credito.findUnique({ where: { id: creditoId } });
    if (!credito) return res.status(404).json({ error: 'Crédito no encontrado' });
    if (credito.estado === 'PAGADO') {
      return res.status(400).json({ error: 'Este crédito ya está pagado' });
    }
    if (Number(monto) > credito.saldo) {
      return res.status(400).json({
        error: `El abono ($${monto}) supera el saldo pendiente ($${credito.saldo.toFixed(2)})`,
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear el abono
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

      // 2. Recalcular montoPagado sumando todos los abonos
      const agg = await tx.abono.aggregate({
        where: { creditoId },
        _sum:  { monto: true },
      });
      const montoPagado = Number(agg._sum.monto) || 0;

      // 3. Calcular nuevo saldo
      const nuevoSaldo = parseFloat((credito.montoTotal - montoPagado).toFixed(2));

      // 4. Determinar estado
      const nuevoEstado = nuevoSaldo <= 0 ? 'PAGADO' : credito.estado;

      // Actualizar crédito
      const creditoActualizado = await tx.credito.update({
        where: { id: creditoId },
        data: {
          montoPagado,
          saldo:  Math.max(nuevoSaldo, 0),
          estado: nuevoEstado,
        },
        include: { abonos: { orderBy: { createdAt: 'asc' } } },
      });

      // 5. Crear Ingreso para reflejar el abono en el módulo Dinero
      await tx.ingreso.create({
        data: {
          monto:       Number(monto),
          descripcion: `Abono crédito - ${credito.clienteNombre}`,
          categoria:   'credito',
        },
      });

      return { abono, credito: creditoActualizado };
    });

    res.status(201).json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/creditos/:id — actualizar nota o estado ────────────────────────
// Solo ADMIN puede cambiar estado a VENCIDO manualmente
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nota, estado } = req.body;

    // Solo ADMIN puede marcar como VENCIDO
    if (estado === 'VENCIDO' && req.usuario?.rol !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el administrador puede marcar créditos como vencidos' });
    }

    const data = {};
    if (nota  !== undefined) data.nota  = nota?.trim() || null;
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

    res.json(credito);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
