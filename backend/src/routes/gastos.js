const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

// Ventana default: 12 meses hacia atrás
function parseWindow(req) {
  const hasta = req.query.hasta ? new Date(req.query.hasta) : new Date();
  const desde = req.query.desde ? new Date(req.query.desde)
                                : new Date(new Date().setMonth(hasta.getMonth() - 11, 1));
  return {
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
  };
}

// Todas las queries filtran es_gasto_operativo = TRUE.
// La agrupación primaria es por SUBLINEA (centro de costo) — en el ERP
// TP_A la "categoria" es fija 'Gastos de Operación' para todos.
const FILTRO_GASTO = 'AND COALESCE(a.es_gasto_operativo, FALSE) = TRUE';

// GET /api/gastos   Resumen: KPIs + serie mensual
router.get('/', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);

    const kpis = await db.getAsync(`
      SELECT
        COALESCE(SUM(f.total_sin_iva), 0)     AS gasto_sin_iva,
        COALESCE(SUM(f.total_con_iva), 0)     AS gasto_con_iva,
        COALESCE(SUM(f.iva), 0)               AS iva_acreditable,
        COUNT(DISTINCT f.fact_num)            AS facturas,
        COUNT(DISTINCT f.proveedor_id)        AS proveedores,
        COUNT(DISTINCT a.sublinea)            AS centros_costo,
        COUNT(*)                              AS lineas
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${FILTRO_GASTO}
    `, [desde, hasta]);

    const mensual = await db.allAsync(`
      SELECT
        TO_CHAR(f.fecha_emision, 'YYYY-MM')     AS periodo,
        COALESCE(SUM(f.total_sin_iva), 0)       AS gasto_sin_iva,
        COALESCE(SUM(f.total_con_iva), 0)       AS gasto_con_iva,
        COUNT(DISTINCT f.fact_num)              AS facturas
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${FILTRO_GASTO}
      GROUP BY 1
      ORDER BY 1
    `, [desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        gasto_sin_iva: parseFloat(kpis.gasto_sin_iva) || 0,
        gasto_con_iva: parseFloat(kpis.gasto_con_iva) || 0,
        iva_acreditable: parseFloat(kpis.iva_acreditable) || 0,
        facturas: parseInt(kpis.facturas) || 0,
        proveedores: parseInt(kpis.proveedores) || 0,
        centros_costo: parseInt(kpis.centros_costo) || 0,
        lineas: parseInt(kpis.lineas) || 0,
        serie_mensual: mensual.map(m => ({
          periodo: m.periodo,
          gasto_sin_iva: parseFloat(m.gasto_sin_iva) || 0,
          gasto_con_iva: parseFloat(m.gasto_con_iva) || 0,
          facturas: parseInt(m.facturas) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/gastos/centros-costo   Breakdown por sublinea (centro de costo)
router.get('/centros-costo', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const rows = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(f.total_sin_iva), 0) AS total
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision BETWEEN ? AND ?
          ${FILTRO_GASTO}
      )
      SELECT
        COALESCE(a.sublinea, 'Sin centro')          AS centro_costo,
        COUNT(*)                                    AS lineas,
        COUNT(DISTINCT f.fact_num)                  AS facturas,
        COALESCE(SUM(f.total_sin_iva), 0)           AS gasto_sin_iva,
        COALESCE(SUM(f.total_con_iva), 0)           AS gasto_con_iva,
        CASE WHEN (SELECT total FROM tot) > 0
             THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
             ELSE 0 END                             AS porcentaje
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${FILTRO_GASTO}
      GROUP BY a.sublinea
      ORDER BY gasto_sin_iva DESC
      LIMIT ${limit}
    `, [desde, hasta, desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        centros: rows.map(r => ({
          centro_costo: r.centro_costo,
          lineas: parseInt(r.lineas) || 0,
          facturas: parseInt(r.facturas) || 0,
          gasto_sin_iva: parseFloat(r.gasto_sin_iva) || 0,
          gasto_con_iva: parseFloat(r.gasto_con_iva) || 0,
          porcentaje: parseFloat(r.porcentaje) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/gastos/proveedores   Top proveedores de gastos operativos
router.get('/proveedores', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const rows = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(f.total_sin_iva), 0) AS total
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision BETWEEN ? AND ?
          ${FILTRO_GASTO}
      )
      SELECT
        p.codigo_proveedor,
        p.nombre                                    AS proveedor,
        p.rif,
        COUNT(DISTINCT f.fact_num)                  AS facturas,
        COUNT(*)                                    AS lineas,
        COALESCE(SUM(f.total_sin_iva), 0)           AS gasto_sin_iva,
        CASE WHEN (SELECT total FROM tot) > 0
             THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
             ELSE 0 END                             AS porcentaje,
        MAX(f.fecha_emision)                        AS ultima_compra
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ?
        ${FILTRO_GASTO}
      GROUP BY p.codigo_proveedor, p.nombre, p.rif
      ORDER BY gasto_sin_iva DESC
      LIMIT ${limit}
    `, [desde, hasta, desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        proveedores: rows.map(r => ({
          codigo: r.codigo_proveedor,
          proveedor: r.proveedor,
          rif: r.rif,
          facturas: parseInt(r.facturas) || 0,
          lineas: parseInt(r.lineas) || 0,
          gasto_sin_iva: parseFloat(r.gasto_sin_iva) || 0,
          porcentaje: parseFloat(r.porcentaje) || 0,
          ultima_compra: r.ultima_compra,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/gastos/detalle    Listado paginado con filtros
router.get('/detalle', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit  = Math.min(parseInt(req.query.limit) || 200, 1000);
    const offset = parseInt(req.query.offset) || 0;
    const busqueda = (req.query.busqueda || '').trim();
    const proveedor = req.query.codigo_proveedor || '';
    const centroCosto = req.query.centro_costo || '';

    const where = [`f.fecha_emision BETWEEN $1 AND $2`, `COALESCE(a.es_gasto_operativo, FALSE) = TRUE`];
    const params = [desde, hasta];

    if (busqueda) {
      params.push(`%${busqueda}%`);
      const p = `$${params.length}`;
      where.push(`(p.nombre ILIKE ${p} OR p.codigo_proveedor ILIKE ${p} OR a.descripcion ILIKE ${p} OR f.fact_num::text ILIKE ${p})`);
    }
    if (proveedor) {
      params.push(proveedor);
      where.push(`p.codigo_proveedor = $${params.length}`);
    }
    if (centroCosto) {
      params.push(centroCosto);
      where.push(`a.sublinea = $${params.length}`);
    }

    const whereSql = where.join(' AND ');

    const rows = await db.allAsync(`
      SELECT
        f.compra_id                                 AS id,
        f.fact_num, f.tipo_doc, f.fecha_emision,
        p.codigo_proveedor, p.nombre AS proveedor, p.rif,
        s.codigo_sucursal, s.nombre AS sucursal,
        a.codigo_articulo, a.descripcion AS articulo,
        a.sublinea AS centro_costo,
        f.unidades, f.total_sin_iva, f.total_con_iva, f.iva, f.saldo
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      JOIN thermoplastica.dim_sucursal  s ON s.sucursal_id  = f.sucursal_id
      JOIN thermoplastica.dim_articulo  a ON a.articulo_id  = f.articulo_id
      WHERE ${whereSql}
      ORDER BY f.fecha_emision DESC, f.total_sin_iva DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    const totalRow = await db.getAsync(`
      SELECT COUNT(*) AS total, COALESCE(SUM(f.total_sin_iva), 0) AS suma_sin_iva
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      JOIN thermoplastica.dim_articulo  a ON a.articulo_id  = f.articulo_id
      WHERE ${whereSql}
    `, params);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        total_filas: parseInt(totalRow.total) || 0,
        suma_sin_iva_filtrada: parseFloat(totalRow.suma_sin_iva) || 0,
        filas: rows.map(r => ({
          id: parseInt(r.id),
          fact_num: r.fact_num,
          tipo_doc: r.tipo_doc,
          fecha_emision: r.fecha_emision,
          codigo_proveedor: r.codigo_proveedor,
          proveedor: r.proveedor,
          rif: r.rif,
          codigo_sucursal: r.codigo_sucursal,
          sucursal: r.sucursal,
          codigo_articulo: r.codigo_articulo,
          articulo: r.articulo,
          centro_costo: r.centro_costo,
          unidades: parseFloat(r.unidades) || 0,
          total_sin_iva: parseFloat(r.total_sin_iva) || 0,
          total_con_iva: parseFloat(r.total_con_iva) || 0,
          iva: parseFloat(r.iva) || 0,
          saldo: parseFloat(r.saldo) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
