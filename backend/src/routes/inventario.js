const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const { parsePeriodo } = require('../services/periodo');
const M = require('../services/margen');

// El stock es la foto más reciente del ERP (no hay historia de snapshots). El filtro
// de fechas aplica al MOVIMIENTO: ventas y compras del período, rotación y artículos
// con stock que no se vendieron en la ventana.

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

    // Distribución por línea (top 10)
    const porLinea = await db.allAsync(`
      SELECT COALESCE(a.linea, 'Sin línea') AS linea,
             COUNT(*)                        AS articulos,
             COALESCE(SUM(i.valor_inventario), 0) AS valor
      FROM thermoplastica.fact_inventario_snapshot i
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = i.articulo_id
      GROUP BY a.linea
      ORDER BY valor DESC
      LIMIT 10
    `);

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
        por_linea: porLinea.map(r => ({
          linea: r.linea,
          articulos: parseInt(r.articulos) || 0,
          valor: parseFloat(r.valor) || 0,
          porcentaje: total > 0 ? Math.round(parseFloat(r.valor) / total * 1000) / 10 : 0,
        })),
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
    if (linea) {
      params.push(linea);
      where.push(`a.linea = $${params.length}`);
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

module.exports = router;
