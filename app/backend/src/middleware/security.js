// ─── Middleware de seguridad: rate limiting y headers HTTP ───────────────────
const rateLimit = require('express-rate-limit');
const helmet    = require('helmet');

// Rate limiter específico para login: 5 intentos por IP cada 15 minutos.
// Evita ataques de fuerza bruta contra las credenciales.
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutos
  max:              5,               // máximo 5 intentos
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.' },
});

// Rate limiter general para toda la API: 100 requests por IP por minuto.
// Previene abuso o scraping masivo de la API.
const apiLimiter = rateLimit({
  windowMs:         60 * 1000, // 1 minuto
  max:              100,        // máximo 100 requests
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en un minuto.' },
});

// Helmet configura headers HTTP seguros automáticamente:
// - Content-Security-Policy: evita XSS y carga de recursos externos no autorizados
// - X-Frame-Options: previene clickjacking (DENY por defecto)
// - X-Content-Type-Options: evita que el browser "adivine" el MIME type (nosniff)
// - Strict-Transport-Security: fuerza HTTPS en producción
// - y varios más activados por defecto
const helmetConfig = helmet();

module.exports = { loginLimiter, apiLimiter, helmetConfig };
