require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { authMiddleware }              = require('./middleware/auth');
const { helmetConfig, apiLimiter }    = require('./middleware/security');
const { requireRol }                  = require('./middleware/permisos');

const app = express();

// ─── CORS restrictivo ─────────────────────────────────────────────────────────
// Solo se aceptan peticiones desde los orígenes autorizados.
// En desarrollo: localhost:5173 (Vite). En producción: Vercel.
// Se lee desde la variable de entorno ALLOWED_ORIGINS (separada por comas)
// o se usan los defaults si no está definida.
const originsEnv = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = originsEnv
  ? originsEnv.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'https://piladora-v2.vercel.app'];

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requests sin origin (Postman, curl, misma máquina)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    }
  },
  credentials: true,
};

// ─── Middleware global ────────────────────────────────────────────────────────
// helmet va primero: pone los headers de seguridad HTTP antes que todo
app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(express.json());

// ─── Ruta pública: Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Rutas públicas: Autenticación (login no requiere token) ─────────────────
app.use('/api/auth', require('./routes/auth'));

// ─── Rate limiting + JWT para todas las rutas /api ───────────────────────────
// apiLimiter: 100 requests/min por IP antes de verificar el token
app.use('/api', apiLimiter);
app.use('/api', authMiddleware);

// ─── Rutas protegidas (requieren token válido + rol permitido) ────────────────
// requireRol filtra por rol ANTES de que la petición llegue al router
app.use('/api/panel',    requireRol('ADMIN'),                          require('./routes/panel'));
app.use('/api/ventas',   requireRol('ADMIN', 'VENDEDOR'),              require('./routes/ventas'));
app.use('/api/pilados',  requireRol('ADMIN', 'OPERARIO'),              require('./routes/pilados'));
app.use('/api/stock',    requireRol('ADMIN', 'OPERARIO', 'VENDEDOR'),  require('./routes/stock'));
app.use('/api/dinero',   requireRol('ADMIN'),                          require('./routes/dinero'));
app.use('/api/creditos', requireRol('ADMIN'),                          require('./routes/creditos'));
app.use('/api/config',   requireRol('ADMIN'),                          require('./routes/config'));

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
