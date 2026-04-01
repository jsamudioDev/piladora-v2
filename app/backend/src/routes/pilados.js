const router = require('express').Router();
const prisma  = require('../prisma');
const { validatePilado } = require('../middleware/validators');

// ── Helpers ────────────────────────────────────────────────────────────────────
function hoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function inicioSemana() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function calcHoras(inicio, fin) {
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  const diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff <= 0) throw new Error('horaFin debe ser posterior a horaInicio');
  return parseFloat((diff / 60).toFixed(2));
}

async function getParam(clave, defVal = 0) {
  const p = await prisma.parametro.findUnique({ where: { clave } });
  return p ? parseFloat(p.valor) : defVal;
}

// GET /api/pilados — paginados
router.get('/', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 30;
    const page  = Number(req.query.page)  || 1;
    const pilados = await prisma.pilado.findMany({
      take: limit, skip: (page - 1) * limit,
      include: { operario: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pilados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pilados/hoy — pilados del día
router.get('/hoy', async (req, res) => {
  try {
    const pilados = await prisma.pilado.findMany({
      where:   { createdAt: { gte: hoy() } },
      include: { operario: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pilados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pilados/semana — pilados de la semana
router.get('/semana', async (req, res) => {
  try {
    const pilados = await prisma.pilado.findMany({
      where:   { createdAt: { gte: inicioSemana() } },
      include: { operario: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pilados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pilados/stats — estadísticas por operario
router.get('/stats', async (req, res) => {
  try {
    const [agr, operarios] = await Promise.all([
      prisma.pilado.groupBy({
        by: ['operarioId'],
        _sum: { qqEntrada: true, tandas: true },
        _avg: { rendimiento: true, velocidad: true },
        _count: { id: true },
      }),
      prisma.operario.findMany(),
    ]);

    const opMap = Object.fromEntries(operarios.map(o => [o.id, o.nombre]));
    const stats = agr.map(s => ({
      operarioId:          s.operarioId,
      operario:            opMap[s.operarioId] ?? 'Desconocido',
      totalQQ:             s._sum.qqEntrada    ?? 0,
      totalTandas:         s._sum.tandas       ?? 0,
      promedioRendimiento: s._avg.rendimiento  ?? 0,
      promedioVelocidad:   s._avg.velocidad    ?? 0,
      totalRegistros:      s._count.id,
    }));
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pilados — registrar pilado
// validatePilado: operarioId entero, qqEntrada > 0
router.post('/', validatePilado, async (req, res) => {
  try {
    const {
      operarioId, qqEntrada, tandas,
      sacosPilado, sacosSubproducto,
      horaInicio, horaFin, nota,
    } = req.body;

    // Validar horas
    const horas = calcHoras(horaInicio, horaFin);

    // Leer parámetros
    const pagoPorTanda = await getParam('pago_por_tanda', 15);

    // Calcular derivados
    const rendimiento    = parseFloat(((sacosPilado * 25) / (qqEntrada * 100)).toFixed(4));
    const velocidad      = parseFloat((qqEntrada / horas).toFixed(2));
    const costoEstimado  = parseFloat((tandas * pagoPorTanda).toFixed(2));

    // Buscar productos en stock
    const [maizGrano, maizPilado, pulidura] = await Promise.all([
      prisma.producto.findFirst({ where: { nombre: { contains: 'Maíz Grano' } } }),
      prisma.producto.findFirst({ where: { nombre: { contains: 'Maíz Pilado' } } }),
      prisma.producto.findFirst({ where: { nombre: { contains: 'Pulidura'   } } }),
    ]);

    // Validar stock de Maíz Grano (1 qq = 1 saco de 100lb)
    if (maizGrano && maizGrano.stockActual < qqEntrada)
      return res.status(400).json({
        error: `Stock insuficiente de Maíz Grano. Disponible: ${maizGrano.stockActual} sacos`,
      });

    const result = await prisma.$transaction(async (tx) => {
      const pilado = await tx.pilado.create({
        data: {
          operarioId: Number(operarioId),
          qqEntrada:  Number(qqEntrada),
          tandas:     Number(tandas),
          sacosPilado:      Number(sacosPilado),
          sacosSubproducto: Number(sacosSubproducto),
          horaInicio, horaFin, horas,
          rendimiento, velocidad, costoEstimado,
          nota: nota || null,
        },
        include: { operario: true },
      });

      const egreso = await tx.egreso.create({
        data: {
          monto:       costoEstimado,
          descripcion: `Pilado #${pilado.id} — ${pilado.operario.nombre}`,
          categoria:   'Pilado',
        },
      });

      await tx.pilado.update({ where: { id: pilado.id }, data: { egresoId: egreso.id } });

      // Movimientos de stock
      if (maizGrano) {
        await tx.producto.update({
          where: { id: maizGrano.id },
          data:  { stockActual: { decrement: Number(qqEntrada) } },
        });
      }
      if (maizPilado) {
        await tx.producto.update({
          where: { id: maizPilado.id },
          data:  { stockActual: { increment: Number(sacosPilado) } },
        });
      }
      if (pulidura) {
        await tx.producto.update({
          where: { id: pulidura.id },
          data:  { stockActual: { increment: Number(sacosSubproducto) } },
        });
      }

      return pilado;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
