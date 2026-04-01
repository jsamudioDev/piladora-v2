// ─── Rutas de autenticación ──────────────────────────────────────────────────
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { authMiddleware, requireAdmin, JWT_SECRET } = require('../middleware/auth');
const { loginLimiter }                             = require('../middleware/security');
const { validateLogin, validateRegistro }          = require('../middleware/validators');

// ─── POST /api/auth/login — Iniciar sesión ──────────────────────────────────
// loginLimiter: máx 5 intentos por IP cada 15 min (evita fuerza bruta)
// validateLogin: verifica email válido + password mínimo 6 chars
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    // Buscar usuario por email
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Verificar que esté activo
    if (!usuario.activo) {
      return res.status(401).json({ error: 'Cuenta desactivada, contacta al administrador' });
    }

    // Comparar contraseña
    const match = await bcrypt.compare(password, usuario.password);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Generar token JWT (expira en 24 horas)
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
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

// ─── POST /api/auth/registro — Crear nuevo usuario (solo ADMIN) ──────────────
// validateRegistro: nombre, email, password mínimo 8 chars, rol válido
router.post('/registro', authMiddleware, requireAdmin, validateRegistro, async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }

    // Validar rol
    const rolValido = ['ADMIN', 'VENDEDOR'].includes(rol);
    if (rol && !rolValido) {
      return res.status(400).json({ error: 'Rol inválido. Debe ser ADMIN o VENDEDOR' });
    }

    // Verificar email único
    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    // Hash de contraseña (12 rondas)
    const hash = await bcrypt.hash(password, 12);

    const nuevo = await prisma.usuario.create({
      data: {
        nombre,
        email,
        password: hash,
        rol: rol || 'VENDEDOR'
      },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true }
    });

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
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ─── PUT /api/auth/usuarios/:id — Actualizar usuario (solo ADMIN) ───────────
router.put('/usuarios/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, password, rol, activo } = req.body;

    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (email !== undefined) data.email = email;
    if (rol !== undefined) data.rol = rol;
    if (activo !== undefined) data.activo = activo;
    if (password) data.password = await bcrypt.hash(password, 12);

    const actualizado = await prisma.usuario.update({
      where: { id: Number(id) },
      data,
      select: { id: true, nombre: true, email: true, rol: true, activo: true }
    });

    res.json(actualizado);
  } catch (err) {
    console.error('Error actualizando usuario:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

module.exports = router;
