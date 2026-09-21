/**
 * dbAgente — La unica puerta por la que el agente toca Postgres.
 *
 * Usa DATABASE_URL_READONLY (rol agente_ia: solo SELECT sobre el schema
 * analitica). Es un pool separado del de la aplicacion a proposito: si
 * alguien se equivoca y usa el pool normal aqui, el error se ve rapido.
 */
const { Pool } = require('pg');
const { validar, SQLRechazado, LIMITE_FILAS } = require('./sqlGuard');

const TIMEOUT_MS = 5000;

let pool = null;

function getPool() {
  if (pool) return pool;

  const url = process.env.DATABASE_URL_READONLY;
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL_READONLY. El agente necesita el usuario de solo lectura ' +
      '(ver database/setup/README_CAPA_SEMANTICA.md).'
    );
  }
  if (/\/\/(postgres|.*_user):/i.test(url) && !url.includes('agente_ia')) {
    console.warn(
      '[dbAgente] AVISO: DATABASE_URL_READONLY no apunta al usuario agente_ia. ' +
      'El agente podria tener mas permisos de los debidos.'
    );
  }

  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    application_name: 'abaco_agente_ia'
  });
  pool.on('error', (e) => console.error('[dbAgente] error en el pool:', e.message));
  return pool;
}

/**
 * Ejecuta SQL del modelo. Valida, acota, y corre en transaccion de solo lectura.
 * Nunca lanza por un SQL malo: devuelve { ok: false, error } para que el agente
 * pueda leer el mensaje y corregirse.
 */
async function ejecutarSQL(sqlCrudo) {
  const t0 = Date.now();
  let acotado, original;

  try {
    ({ sql: acotado, sqlOriginal: original } = validar(sqlCrudo));
  } catch (e) {
    if (e instanceof SQLRechazado) {
      return { ok: false, error: e.message, tipo: 'rechazado_por_validacion', sql: sqlCrudo };
    }
    throw e;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    // SET LOCAL solo surte efecto dentro de la transaccion, por eso va despues.
    await client.query(`SET LOCAL statement_timeout = ${TIMEOUT_MS}`);
    const r = await client.query(acotado);
    await client.query('ROLLBACK');

    return {
      ok: true,
      sql: original,
      filas: r.rows,
      num_filas: r.rows.length,
      truncado: r.rows.length >= LIMITE_FILAS,
      columnas: r.fields.map(f => f.name),
      ms: Date.now() - t0
    };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    return {
      ok: false,
      sql: original,
      error: e.message,
      detalle: e.hint || e.detail || null,
      tipo: 'error_de_postgres',
      ms: Date.now() - t0
    };
  } finally {
    client.release();
  }
}

/**
 * Lee el catalogo de la capa semantica: vistas, sus COMMENT y sus columnas.
 * Esto es lo que el agente recibe como "mapa" de la base.
 * Se cachea: el esquema no cambia entre preguntas.
 */
let cacheCatalogo = null;

async function getCatalogo({ refrescar = false } = {}) {
  if (cacheCatalogo && !refrescar) return cacheCatalogo;

  const client = await getPool().connect();
  try {
    const { rows: vistas } = await client.query(`
      SELECT c.relname AS vista, obj_description(c.oid, 'pg_class') AS descripcion
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'analitica' AND c.relkind = 'v'
      ORDER BY c.relname
    `);
    const { rows: cols } = await client.query(`
      SELECT table_name AS vista, column_name AS columna, data_type AS tipo
      FROM information_schema.columns
      WHERE table_schema = 'analitica'
      ORDER BY table_name, ordinal_position
    `);

    cacheCatalogo = vistas.map(v => ({
      vista: v.vista,
      descripcion: (v.descripcion || '').trim(),
      columnas: cols.filter(c => c.vista === v.vista)
                    .map(c => `${c.columna} (${c.tipo.replace('character varying','texto').replace('timestamp without time zone','fecha_hora')})`)
    }));

    if (!cacheCatalogo.length) {
      throw new Error('El schema "analitica" no tiene vistas. Correr la migracion 010_capa_semantica.sql');
    }
    return cacheCatalogo;
  } finally {
    client.release();
  }
}

/** Renderiza el catalogo como texto para el system prompt. */
async function catalogoComoTexto() {
  const cat = await getCatalogo();
  return cat.map(v =>
    `### analitica.${v.vista}\n` +
    `Columnas: ${v.columnas.join(', ')}\n` +
    `${v.descripcion}`
  ).join('\n\n');
}

/** Valores reales de una columna, para que el agente no invente categorias. */
async function muestrearValores(vista, columna, limite = 25) {
  const cat = await getCatalogo();
  const v = cat.find(x => x.vista === vista || `analitica.${x.vista}` === vista);
  if (!v) {
    return { ok: false, error: `No existe la vista "${vista}". Disponibles: ${cat.map(c => c.vista).join(', ')}` };
  }
  const nombres = v.columnas.map(c => c.split(' ')[0]);
  if (!nombres.includes(columna)) {
    return { ok: false, error: `La vista ${v.vista} no tiene la columna "${columna}". Tiene: ${nombres.join(', ')}` };
  }

  // Nombres ya validados contra el catalogo, no vienen crudos del modelo.
  const r = await ejecutarSQL(
    `SELECT "${columna}" AS valor, count(*) AS veces
     FROM analitica."${v.vista}"
     WHERE "${columna}" IS NOT NULL
     GROUP BY 1 ORDER BY 2 DESC LIMIT ${Math.min(limite, 50)}`
  );
  if (!r.ok) return r;
  return { ok: true, vista: v.vista, columna, valores: r.filas };
}

async function cerrar() { if (pool) { await pool.end(); pool = null; } }

module.exports = { ejecutarSQL, getCatalogo, catalogoComoTexto, muestrearValores, cerrar, TIMEOUT_MS };
