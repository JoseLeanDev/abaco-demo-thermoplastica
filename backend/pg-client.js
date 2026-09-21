#!/usr/bin/env node
/**
 * PostgreSQL connection for CFO AI production database (Render)
 * Usage: node pg-client.js "SELECT * FROM cuentas_cobrar LIMIT 5"
 */
require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no configurada en el entorno. Aborting.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

async function main() {
  const sql = process.argv[2];
  if (!sql) {
    console.log('Usage: node pg-client.js "SELECT * FROM cuentas_cobrar LIMIT 5"');
    process.exit(1);
  }
  
  try {
    const rows = await query(sql);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { query, pool };
