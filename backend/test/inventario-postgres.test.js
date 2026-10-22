// Prueba el SQL publicado con fuentes temporales; no reemplaza vistas reales.
require('dotenv').config({ quiet: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

test('consumo no trazado queda pendiente aunque haya compras recientes o antiguas', { skip: !process.env.DATABASE_URL }, async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query(`
      CREATE TEMP VIEW prueba_stock AS
      SELECT id AS inv_id, id AS articulo_id, NULL::bigint AS proveedor_id,
        CASE WHEN id=7 THEN 0 ELSE 10 END::numeric AS stock_actual,
        0::numeric AS stock_en_transito, 100::numeric AS costo_promedio,
        100::numeric AS costo_proveedor, 100::numeric AS costo_ultimo,
        200::numeric AS precio_venta_1, 0::numeric AS precio_venta_2,
        0::numeric AS precio_venta_3, 0::numeric AS precio_venta_4, 0::numeric AS precio_venta_5,
        1000::numeric AS valor_inventario, CURRENT_DATE AS fecha_snapshot,
        NULL::uuid AS batch_id, now() AS created_at, now() AS updated_at,
        50::numeric AS margen_bruto_pct
      FROM generate_series(1,7) id;
      CREATE TEMP VIEW prueba_articulos AS
      SELECT id AS articulo_id, 'ART-'||id AS codigo_articulo, 'Artículo '||id AS descripcion,
        'Línea'::text AS linea, 'Categoría'::text AS categoria FROM generate_series(1,7) id;
      CREATE TEMP VIEW prueba_ventas AS
      SELECT id AS articulo_id, CURRENT_DATE - CASE WHEN id=2 THEN 200 ELSE 1 END AS fecha_emision,
        1000::numeric AS costo_total_facturado, 'FACT'::text AS tipo_doc
      FROM (VALUES(1),(2),(7)) ids(id);
      CREATE TEMP VIEW prueba_mensuales AS
      SELECT 6 AS articulo_id, extract(year FROM CURRENT_DATE)::int AS anio,
        extract(month FROM CURRENT_DATE)::int AS mes, 100::numeric AS monto;
      CREATE TEMP VIEW prueba_compras AS
      SELECT id AS articulo_id, CURRENT_DATE - CASE WHEN id=3 THEN 800 ELSE 1 END AS fecha_emision,
        100000::numeric AS total_sin_iva, false AS es_outlier_fecha, 'FACT'::text AS tipo_doc
      FROM (VALUES(3),(4)) ids(id);
    `);
    let sql = fs.readFileSync(path.join(__dirname, '../database/migrations/024_inventario_consumo_pendiente.sql'), 'utf8');
    sql = sql.slice(0, sql.indexOf('COMMENT ON VIEW'));
    for (const [real, fixture] of Object.entries({
      'analitica.v_inventario_salud': 'prueba_salud',
      'thermoplastica.fact_inventario_snapshot': 'prueba_stock',
      'thermoplastica.dim_articulo': 'prueba_articulos',
      'thermoplastica.v_ventas_costeadas': 'prueba_ventas',
      'thermoplastica.fact_ventas_mensuales': 'prueba_mensuales',
      'thermoplastica.fact_compras_linea': 'prueba_compras',
    })) {
      sql = sql.replaceAll(real, fixture);
      sql = sql.replaceAll(real.split('.').pop() + '.', fixture + '.');
    }
    sql = sql.replace('CREATE OR REPLACE VIEW', 'CREATE OR REPLACE TEMP VIEW');
    await c.query(sql);
    const rows = (await c.query('SELECT * FROM prueba_salud ORDER BY articulo_id')).rows;
    assert.equal(rows.length, 6); // stock cero no participa
    assert.equal(rows.reduce((s, r) => s + Number(r.valor_inventario), 0), 6000);
    assert.equal(rows[0].estado, 'activo');
    assert.equal(rows[1].estado, 'inmovilizado');
    for (const r of rows.filter(r => [3,4,5].includes(Number(r.articulo_id)))) {
      assert.equal(r.estado, 'por_validar');
      assert.equal(r.dias_cobertura, null);
    }
    assert.equal(Number(rows[5].dias_sin_venta), 0); // mensual abierto topado a hoy
  } finally {
    await c.query('ROLLBACK');
    await c.end();
  }
});
