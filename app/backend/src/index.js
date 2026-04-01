require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authMiddleware } = require('./middleware/auth');

const app = express();

// ─── Middleware global ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Ruta pública: Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Rutas públicas: Autenticación (login no requiere token) ─────────────────
app.use('/api/auth', require('./routes/auth'));

// ─── Middleware: Proteger todas las rutas de la API con JWT ──────────────────
app.use('/api', authMiddleware);

// ─── Rutas protegidas (requieren token válido) ──────────────────────────────
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/pilados', require('./routes/pilados'));
app.use('/api/dinero', require('./routes/dinero'));
app.use('/api/config', require('./routes/config'));
app.use('/api/panel', require('./routes/panel'));

// ─── Iniciar servidor ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
