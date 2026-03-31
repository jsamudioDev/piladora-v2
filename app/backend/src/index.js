require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/pilados', require('./routes/pilados'));
app.use('/api/dinero', require('./routes/dinero'));
app.use('/api/config', require('./routes/config'));
app.use('/api/panel', require('./routes/panel'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
