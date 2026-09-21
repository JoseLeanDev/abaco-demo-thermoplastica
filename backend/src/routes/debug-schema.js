const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

router.get('/', async (req, res) => {
  try {
    // Verificar qué tipo de base de datos está usando
    const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');
    
    // Verificar tablas existentes
    const tables = await db.allAsync(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    // Verificar empresas
    const empresas = await db.getAsync('SELECT COUNT(*) as count FROM empresas');
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      database_type: isPostgres ? 'PostgreSQL' : 'SQLite (fallback)',
      database_url_configured: !!process.env.DATABASE_URL,
      tables: tables.map(t => t.table_name),
      empresas_count: empresas?.count || 0
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: error.message,
      database_url: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'NOT SET'
    });
  }
});

module.exports = router;