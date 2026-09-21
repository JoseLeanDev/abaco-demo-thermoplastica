require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('../database/connection');
const internalToken = require('./middleware/internalToken');

const app = express();
const PORT = process.env.PORT || 3000;

// Set db on app for routes
app.set('db', db);

// -----------------------------------------------------------
// CORS — allowlist con matcher que soporta wildcards reales.
// ALLOWED_ORIGINS puede sobreescribir la lista via env (coma-separada).
// -----------------------------------------------------------
const defaultAllowed = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/.*\.onrender\.com$/,
  /^https:\/\/.*\.vercel\.app$/,
];
const envAllowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const originCheck = (origin, cb) => {
  // Same-origin requests (curl, health checks) no envían Origin: permitir.
  if (!origin) return cb(null, true);
  if (envAllowed.includes(origin)) return cb(null, true);
  if (defaultAllowed.some(re => re.test(origin))) return cb(null, true);
  return cb(new Error('Origin no permitido por CORS'));
};

// -----------------------------------------------------------
// Middleware
// -----------------------------------------------------------
app.use(helmet());
app.use(cors({ origin: originCheck, credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiter global (defensa contra abuso masivo).
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Demasiadas solicitudes, intenta en un momento.' },
});
app.use('/api/', globalLimiter);

// Rate limiter estricto para autenticación (brute force protection).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Demasiados intentos, espera 15 minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// -----------------------------------------------------------
// Rutas de negocio (lectura de datos del ERP)
// -----------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tesoreria', require('./routes/tesoreria'));
app.use('/api/compras', require('./routes/compras'));
app.use('/api/gastos', require('./routes/gastos'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/contabilidad', require('./routes/contabilidad'));
app.use('/api/sat', require('./routes/sat'));
app.use('/api/analisis', require('./routes/analisis'));
app.use('/api/analisis/working-capital', require('./routes/analisis-working-capital'));
app.use('/api/alertas', require('./routes/alertas'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/cierre', require('./routes/cierre'));
app.use('/api/conciliador', require('./routes/conciliador'));
app.use('/api/scheduler', require('./routes/scheduler'));
app.use('/api/margenes', require('./routes/margenes'));

// -----------------------------------------------------------
// Rutas administrativas / de mantenimiento
// Protegidas por header  X-Internal-Token = INTERNAL_ADMIN_TOKEN
// -----------------------------------------------------------
app.use('/api/admin',         internalToken, require('./routes/admin'));
app.use('/api/seed',          internalToken, require('./routes/seed'));
app.use('/api/run-all-agents',internalToken, require('./routes/runAllAgents'));
app.use('/api/debug',         internalToken, require('./routes/debug'));
app.use('/api/debug-schema',  internalToken, require('./routes/debug-schema'));
app.use('/api/test',          internalToken, require('./routes/test'));

// Health check público
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Force setup gated por INTERNAL_ADMIN_TOKEN
app.get('/api/force-setup', internalToken, async (req, res) => {
  try {
    const { setupDatabase } = require('../database/setupAuto');
    const result = await setupDatabase();
    res.json({ status: result ? 'success' : 'error', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Setup falló.' });
  }
});

// -----------------------------------------------------------
// Static files del frontend (SPA)
// -----------------------------------------------------------
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
const fs = require('fs');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    }
  });
}

// -----------------------------------------------------------
// Error handler — no filtra stack en producción
// -----------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  const status = err.status || 500;
  res.status(status).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);

  // Background setup — no bloquea
  setTimeout(async () => {
    try {
      const { setupDatabase } = require('../database/setupAuto');
      await setupDatabase();
      console.log('Database setup complete');
    } catch (e) {
      console.error('DB setup error:', e.message);
    }
  }, 100);
});

module.exports = app;
