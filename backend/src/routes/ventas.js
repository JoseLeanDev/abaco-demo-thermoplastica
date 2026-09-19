const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

function parseWindow(req) {
  const hasta = req.query.hasta ? new Date(req.query.hasta) : new Date();
  const desde = req.query.desde ? new Date(req.query.desde)
                                : new Date(new Date().setMonth(hasta.getMonth() - 11, 1));
  return {
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
  };
}

// GET /api/ventas   Resumen: KPIs + serie mensual
router.get('/', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);

    const kpis = await db.getAsync(`
      SELECT
        COALESCE(SUM(total_sin_iva), 0)                                            AS ventas_sin_iva,
        COALESCE(SUM(total_con_iva), 0)                                            AS ventas_con_iva,
        COALESCE(SUM(costo_total_facturado), 0)                                    AS costo_total,
        COALESCE(SUM(margen_bruto), 0)                                             AS margen_bruto,
        COALESCE(SUM(iva), 0)                                                      AS iva_debito,
        COUNT(DISTINCT fact_num)                                                   AS facturas,
        COUNT(DISTINCT cliente_id)                                                 AS clientes,
        COUNT(DISTINCT vendedor_id) FILTER (WHERE vendedor_id IS NOT NULL)         AS vendedores,
        COUNT(*)                                                                   AS lineas
      FROM thermoplastica.fact_ventas_linea
      WHERE fecha_emision BETWEEN ? AND ?
        AND tipo_doc = 'FACT'
    `, [desde, hasta]);

    const mensual = await db.allAsync(`
      SELECT TO_CHAR(fecha_emision, 'YYYY-MM')     AS periodo,
             COALESCE(SUM(total_sin_iva), 0)       AS ventas,
             COALESCE(SUM(costo_total_facturado), 0) AS costo,
             COALESCE(SUM(margen_bruto), 0)         AS margen,
             COUNT(DISTINCT fact_num)               AS facturas
      FROM thermoplastica.fact_ventas_linea
      WHERE fecha_emision BETWEEN ? AND ?
        AND tipo_doc = 'FACT'
      GROUP BY 1 ORDER BY 1
    `, [desde, hasta]);

    const ventas = parseFloat(kpis.ventas_sin_iva) || 0;
    const costo  = parseFloat(kpis.costo_total)   || 0;
    const margen = parseFloat(kpis.margen_bruto)  || 0;
    const margenPct = ventas > 0 ? (margen / ventas * 100) : null;
    const ticketProm = (parseInt(kpis.facturas) || 0) > 0 ? ventas / parseInt(kpis.facturas) : 0;

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        ventas_sin_iva: ventas,
        ventas_con_iva: parseFloat(kpis.ventas_con_iva) || 0,
        costo_total: costo,
        margen_bruto: margen,
        margen_bruto_pct: margenPct,
        iva_debito: parseFloat(kpis.iva_debito) || 0,
        facturas: parseInt(kpis.facturas) || 0,
        clientes: parseInt(kpis.clientes) || 0,
        vendedores: parseInt(kpis.vendedores) || 0,
        lineas: parseInt(kpis.lineas) || 0,
        ticket_promedio: ticketProm,
        serie_mensual: mensual.map(m => ({
          periodo: m.periodo,
          ventas: parseFloat(m.ventas) || 0,
          costo: parseFloat(m.costo) || 0,
          margen: parseFloat(m.margen) || 0,
          margen_pct: parseFloat(m.ventas) > 0 ? (parseFloat(m.margen) / parseFloat(m.ventas) * 100) : 0,
          facturas: parseInt(m.facturas) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/clientes   Top clientes por venta
router.get('/clientes', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit = Math.min(parseInt(req.query.limit) || 15, 100);

    const rows = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(total_sin_iva), 0) AS total
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision BETWEEN ? AND ? AND tipo_doc = 'FACT'
      )
      SELECT
        c.codigo_cliente         AS codigo,
        c.nombre                 AS cliente,
        c.forma_pago,
        COUNT(DISTINCT f.fact_num) AS facturas,
        COUNT(*)                 AS lineas,
        COALESCE(SUM(f.total_sin_iva), 0)     AS ventas,
        COALESCE(SUM(f.margen_bruto), 0)      AS margen,
        CASE WHEN SUM(f.total_sin_iva) > 0
             THEN ROUND((SUM(f.margen_bruto) / SUM(f.total_sin_iva) * 100)::numeric, 1)
             ELSE NULL END       AS margen_pct,
        CASE WHEN (SELECT total FROM tot) > 0
             THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
             ELSE 0 END          AS porcentaje
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id
      WHERE f.fecha_emision BETWEEN ? AND ? AND f.tipo_doc = 'FACT'
      GROUP BY c.codigo_cliente, c.nombre, c.forma_pago
      ORDER BY ventas DESC
      LIMIT ${limit}
    `, [desde, hasta, desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        clientes: rows.map(r => ({
          codigo: r.codigo,
          cliente: r.cliente,
          forma_pago: r.forma_pago,
          facturas: parseInt(r.facturas) || 0,
          lineas: parseInt(r.lineas) || 0,
          ventas: parseFloat(r.ventas) || 0,
          margen: parseFloat(r.margen) || 0,
          margen_pct: r.margen_pct !== null ? parseFloat(r.margen_pct) : null,
          porcentaje: parseFloat(r.porcentaje) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/vendedores   Ranking vendedores
router.get('/vendedores', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);

    const rows = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(total_sin_iva), 0) AS total
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision BETWEEN ? AND ? AND tipo_doc = 'FACT'
      )
      SELECT
        v.nombre                                AS vendedor,
        v.codigo_vendedor                       AS codigo,
        COUNT(DISTINCT f.cliente_id)            AS clientes,
        COUNT(DISTINCT f.fact_num)              AS facturas,
        COALESCE(SUM(f.total_sin_iva), 0)       AS ventas,
        COALESCE(SUM(f.margen_bruto), 0)        AS margen,
        CASE WHEN SUM(f.total_sin_iva) > 0
             THEN ROUND((SUM(f.margen_bruto) / SUM(f.total_sin_iva) * 100)::numeric, 1)
             ELSE NULL END                      AS margen_pct,
        CASE WHEN (SELECT total FROM tot) > 0
             THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
             ELSE 0 END                         AS porcentaje
      FROM thermoplastica.fact_ventas_linea f
      LEFT JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
      WHERE f.fecha_emision BETWEEN ? AND ? AND f.tipo_doc = 'FACT'
        AND v.vendedor_id IS NOT NULL
      GROUP BY v.nombre, v.codigo_vendedor
      ORDER BY ventas DESC
    `, [desde, hasta, desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        vendedores: rows.map(r => ({
          codigo: r.codigo,
          vendedor: r.vendedor,
          clientes: parseInt(r.clientes) || 0,
          facturas: parseInt(r.facturas) || 0,
          ventas: parseFloat(r.ventas) || 0,
          margen: parseFloat(r.margen) || 0,
          margen_pct: r.margen_pct !== null ? parseFloat(r.margen_pct) : null,
          porcentaje: parseFloat(r.porcentaje) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/articulos   Top artículos por venta
router.get('/articulos', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit = Math.min(parseInt(req.query.limit) || 15, 100);

    const rows = await db.allAsync(`
      SELECT
        a.codigo_articulo    AS codigo,
        a.descripcion,
        a.linea, a.sublinea,
        COUNT(DISTINCT f.fact_num)             AS facturas,
        COUNT(DISTINCT f.cliente_id)           AS clientes,
        COALESCE(SUM(f.unidades), 0)           AS unidades,
        COALESCE(SUM(f.total_sin_iva), 0)      AS ventas,
        COALESCE(SUM(f.margen_bruto), 0)       AS margen,
        CASE WHEN SUM(f.total_sin_iva) > 0
             THEN ROUND((SUM(f.margen_bruto) / SUM(f.total_sin_iva) * 100)::numeric, 1)
             ELSE NULL END                     AS margen_pct
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ? AND f.tipo_doc = 'FACT'
      GROUP BY a.codigo_articulo, a.descripcion, a.linea, a.sublinea
      ORDER BY ventas DESC
      LIMIT ${limit}
    `, [desde, hasta]);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        articulos: rows.map(r => ({
          codigo: r.codigo,
          descripcion: r.descripcion,
          linea: r.linea,
          sublinea: r.sublinea,
          facturas: parseInt(r.facturas) || 0,
          clientes: parseInt(r.clientes) || 0,
          unidades: parseFloat(r.unidades) || 0,
          ventas: parseFloat(r.ventas) || 0,
          margen: parseFloat(r.margen) || 0,
          margen_pct: r.margen_pct !== null ? parseFloat(r.margen_pct) : null,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/lineas   Ventas por línea de producto (agregado)
router.get('/lineas', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const rows = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(total_sin_iva), 0) AS total
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision BETWEEN ? AND ? AND tipo_doc = 'FACT'
      )
      SELECT
        COALESCE(a.linea, 'Sin línea')          AS linea,
        COUNT(DISTINCT f.fact_num)              AS facturas,
        COUNT(DISTINCT f.cliente_id)            AS clientes,
        COUNT(DISTINCT f.articulo_id)           AS skus,
        COALESCE(SUM(f.unidades), 0)            AS unidades,
        COALESCE(SUM(f.total_sin_iva), 0)       AS ventas,
        COALESCE(SUM(f.costo_total_facturado), 0) AS costo,
        COALESCE(SUM(f.margen_bruto), 0)        AS margen,
        CASE WHEN SUM(f.total_sin_iva) > 0
             THEN ROUND((SUM(f.margen_bruto) / SUM(f.total_sin_iva) * 100)::numeric, 1)
             ELSE NULL END                       AS margen_pct,
        CASE WHEN (SELECT total FROM tot) > 0
             THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
             ELSE 0 END                          AS porcentaje
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision BETWEEN ? AND ? AND f.tipo_doc = 'FACT'
      GROUP BY a.linea
      ORDER BY ventas DESC
    `, [desde, hasta, desde, hasta]);

    res.json({
      status: 'success',
      data: {
        ventana: { desde, hasta },
        lineas: rows.map(r => ({
          linea: r.linea,
          facturas: parseInt(r.facturas) || 0,
          clientes: parseInt(r.clientes) || 0,
          skus: parseInt(r.skus) || 0,
          unidades: parseFloat(r.unidades) || 0,
          ventas: parseFloat(r.ventas) || 0,
          costo: parseFloat(r.costo) || 0,
          margen: parseFloat(r.margen) || 0,
          margen_pct: r.margen_pct !== null ? parseFloat(r.margen_pct) : null,
          porcentaje: parseFloat(r.porcentaje) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/serie-vendedores   Serie mensual de los top N vendedores
router.get('/serie-vendedores', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    const rows = await db.allAsync(`
      WITH top_v AS (
        SELECT vendedor_id
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision BETWEEN ? AND ? AND tipo_doc = 'FACT' AND vendedor_id IS NOT NULL
        GROUP BY vendedor_id
        ORDER BY SUM(total_sin_iva) DESC
        LIMIT ${limit}
      )
      SELECT TO_CHAR(f.fecha_emision, 'YYYY-MM') AS periodo,
             v.nombre AS vendedor,
             COALESCE(SUM(f.total_sin_iva), 0) AS ventas
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
      JOIN top_v tv ON tv.vendedor_id = f.vendedor_id
      WHERE f.fecha_emision BETWEEN ? AND ? AND f.tipo_doc = 'FACT'
      GROUP BY 1, v.nombre
      ORDER BY 1
    `, [desde, hasta, desde, hasta]);

    // Pivot: { periodo, 'MARIA JOSE MARTINEZ': 12345, 'SERGIO SOSA': 6789, ... }
    const periodos = {};
    const vendedoresSet = new Set();
    rows.forEach(r => {
      vendedoresSet.add(r.vendedor);
      if (!periodos[r.periodo]) periodos[r.periodo] = { periodo: r.periodo };
      periodos[r.periodo][r.vendedor] = parseFloat(r.ventas) || 0;
    });

    res.json({
      status: 'success',
      data: {
        ventana: { desde, hasta },
        vendedores: [...vendedoresSet],
        serie: Object.values(periodos).sort((a,b) => a.periodo.localeCompare(b.periodo)),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/serie-lineas   Serie mensual de las top N líneas
router.get('/serie-lineas', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    const rows = await db.allAsync(`
      WITH top_l AS (
        SELECT a.linea
        FROM thermoplastica.fact_ventas_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision BETWEEN ? AND ? AND f.tipo_doc = 'FACT' AND a.linea IS NOT NULL
        GROUP BY a.linea
        ORDER BY SUM(f.total_sin_iva) DESC
        LIMIT ${limit}
      )
      SELECT TO_CHAR(f.fecha_emision, 'YYYY-MM') AS periodo,
             a.linea AS linea,
             COALESCE(SUM(f.total_sin_iva), 0) AS ventas
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      JOIN top_l tl ON tl.linea = a.linea
      WHERE f.fecha_emision BETWEEN ? AND ? AND f.tipo_doc = 'FACT'
      GROUP BY 1, a.linea
      ORDER BY 1
    `, [desde, hasta, desde, hasta]);

    const periodos = {};
    const lineasSet = new Set();
    rows.forEach(r => {
      lineasSet.add(r.linea);
      if (!periodos[r.periodo]) periodos[r.periodo] = { periodo: r.periodo };
      periodos[r.periodo][r.linea] = parseFloat(r.ventas) || 0;
    });

    res.json({
      status: 'success',
      data: {
        ventana: { desde, hasta },
        lineas: [...lineasSet],
        serie: Object.values(periodos).sort((a,b) => a.periodo.localeCompare(b.periodo)),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/detalle   Listado paginado
router.get('/detalle', async (req, res) => {
  try {
    const { desde, hasta } = parseWindow(req);
    const limit    = Math.min(parseInt(req.query.limit) || 200, 1000);
    const offset   = parseInt(req.query.offset) || 0;
    const busqueda = (req.query.busqueda || '').trim();
    const cliente  = (req.query.codigo_cliente || '').trim();
    const vendedor = (req.query.vendedor || '').trim();

    const where = [`f.fecha_emision BETWEEN $1 AND $2`, `f.tipo_doc = 'FACT'`];
    const params = [desde, hasta];

    if (busqueda) {
      params.push(`%${busqueda}%`);
      const p = `$${params.length}`;
      where.push(`(c.nombre ILIKE ${p} OR c.codigo_cliente ILIKE ${p} OR a.descripcion ILIKE ${p} OR f.fact_num::text ILIKE ${p} OR f.fel ILIKE ${p})`);
    }
    if (cliente) {
      params.push(cliente);
      where.push(`c.codigo_cliente = $${params.length}`);
    }
    if (vendedor) {
      params.push(vendedor);
      where.push(`v.nombre = $${params.length}`);
    }

    const whereSql = where.join(' AND ');

    const rows = await db.allAsync(`
      SELECT
        f.venta_id                             AS id,
        f.fact_num, f.tipo_doc, f.fecha_emision, f.fel,
        c.codigo_cliente, c.nombre AS cliente,
        v.nombre                               AS vendedor,
        v.codigo_vendedor,
        s.codigo_sucursal, s.nombre AS sucursal,
        a.codigo_articulo, a.descripcion AS articulo, a.linea, a.sublinea,
        f.unidades, f.total_sin_iva, f.total_con_iva, f.iva, f.saldo,
        f.costo_promedio_facturado, f.costo_total_facturado,
        f.margen_bruto, f.margen_bruto_pct,
        f.tipo_cliente
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_cliente  c ON c.cliente_id  = f.cliente_id
      JOIN thermoplastica.dim_sucursal s ON s.sucursal_id = f.sucursal_id
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      LEFT JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
      WHERE ${whereSql}
      ORDER BY f.fecha_emision DESC, f.total_sin_iva DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    const totalRow = await db.getAsync(`
      SELECT COUNT(*) AS total, COALESCE(SUM(f.total_sin_iva), 0) AS suma
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_cliente  c ON c.cliente_id  = f.cliente_id
      LEFT JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE ${whereSql}
    `, params);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: { desde, hasta },
        total_filas: parseInt(totalRow.total) || 0,
        suma_ventas: parseFloat(totalRow.suma) || 0,
        filas: rows.map(r => ({
          id: parseInt(r.id),
          fact_num: r.fact_num,
          tipo_doc: r.tipo_doc,
          fecha_emision: r.fecha_emision,
          fel: r.fel,
          codigo_cliente: r.codigo_cliente,
          cliente: r.cliente,
          vendedor: r.vendedor,
          codigo_vendedor: r.codigo_vendedor,
          codigo_sucursal: r.codigo_sucursal,
          sucursal: r.sucursal,
          codigo_articulo: r.codigo_articulo,
          articulo: r.articulo,
          linea: r.linea,
          sublinea: r.sublinea,
          unidades: parseFloat(r.unidades) || 0,
          total_sin_iva: parseFloat(r.total_sin_iva) || 0,
          total_con_iva: parseFloat(r.total_con_iva) || 0,
          iva: parseFloat(r.iva) || 0,
          saldo: parseFloat(r.saldo) || 0,
          costo_promedio_facturado: parseFloat(r.costo_promedio_facturado) || 0,
          costo_total_facturado: parseFloat(r.costo_total_facturado) || 0,
          margen_bruto: parseFloat(r.margen_bruto) || 0,
          margen_bruto_pct: r.margen_bruto_pct !== null ? parseFloat(r.margen_bruto_pct) : null,
          tipo_cliente: r.tipo_cliente,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
