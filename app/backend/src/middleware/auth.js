// ─── Middleware de autenticación JWT ─────────────────────────────────────────
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'piladora-secret-dev-2026';

/**
 * authMiddleware — Verifica el token JWT en el header Authorization.
 * Si es válido, agrega req.usuario con los datos del usuario.
 */
async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Buscar usuario en BD para verificar que sigue activo
    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, nombre: true, email: true, rol: true, activo: true }
    });

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Usuario no autorizado o inactivo' });
    }

    // Adjuntar usuario al request
    req.usuario = usuario;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado, inicia sesión de nuevo' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * requireAdmin — Solo permite acceso a usuarios con rol ADMIN.
 * Debe usarse DESPUÉS de authMiddleware.
 */
function requireAdmin(req, res, next) {
  if (req.usuario?.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol de Administrador' });
  }
  next();
}

module.exports = { authMiddleware, requireAdmin, JWT_SECRET };
