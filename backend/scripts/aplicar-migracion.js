// Aplica UNA migración SQL dentro de una transacción (si falla, no queda nada a medias).
// Uso: node scripts/aplicar-migracion.js database/migrations/026_tipo_uso_erp.sql
require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

const archivo = process.argv[2];
if (!archivo) { console.error('Falta el archivo .sql'); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(fs.readFileSync(archivo, 'utf8'));
    await c.query('COMMIT');
    console.log(`OK: ${archivo}`);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error(`ROLLBACK (no se aplicó nada): ${e.message}`);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
})();
