// ─── Rutas de configuración (solo ADMIN) ──────────────────────────────────────
const router = require('express').Router();
const prisma  = require('../prisma');
const { requireRol } = require('../middleware/permisos');

// ── Operarios ──────────────────────────────────────────────────────────────────

router.get('/operarios', async (req, res) => {
  try {
    const operarios = await prisma.operario.findMany({ orderBy: { nombre: 'asc' } });
    res.json(operarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/operarios', async (req, res) => {
  try {
    const { nombre } = req.body;
    const operario = await prisma.operario.create({ data: { nombre } });
    res.status(201).json(operario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/operarios/:id', async (req, res) => {
  try {
    const { nombre, activo } = req.body;
    const operario = await prisma.operario.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });
    res.json(operario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Parámetros ─────────────────────────────────────────────────────────────────

router.get('/parametros', async (req, res) => {
  try {
    const params = await prisma.parametro.findMany({ orderBy: { clave: 'asc' } });
    res.json(params);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/parametros/:clave', async (req, res) => {
  try {
    const { valor } = req.body;
    const param = await prisma.parametro.upsert({
      where:  { clave: req.params.clave },
      update: { valor },
      create: { clave: req.params.clave, valor },
    });
    res.json(param);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Productos ─────────────────────────────────────────────────────────────────
// Estos endpoints son exclusivos del módulo Config y devuelven todos los productos
// sin filtrar por ubicación (a diferencia de GET /api/stock que filtra por rol).

// GET /api/config/productos — Lista todos los productos
router.get('/productos', async (req, res) => {
  try {
    const productos = await prisma.producto.findMany({ orderBy: { nombre: 'asc' } });
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// POST /api/config/productos — Crear producto (ADMIN)
router.post('/productos', requireRol('ADMIN'), async (req, res) => {
  try {
    const { nombre, unidad, precio, stockActual, stockMinimo, ubicacion, categoria } = req.body;
    if (!nombre || !unidad) {
      return res.status(400).json({ error: 'nombre y unidad son requeridos' });
    }
    const p = await prisma.producto.create({
      data: {
        nombre:      nombre.trim(),
        unidad:      unidad.trim(),
        precio:      parseFloat(precio)      || 0,
        stockActual: parseFloat(stockActual) || 0,
        stockMinimo: parseFloat(stockMinimo) || 0,
        ubicacion:   ubicacion  || 'piladora',
        categoria:   categoria  || 'grano',
      },
    });
    res.status(201).json(p);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// PUT /api/config/productos/:id — Editar producto (ADMIN)
router.put('/productos/:id', requireRol('ADMIN'), async (req, res) => {
  try {
    const { nombre, unidad, precio, stockMinimo, activo, ubicacion, categoria } = req.body;
    const data = {};
    if (nombre      !== undefined) data.nombre      = nombre;
    if (unidad      !== undefined) data.unidad      = unidad;
    if (precio      !== undefined) data.precio      = parseFloat(precio);
    if (stockMinimo !== undefined) data.stockMinimo = parseFloat(stockMinimo);
    if (activo      !== undefined) data.activo      = Boolean(activo);
    if (ubicacion   !== undefined) data.ubicacion   = ubicacion;
    if (categoria   !== undefined) data.categoria   = categoria;

    const p = await prisma.producto.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: 'Error al editar producto' });
  }
});

// ── Módulos (permisos dinámicos) ───────────────────────────────────────────────
// Los módulos se guardan como Parametro con clave 'modulo_[nombre]'.
// El valor es una cadena de roles separados por comas: "ADMIN,VENDEDOR".

// GET /api/config/modulos — Leer configuración de visibilidad de módulos
router.get('/modulos', requireRol('ADMIN'), async (req, res) => {
  try {
    const params = await prisma.parametro.findMany({
      where: { clave: { startsWith: 'modulo_' } },
    });
    res.json(params);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener módulos' });
  }
});

// PUT /api/config/modulos/:clave — Actualizar roles de un módulo (ADMIN)
// Body: { valor: "ADMIN,VENDEDOR" }
router.put('/modulos/:clave', requireRol('ADMIN'), async (req, res) => {
  try {
    const { valor } = req.body;
    const nombreModulo = req.params.clave.replace('modulo_', '');
    const param = await prisma.parametro.upsert({
      where:  { clave: req.params.clave },
      update: { valor },
      create: {
        clave:       req.params.clave,
        valor,
        descripcion: `Roles con acceso al módulo ${nombreModulo}`,
      },
    });
    res.json(param);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar módulo' });
  }
});

module.exports = router;
