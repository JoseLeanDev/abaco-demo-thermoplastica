const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const { parsePeriodo } = require('../services/periodo');
const M = require('../services/margen');

// El stock es la foto más reciente del ERP (no hay historia de snapshots). El filtro
// de fechas aplica al MOVIMIENTO: ventas y compras del período, rotación y artículos
// con stock que no se vendieron en la ventana.

function grupoJSON(r, total, P) {
  const valor = parseFloat(r.valor) || 0;
  const cv = parseFloat(r.costo_vendido) || 0;
  return {
    nombre: r.grupo,
    articulos: parseInt(r.articulos) || 0,
    valor,
    porcentaje: total > 0 ? Math.round(valor / total * 1000) / 10 : 0,
    costo_vendido: cv,
    // Días de inventario al ritmo de venta del período (null si no se vendió nada)
    dias_inventario: cv > 0 ? Math.round(valor / (cv / P.dias)) : null,
    sin_venta_valor: parseFloat(r.sin_venta_valor) || 0,
  };
}

// GET /api/inventario   Resumen: KPIs + top artículos + distribución por línea
router.get('/', async (req, res) => {
  try {
    const P = parsePeriodo(req);

    const mov = await db.getAsync(`
      WITH vend AS (
        SELECT articulo_id, SUM(unidades) AS unidades, ${M.costo()} AS costo
        FROM thermoplastica.fact_ventas_linea
        WHERE tipo_doc = 'FACT' AND fecha_emision BETWEEN ${P.D} AND ${P.H}
        GROUP BY articulo_id
      )
      SELECT
        (SELECT COALESCE(SUM(costo), 0) FROM vend)                                        AS costo_vendido,
        (SELECT COALESCE(SUM(f.total_sin_iva), 0)
           FROM thermoplastica.fact_compras_linea f
           JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
          WHERE f.fecha_emision BETWEEN ${P.D} AND ${P.H}
            AND COALESCE(a.es_gasto_operativo, FALSE) = FALSE)                             AS compras,
        COUNT(*) FILTER (WHERE i.stock_actual > 0 AND v.articulo_id IS NULL)                AS sin_venta_articulos,
        COALESCE(SUM(i.valor_inventario) FILTER (WHERE i.stock_actual > 0 AND v.articulo_id IS NULL), 0) AS sin_venta_valor
      FROM thermoplastica.fact_inventario_snapshot i
      LEFT JOIN vend v ON v.articulo_id = i.articulo_id
    `);

    // KPIs generales
    const kpis = await db.getAsync(`
      SELECT
        COUNT(*)                                                                     AS total_articulos,
        COUNT(*) FILTER (WHERE stock_actual > 0)                                      AS articulos_con_stock,
        COUNT(*) FILTER (WHERE stock_actual = 0)                                      AS articulos_sin_stock,
        COALESCE(SUM(valor_inventario), 0)                                            AS valor_total,
        COALESCE(SUM(stock_en_transito * COALESCE(costo_promedio, 0)), 0)             AS valor_transito,
        COUNT(*) FILTER (WHERE margen_bruto_pct IS NOT NULL AND margen_bruto_pct > 0) AS articulos_con_margen,
        AVG(margen_bruto_pct) FILTER (WHERE margen_bruto_pct > 0)                     AS margen_bruto_promedio
      FROM thermoplastica.fact_inventario_snapshot
    `);

    // Distribución por categoría y subcategoría, con el movimiento del período.
    // Categoría = campo "marca" del ERP, subcategoría = "linea" (igual que en Ventas).
    const categoriaSel = (req.query.categoria || '').trim();
    const porGrupo = (expr, filtroSql, params) => db.allAsync(`
      WITH vend AS (
        SELECT articulo_id, ${M.costo()} AS costo
        FROM thermoplastica.fact_ventas_linea
        WHERE tipo_doc = 'FACT' AND fecha_emision BETWEEN ${P.D} AND ${P.H}
        GROUP BY articulo_id
      )
      SELECT ${expr}                                           AS grupo,
             COUNT(*) FILTER (WHERE i.stock_actual > 0)        AS articulos,
             COALESCE(SUM(i.valor_inventario), 0)              AS valor,
             COALESCE(SUM(v.costo), 0)                         AS costo_vendido,
             COALESCE(SUM(i.valor_inventario) FILTER (WHERE i.stock_actual > 0 AND v.articulo_id IS NULL), 0) AS sin_venta_valor
      FROM thermoplastica.fact_inventario_snapshot i
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = i.articulo_id
      LEFT JOIN vend v ON v.articulo_id = i.articulo_id
      ${filtroSql}
      GROUP BY 1
      HAVING SUM(i.valor_inventario) > 0
      ORDER BY valor DESC
    `, params);
    const porCategoria = await porGrupo(`COALESCE(NULLIF(TRIM(a.marca), ''), 'Sin categoría')`, '', []);
    const porLinea = await porGrupo(
      `COALESCE(NULLIF(TRIM(a.linea), ''), 'Sin subcategoría')`,
      categoriaSel ? `WHERE COALESCE(NULLIF(TRIM(a.marca), ''), 'Sin categoría') = ?` : '',
      categoriaSel ? [categoriaSel] : []
    );

    // Top 10 artículos por valor de inventario
    const topValor = await db.allAsync(`
      SELECT a.codigo_articulo AS codigo,
             a.descripcion,
             a.linea, a.sublinea,
             p.nombre AS proveedor,
             i.stock_actual, i.stock_en_transito,
             i.costo_promedio, i.precio_venta_1,
             i.valor_inventario, i.margen_bruto_pct
      FROM thermoplastica.fact_inventario_snapshot i
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = i.articulo_id
      LEFT JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = i.proveedor_id
      WHERE i.valor_inventario > 0
      ORDER BY i.valor_inventario DESC
      LIMIT 10
    `);

    // Top proveedores por valor de inventario (a quién le compramos más stock)
    const topProveedores = await db.allAsync(`
      SELECT p.nombre AS proveedor, p.codigo_proveedor AS codigo,
             COUNT(*)                                    AS articulos,
             COALESCE(SUM(i.valor_inventario), 0)        AS valor
      FROM thermoplastica.fact_inventario_snapshot i
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = i.proveedor_id
      WHERE i.stock_actual > 0
      GROUP BY p.nombre, p.codigo_proveedor
      ORDER BY valor DESC
      LIMIT 10
    `);

    const total = parseFloat(kpis.valor_total) || 0;
    const costoVendido = parseFloat(mov.costo_vendido) || 0;

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        movimiento: {
          costo_vendido: costoVendido,
          compras: parseFloat(mov.compras) || 0,
          // Veces que el inventario actual "gira" en un año al ritmo de venta del período.
          rotacion_anual: total > 0 ? Math.round(costoVendido * 365 / P.dias / total * 10) / 10 : null,
          dias_inventario: costoVendido > 0 ? Math.round(total / (costoVendido / P.dias)) : null,
          sin_venta_articulos: parseInt(mov.sin_venta_articulos) || 0,
          sin_venta_valor: parseFloat(mov.sin_venta_valor) || 0,
        },
        kpis: {
          total_articulos: parseInt(kpis.total_articulos) || 0,
          articulos_con_stock: parseInt(kpis.articulos_con_stock) || 0,
          articulos_sin_stock: parseInt(kpis.articulos_sin_stock) || 0,
          valor_total: total,
          valor_transito: parseFloat(kpis.valor_transito) || 0,
          margen_bruto_promedio: parseFloat(kpis.margen_bruto_promedio) || 0,
          articulos_con_margen: parseInt(kpis.articulos_con_margen) || 0,
        },
        categoria_sel: categoriaSel || null,
        por_categoria: porCategoria.map(r => grupoJSON(r, total, P)),
        // Subcategorías (de la categoría seleccionada, si hay)
        por_linea: porLinea.map(r => {
          const g = grupoJSON(r, porLinea.reduce((s, x) => s + (parseFloat(x.valor) || 0), 0), P);
          return { ...g, linea: g.nombre };
        }),
        top_valor: topValor.map(r => ({
          codigo: r.codigo,
          descripcion: r.descripcion,
          linea: r.linea,
          sublinea: r.sublinea,
          proveedor: r.proveedor,
          stock_actual: parseFloat(r.stock_actual) || 0,
          stock_en_transito: parseFloat(r.stock_en_transito) || 0,
          costo_promedio: parseFloat(r.costo_promedio) || 0,
          precio_venta_1: parseFloat(r.precio_venta_1) || 0,
          valor_inventario: parseFloat(r.valor_inventario) || 0,
          margen_bruto_pct: parseFloat(r.margen_bruto_pct) || 0,
        })),
        top_proveedores: topProveedores.map(r => ({
          codigo: r.codigo, proveedor: r.proveedor,
          articulos: parseInt(r.articulos) || 0,
          valor: parseFloat(r.valor) || 0,
          porcentaje: total > 0 ? Math.round(parseFloat(r.valor) / total * 1000) / 10 : 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/inventario/detalle   Listado paginado con filtros
router.get('/detalle', async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 200, 1000);
    const offset   = parseInt(req.query.offset) || 0;
    const busqueda = (req.query.busqueda || '').trim();
    const linea    = (req.query.linea || '').trim();
    const categoria = (req.query.categoria || '').trim();
    const filtro   = (req.query.filtro || 'todos').trim();   // 'todos' | 'con_stock' | 'sin_stock' | 'sin_precio' | 'con_transito' | 'sin_venta_periodo'
    const P = parsePeriodo(req);
    // Ventas por artículo en el período del filtro global
    const vendCte = `
      WITH vend AS (
        SELECT articulo_id, SUM(unidades) AS unidades, SUM(total_sin_iva) AS ventas
        FROM thermoplastica.fact_ventas_linea
        WHERE tipo_doc = 'FACT' AND fecha_emision BETWEEN ${P.D} AND ${P.H}
        GROUP BY articulo_id
      )`;

    const where = ['1=1'];
    const params = [];

    if (busqueda) {
      params.push(`%${busqueda}%`);
      const p = `$${params.length}`;
      where.push(`(a.codigo_articulo ILIKE ${p} OR a.descripcion ILIKE ${p} OR p.nombre ILIKE ${p})`);
    }
    if (categoria) {
      params.push(categoria);
      where.push(`COALESCE(NULLIF(TRIM(a.marca), ''), 'Sin categoría') = $${params.length}`);
    }
    if (linea) {
      params.push(linea);
      where.push(`COALESCE(NULLIF(TRIM(a.linea), ''), 'Sin subcategoría') = $${params.length}`);
    }
    if (filtro === 'con_stock')     where.push(`i.stock_actual > 0`);
    else if (filtro === 'sin_stock')   where.push(`(i.stock_actual IS NULL OR i.stock_actual = 0)`);
    else if (filtro === 'sin_precio')  where.push(`(i.precio_venta_1 IS NULL OR i.precio_venta_1 = 0)`);
    else if (filtro === 'con_transito') where.push(`i.stock_en_transito > 0`);
    else if (filtro === 'sin_venta_periodo') where.push(`i.stock_actual > 0 AND v.articulo_id IS NULL`);

    const whereSql = where.join(' AND ');

    const rows = await db.allAsync(`${vendCte}
      SELECT
        i.inv_id                       AS id,
        a.codigo_articulo              AS codigo,
        a.descripcion,
        a.linea, a.sublinea, a.marca,
        p.nombre                       AS proveedor,
        p.codigo_proveedor,
        i.stock_actual, i.stock_en_transito,
        i.costo_promedio, i.costo_ultimo,
        i.precio_venta_1, i.precio_venta_2, i.precio_venta_3, i.precio_venta_4, i.precio_venta_5,
        i.valor_inventario, i.margen_bruto_pct,
        COALESCE(v.unidades, 0) AS unidades_vendidas_periodo,
        COALESCE(v.ventas, 0)   AS ventas_periodo
      FROM thermoplastica.fact_inventario_snapshot i
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = i.articulo_id
      LEFT JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = i.proveedor_id
      LEFT JOIN vend v ON v.articulo_id = i.articulo_id
      WHERE ${whereSql}
      ORDER BY i.valor_inventario DESC NULLS LAST, a.codigo_articulo ASC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    const totalRow = await db.getAsync(`${vendCte}
      SELECT COUNT(*) AS total, COALESCE(SUM(i.valor_inventario), 0) AS suma_valor
      FROM thermoplastica.fact_inventario_snapshot i
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = i.articulo_id
      LEFT JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = i.proveedor_id
      LEFT JOIN vend v ON v.articulo_id = i.articulo_id
      WHERE ${whereSql}
    `, params);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        total_filas: parseInt(totalRow.total) || 0,
        suma_valor: parseFloat(totalRow.suma_valor) || 0,
        filas: rows.map(r => ({
          id: parseInt(r.id),
          codigo: r.codigo,
          descripcion: r.descripcion,
          linea: r.linea,
          sublinea: r.sublinea,
          marca: r.marca,
          proveedor: r.proveedor,
          codigo_proveedor: r.codigo_proveedor,
          stock_actual: parseFloat(r.stock_actual) || 0,
          stock_en_transito: parseFloat(r.stock_en_transito) || 0,
          costo_promedio: parseFloat(r.costo_promedio) || 0,
          costo_ultimo: parseFloat(r.costo_ultimo) || 0,
          precio_venta_1: parseFloat(r.precio_venta_1) || 0,
          precio_venta_2: parseFloat(r.precio_venta_2) || 0,
          precio_venta_3: parseFloat(r.precio_venta_3) || 0,
          precio_venta_4: parseFloat(r.precio_venta_4) || 0,
          precio_venta_5: parseFloat(r.precio_venta_5) || 0,
          valor_inventario: parseFloat(r.valor_inventario) || 0,
          margen_bruto_pct: r.margen_bruto_pct !== null ? parseFloat(r.margen_bruto_pct) : null,
          unidades_vendidas_periodo: parseFloat(r.unidades_vendidas_periodo) || 0,
          ventas_periodo: parseFloat(r.ventas_periodo) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// =========================================================================
// GET /api/inventario/analitica?desde=&hasta=
// Una fila por artículo relevante para inventario (con stock, en tránsito, o con
// salida en el período). El frontend agrega y filtra en el navegador para que
// el drill-down por categoría › subcategoría › sublínea sea instantáneo.
//
//   - Stock y valor: foto más reciente del ERP.
//   - Salida del período: producto → costo de ventas (mismo criterio de margen
//     que el resto del sitio); materia prima → lo comprado (se consume en
//     producción y se repone). Igual que Rotación de inventarios.
//   - Cobertura = valor ÷ salida diaria del período.
//   - ABC por salida: A = artículos que suman el 80% de la salida, B = siguiente
//     15%, C = último 5%, N = sin salida en el período. Se calcula sobre todo el
//     universo (la clase de un artículo no cambia al filtrar).
//   - Quiebre: sin stock ni tránsito, con demanda recurrente (≥ 3 de los últimos 6
//     meses) y salida en los últimos 90 días.
//   - Clase y estado (activo / lento / inmovilizado): vista analitica.v_inventario_salud,
//     igual que Capital inmovilizado.
// Caché 5 min por rango de fechas.
// =========================================================================
const NOMBRE_PROV = `REGEXP_REPLACE(p.nombre, '^[A-Za-z]*[0-9][0-9A-Za-z]*-', '')`;
// Líneas que no son inventario físico (servicios, gastos, fletes, activo fijo)
const NO_INVENTARIO = `(COALESCE(a.es_gasto_operativo, FALSE)
  OR a.linea IN ('Gastos de Operación', 'Costos Administrativos', 'No Aplica')
  OR a.linea ILIKE 'activo fijo%' OR a.linea ILIKE 'gastos de importaci%' OR a.linea ILIKE 'costo% de producci%'
  OR a.marca IN ('Contable', 'Articulos de Servicio', 'Maquila')
  OR a.codigo_articulo IN ('GENARTICULO', 'GENARTICULOEXENTO', 'GENSERV', 'GENSERVICIO'))`;
const cacheAnalitica = new Map();

router.get('/analitica', async (req, res) => {
  try {
    const P = parsePeriodo(req);
    const key = `${P.desde}|${P.hasta}`;
    const hit = cacheAnalitica.get(key);
    if (hit && Date.now() - hit.t < 5 * 60 * 1000) return res.json(hit.body);

    const enP = `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`;
    const en90 = `f.fecha_emision > CURRENT_DATE - 90`;
    const limpio = (e, vacio) => `COALESCE(NULLIF(TRIM(${e}), ''), '${vacio}')`;
    const [rows, meta] = await Promise.all([
      db.allAsync(`
        WITH snap AS (
          SELECT * FROM thermoplastica.fact_inventario_snapshot
          WHERE fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_inventario_snapshot)
        ), g AS (
          SELECT ${M.pct('f', enP)} AS pct FROM thermoplastica.fact_ventas_linea f WHERE f.tipo_doc = 'FACT'
        ), v AS (
          SELECT f.articulo_id,
                 COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${enP}), 0)  AS ventas,
                 COALESCE(SUM(f.unidades) FILTER (WHERE ${enP}), 0)       AS unidades,
                 COALESCE(${M.costo('f', enP)},
                          SUM(f.total_sin_iva) FILTER (WHERE ${enP}) * (1 - (SELECT pct FROM g) / 100), 0) AS cogs,
                 COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${en90}), 0) AS ventas_90,
                 COUNT(DISTINCT DATE_TRUNC('month', f.fecha_emision))
                   FILTER (WHERE f.fecha_emision > CURRENT_DATE - 180)    AS meses_venta_6m,
                 MAX(f.fecha_emision)                                     AS ultima_venta
          FROM thermoplastica.fact_ventas_linea f
          WHERE f.tipo_doc = 'FACT'
          GROUP BY f.articulo_id
        ), c AS (
          SELECT f.articulo_id,
                 COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${enP}), 0)  AS compras,
                 COALESCE(SUM(f.unidades) FILTER (WHERE ${enP}), 0)       AS unidades,
                 COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${en90}), 0) AS compras_90,
                 COUNT(DISTINCT DATE_TRUNC('month', f.fecha_emision))
                   FILTER (WHERE f.fecha_emision > CURRENT_DATE - 180)    AS meses_compra_6m,
                 MAX(f.fecha_emision)                                     AS ultima_compra
          FROM thermoplastica.fact_compras_linea f
          WHERE f.tipo_doc = 'FACT' AND NOT COALESCE(f.es_outlier_fecha, false)
            AND NOT COALESCE(f.es_gasto_operativo, false) AND f.fecha_emision <= CURRENT_DATE
          GROUP BY f.articulo_id
        ),
        -- La foto del ERP no trae proveedor: se toma el de mayor monto comprado en 24 meses
        prov AS (
          SELECT DISTINCT ON (articulo_id) articulo_id, proveedor_id
          FROM (
            SELECT articulo_id, proveedor_id, SUM(total_sin_iva) AS monto
            FROM thermoplastica.fact_compras_linea
            WHERE tipo_doc = 'FACT' AND fecha_emision > CURRENT_DATE - INTERVAL '24 months'
            GROUP BY 1, 2
          ) x
          ORDER BY articulo_id, monto DESC
        )
        SELECT a.codigo_articulo AS codigo, a.descripcion,
               ${limpio('a.marca', 'Sin categoría')}    AS categoria,
               ${limpio('a.linea', 'Sin subcategoría')} AS subcategoria,
               ${limpio('a.sublinea', 'Sin sublínea')}  AS sublinea,
               p.codigo_proveedor AS proveedor_codigo, ${NOMBRE_PROV} AS proveedor,
               COALESCE(s.stock_actual, 0) AS stock, COALESCE(s.stock_en_transito, 0) AS transito,
               COALESCE(s.costo_promedio, 0) AS costo, COALESCE(s.costo_ultimo, 0) AS costo_ultimo,
               COALESCE(s.precio_venta_1, 0) AS precio,
               CASE WHEN s.stock_actual > 0 THEN COALESCE(s.valor_inventario, 0) ELSE 0 END AS valor,
               s.margen_bruto_pct AS margen,
               sa.clase, sa.estado,
               COALESCE(v.ventas, 0) AS ventas, COALESCE(v.unidades, 0) AS unidades_vendidas, COALESCE(v.cogs, 0) AS cogs,
               COALESCE(v.ventas_90, 0) AS ventas_90, COALESCE(v.meses_venta_6m, 0) AS meses_venta_6m, v.ultima_venta,
               COALESCE(c.compras, 0) AS compras, COALESCE(c.unidades, 0) AS unidades_compradas,
               COALESCE(c.compras_90, 0) AS compras_90, COALESCE(c.meses_compra_6m, 0) AS meses_compra_6m, c.ultima_compra,
               ${NO_INVENTARIO} AS no_inventario
        FROM thermoplastica.dim_articulo a
        LEFT JOIN snap s ON s.articulo_id = a.articulo_id
        LEFT JOIN analitica.v_inventario_salud sa ON sa.articulo_id = a.articulo_id
        LEFT JOIN prov pv ON pv.articulo_id = a.articulo_id
        LEFT JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = COALESCE(s.proveedor_id, pv.proveedor_id)
        LEFT JOIN v ON v.articulo_id = a.articulo_id
        LEFT JOIN c ON c.articulo_id = a.articulo_id
        WHERE s.stock_actual > 0 OR s.stock_en_transito > 0
           OR (NOT ${NO_INVENTARIO} AND (COALESCE(v.ventas, 0) > 0 OR COALESCE(c.compras, 0) > 0
                                         OR COALESCE(v.ventas_90, 0) > 0 OR COALESCE(c.compras_90, 0) > 0))
      `),
      db.getAsync(`
        SELECT (SELECT COUNT(*) FROM thermoplastica.fact_inventario_snapshot
                 WHERE fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_inventario_snapshot)) AS catalogo,
               (SELECT MAX(fecha_snapshot)::date::text FROM thermoplastica.fact_inventario_snapshot) AS corte
      `),
    ]);

    const num = (x) => parseFloat(x) || 0;
    const fecha = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
    const hoy = Date.now();
    const diasDesde = (d) => (d ? Math.floor((hoy - new Date(d).getTime()) / 86400000) : null);
    const filas = rows.map(r => {
      const ventas = num(r.ventas), compras = num(r.compras);
      // Sin stock hoy la vista de salud no trae clase: se deduce de la historia
      const clase = r.clase || (r.ultima_venta ? 'producto' : r.ultima_compra ? 'materia_prima' : 'sin_movimiento');
      const salida = clase === 'producto' ? num(r.cogs) : clase === 'materia_prima' ? compras : 0;
      const salida90 = clase === 'producto' ? num(r.ventas_90) : clase === 'materia_prima' ? num(r.compras_90) : 0;
      const meses6m = parseInt(clase === 'producto' ? r.meses_venta_6m : r.meses_compra_6m) || 0;
      const valor = num(r.valor);
      const stock = num(r.stock);
      const ultimaMov = clase === 'producto' ? r.ultima_venta : r.ultima_compra;
      return {
        codigo: r.codigo, descripcion: r.descripcion,
        categoria: r.categoria, subcategoria: r.subcategoria, sublinea: r.sublinea,
        proveedor_codigo: r.proveedor_codigo || null, proveedor: r.proveedor || null,
        clase, estado: stock > 0 ? (r.estado || 'activo') : 'sin_stock',
        stock, transito: num(r.transito), costo: num(r.costo), costo_ultimo: num(r.costo_ultimo), precio: num(r.precio),
        margen: r.margen !== null && r.margen !== undefined ? Math.round(num(r.margen) * 10) / 10 : null,
        valor: Math.round(valor * 100) / 100,
        valor_transito: Math.round(num(r.transito) * num(r.costo) * 100) / 100,
        ventas: Math.round(ventas), unidades_vendidas: num(r.unidades_vendidas),
        compras: Math.round(compras), unidades_compradas: num(r.unidades_compradas),
        salida: Math.round(salida),
        // Para la cobertura de un grupo: costo de ventas, o compras si el grupo es solo materia prima
        cogs: clase === 'producto' ? Math.round(num(r.cogs)) : 0,
        consumo_mp: clase === 'materia_prima' ? Math.round(compras) : 0,
        meses_demanda_6m: meses6m,
        dias_cobertura: salida > 0 ? Math.round(valor / (salida / P.dias)) : null,
        // Mucho se fabrica contra pedido (stock 0 es normal): solo cuenta como quiebre si la
        // demanda es recurrente (≥ 3 de los últimos 6 meses), hubo salida en 90 días y no hay tránsito
        quiebre: stock <= 0 && num(r.transito) <= 0 && salida90 > 0 && meses6m >= 3 && !r.no_inventario,
        ultima_venta: fecha(r.ultima_venta), ultima_compra: fecha(r.ultima_compra),
        dias_sin_mov: diasDesde(ultimaMov),
        no_inventario: !!r.no_inventario,
      };
    });

    const COLS = Object.keys(filas[0] || {}).concat('abc');
    // ABC por salida del período
    const conSalida = filas.filter(f => f.salida > 0).sort((a, b) => b.salida - a.salida);
    const totalSalida = conSalida.reduce((s, f) => s + f.salida, 0);
    let acum = 0;
    for (const f of conSalida) {
      const antes = acum / totalSalida;
      acum += f.salida;
      f.abc = antes < 0.80 ? 'A' : antes < 0.95 ? 'B' : 'C';
    }
    for (const f of filas) if (!f.abc) f.abc = 'N';

    const body = {
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        fecha_corte: meta?.corte || null,
        catalogo: parseInt(meta?.catalogo) || 0,
        // Formato compacto (columnas + filas como arreglos): ~2,000 artículos sin repetir claves
        columnas: COLS,
        filas: filas.map(f => COLS.map(c => f[c])),
      },
    };
    cacheAnalitica.set(key, { t: Date.now(), body });
    if (cacheAnalitica.size > 20) cacheAnalitica.delete(cacheAnalitica.keys().next().value);
    res.json(body);
  } catch (error) {
    console.error('inventario analitica error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
