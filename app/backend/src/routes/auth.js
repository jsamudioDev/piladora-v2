// ─── Rutas de autenticación ──────────────────────────────────────────────────
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const prisma  = require('../prisma');
const { authMiddleware, requireAdmin, JWT_SECRET } = require('../middleware/auth');
const { loginLimiter }                             = require('../middleware/security');
const { validateLogin, validateRegistro }          = require('../middleware/validators');
const { registrar }                                = require('../services/bitacoraService');

// ─── POST /api/auth/login — Iniciar sesión ──────────────────────────────────
// loginLimiter: máx 5 intentos por IP cada 15 min (evita fuerza bruta)
// validateLogin: verifica email válido + password mínimo 6 chars
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    if (!usuario.activo) {
      return res.status(401).json({ error: 'Cuenta desactivada, contacta al administrador' });
    }

    const match = await bcrypt.compare(password, usuario.password);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Registrar login en bitácora (sin await para no bloquear la respuesta)
    registrar({ usuarioId: usuario.id, nombre: usuario.nombre, modulo: 'auth', accion: 'login', detalle: { email: usuario.email }, ip: req.ip });

    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── GET /api/auth/me — Obtener perfil del usuario autenticado ───────────────
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ usuario: req.usuario });
});

// ─── PUT /api/auth/perfil — El usuario autenticado edita su nombre y/o contraseña ──
router.put('/perfil', authMiddleware, async (req, res) => {
  try {
    const { nombre, passwordActual, passwordNuevo } = req.body;
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const data = {};
    if (nombre && nombre.trim()) data.nombre = nombre.trim();

    if (passwordNuevo) {
      if (!passwordActual) return res.status(400).json({ error: 'Debes ingresar tu contraseña actual' });
      const ok = await bcrypt.compare(passwordActual, usuario.password);
      if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      data.password = await bcrypt.hash(passwordNuevo, 10);
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    const actualizado = await prisma.usuario.update({ where: { id: req.usuario.id }, data });
    registrar({ usuarioId: req.usuario.id, nombre: req.usuario.nombre, modulo: 'auth', accion: 'editar-perfil', detalle: { campos: Object.keys(data) }, ip: req.ip });

    res.json({ id: actualizado.id, nombre: actualizado.nombre, email: actualizado.email, rol: actualizado.rol });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// ─── POST /api/auth/registro — Crear nuevo usuario (solo ADMIN) ──────────────
// validateRegistro: nombre, email, password mínimo 8 chars, rol válido
router.post('/registro', authMiddleware, requireAdmin, validateRegistro, async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }

    const rolValido = ['ADMIN', 'VENDEDOR', 'OPERARIO'].includes(rol);
    if (rol && !rolValido) {
      return res.status(400).json({ error: 'Rol inválido. Debe ser ADMIN, VENDEDOR u OPERARIO' });
    }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    const hash = await bcrypt.hash(password, 12);

    const nuevo = await prisma.usuario.create({
      data: { nombre, email, password: hash, rol: rol || 'VENDEDOR' },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
    });

    registrar({ usuarioId: req.usuario.id, nombre: req.usuario.nombre, modulo: 'auth', accion: 'crear', detalle: { nuevoUsuario: email }, ip: req.ip });

    res.status(201).json(nuevo);
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// ─── GET /api/auth/usuarios — Listar usuarios (solo ADMIN) ──────────────────
router.get('/usuarios', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select:  { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ─── PUT /api/auth/usuarios/:id — Actualizar usuario (solo ADMIN) ───────────
router.put('/usuarios/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id }                            = req.params;
    const { nombre, email, password, rol, activo } = req.body;

    const data = {};
    if (nombre   !== undefined) data.nombre  = nombre;
    if (email    !== undefined) data.email   = email;
    if (rol      !== undefined) data.rol     = rol;
    if (activo   !== undefined) data.activo  = activo;
    if (password) data.password = await bcrypt.hash(password, 12);

    const actualizado = await prisma.usuario.update({
      where:  { id: Number(id) },
      data,
      select: { id: true, nombre: true, email: true, rol: true, activo: true },
    });

    registrar({ usuarioId: req.usuario.id, nombre: req.usuario.nombre, modulo: 'auth', accion: 'editar', detalle: { usuarioEditado: Number(id) }, ip: req.ip });

    res.json(actualizado);
  } catch (err) {
    console.error('Error actualizando usuario:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

module.exports = router;
