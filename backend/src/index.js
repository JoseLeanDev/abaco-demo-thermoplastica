require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const db = require('../database/connection');

const app = express();
const PORT = process.env.PORT || 3000;

// Set db on app for routes
app.set('db', db);

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['https://frontend-blond-rho-55.vercel.app', 'https://*.vercel.app', 'https://*.onrender.com', 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tesoreria', require('./routes/tesoreria'));
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
app.use('/api/admin', require('./routes/admin'));
app.use('/api/margenes', require('./routes/margenes'));
app.use('/api/run-all-agents', require('./routes/runAllAgents'));
app.use('/api/debug', require('./routes/debug'));
app.use('/api/test', require('./routes/test'));
app.use('/api/debug-schema', require('./routes/debug-schema'));
app.use('/api/seed', require('./routes/seed'));

// Health check - ULTRA SIMPLE
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Force setup endpoint
app.get('/api/force-setup', async (req, res) => {
  try {
    const { setupDatabase } = require('../database/setupAuto');
    const result = await setupDatabase();
    res.json({ status: result ? 'success' : 'error', timestamp: new Date().toISOString() });
  } catch (error) {
    res.json({ status: 'error', message: error.message });
  }
});

// Serve static files from frontend/dist
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
const fs = require('fs');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath, {
    setHeaders: (res, path) => {
      res.set('Access-Control-Allow-Origin', '*');
    }
  }));
  
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    }
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  
  // Background setup only - NO BLOCKING
  setTimeout(async () => {
    try {
      const { setupDatabase } = require('../database/setupAuto');
      await setupDatabase();
      console.log('✅ Database setup complete');
    } catch (e) {
      console.error('❌ DB setup error:', e.message);
    }
  }, 100);
});

module.exports = app;
