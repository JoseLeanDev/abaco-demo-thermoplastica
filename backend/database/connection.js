const { Pool } = require('pg');
const { als, reescribir } = require('../src/services/alcance');

// PostgreSQL connection - Production only
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Conexiones ociosas: mantenerlas vivas y soltarlas antes de que la red las corte
  keepAlive: true,
  idleTimeoutMillis: 30000,
});

// Si la red corta una conexión ociosa (ETIMEDOUT, ECONNRESET), el pool emite
// 'error'. Sin este handler Node lo trata como excepción no capturada y tumba
// el servidor. El pool descarta esa conexión y abre otra en la siguiente consulta.
pool.on('error', (err) => {
  console.error('[pg] conexión ociosa cerrada:', err.code || err.message);
});

// Lo mismo para una conexión EN USO: si Postgres se reinicia (mantenimiento de
// Render) la conexión emite 'error' además de rechazar la consulta. Sin listener
// eso tumbaba el servidor; con él solo falla esa consulta y el pool se recupera.
pool.on('connect', (client) => {
  client.on('error', (err) => console.error('[pg] conexión en uso cerrada:', err.code || err.message));
});

console.log('✅ Conectado a base de datos PostgreSQL (Render)');

// Recorte por usuario (services/alcance.js): las consultas hechas dentro de una
// petición con alcance salen con las tablas sensibles filtradas. pool.query lo
// usan directo algunos servicios (laminados, CPP).
//
// Con recorte y además un filtro de producto (categoría Liners de un Gerente de Línea
// de Liners), Postgres subestima cuántas filas quedan y elige nested loops que
// recalculan v_ventas_costeadas por cada artículo: Ventas y Márgenes pasaban de 60 s.
// Solo en esas peticiones (middleware/permisos.js) se desactivan los nested loops;
// sin filtro de producto se dejan, porque ahí ayudan.
const recortada = () => !!als.getStore()?.sinNestloop;

async function consultar(client, sql, params) {
  if (!recortada()) return client.query(sql, params);
  await client.query('SET enable_nestloop = off');
  try {
    return await client.query(sql, params);
  } finally {
    await client.query('RESET enable_nestloop').catch(() => {});
  }
}

const poolQuery = pool.query.bind(pool);
pool.query = (text, ...rest) => {
  const q = typeof text === 'string' ? reescribir(text) : (text?.text ? { ...text, text: reescribir(text.text) } : text);
  // Con callback (API vieja de pg) se deja como estaba
  if (!recortada() || typeof rest[rest.length - 1] === 'function') return poolQuery(q, ...rest);
  return pool.connect().then(client =>
    consultar(client, q, rest[0]).finally(() => client.release()));
};

// Helper para convertir ? → $1, $2, etc. (y aplicar el alcance del usuario)
function convertParams(sql) {
  let paramCount = 0;
  return reescribir(sql).replace(/\?/g, () => {
    paramCount++;
    return `$${paramCount}`;
  });
}

// Wrapper para compatibilidad con API de SQLite
const db = {
  runAsync: async (sql, params = []) => {
    const pgSql = convertParams(sql);
    const client = await pool.connect();
    try {
      const result = await consultar(client, pgSql, params);
      return { id: result.rows[0]?.id || 0, changes: result.rowCount };
    } catch (e) {
      console.error('[DB ERROR] runAsync:', e.message);
      console.error('[DB ERROR] SQL:', pgSql);
      console.error('[DB ERROR] Params:', params);
      throw e;
    } finally {
      client.release();
    }
  },

  getAsync: async (sql, params = []) => {
    const pgSql = convertParams(sql);
    const client = await pool.connect();
    try {
      const result = await consultar(client, pgSql, params);
      return result.rows[0] || null;
    } catch (e) {
      console.error('[DB ERROR] getAsync:', e.message);
      console.error('[DB ERROR] SQL:', pgSql);
      console.error('[DB ERROR] Params:', params);
      throw e;
    } finally {
      client.release();
    }
  },

  allAsync: async (sql, params = []) => {
    const pgSql = convertParams(sql);
    const client = await pool.connect();
    try {
      const result = await consultar(client, pgSql, params);
      return result.rows;
    } catch (e) {
      console.error('[DB ERROR] allAsync:', e.message);
      console.error('[DB ERROR] SQL:', pgSql);
      console.error('[DB ERROR] Params:', params);
      throw e;
    } finally {
      client.release();
    }
  },

  pool
};

module.exports = db;
