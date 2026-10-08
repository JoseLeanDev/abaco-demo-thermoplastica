const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const M = require('../services/margen');

// Ventana default: año en curso (ver services/periodo.js).
const { parsePeriodo: parseWindow } = require('../services/periodo');

// GET /api/ventas   Resumen: KPIs + serie mensual
router.get('/', async (req, res) => {
  try {
    const P = parseWindow(req);
    const { desde, hasta } = P;
    const V = ventasFiltradas(req, P);
    const VP = ventasFiltradas(req, P, true);

    const kpis = await db.getAsync(`
      SELECT
        COALESCE(SUM(total_sin_iva), 0)                                            AS ventas_sin_iva,
        COALESCE(SUM(total_con_iva), 0)                                            AS ventas_con_iva,
        ${M.costo()}                                    AS costo_total,
        ${M.margen()}                                             AS margen_bruto,
        ${M.pctSinCosto()}                                        AS pct_sin_costo,
        COALESCE(SUM(iva), 0)                                                      AS iva_debito,
        COUNT(DISTINCT fact_num)                                                   AS facturas,
        COUNT(DISTINCT cliente_id)                                                 AS clientes,
        COUNT(DISTINCT vendedor_id) FILTER (WHERE vendedor_id IS NOT NULL)         AS vendedores,
        COUNT(*)                                                                   AS lineas
      FROM ${V.from} fv
    `, V.params);

    const mensual = await db.allAsync(`
      SELECT TO_CHAR(fecha_emision, 'YYYY-MM')     AS periodo,
             COALESCE(SUM(total_sin_iva), 0)       AS ventas,
             ${M.costo()} AS costo,
             ${M.margen()}         AS margen,
             COUNT(DISTINCT fact_num)               AS facturas
      FROM ${V.from} fv
      GROUP BY 1 ORDER BY 1
    `, V.params);

    // Mismo período del año anterior, para comparar
    const prev = await db.getAsync(`
      SELECT COALESCE(SUM(total_sin_iva), 0) AS ventas,
             COUNT(DISTINCT fact_num)        AS facturas,
             COUNT(DISTINCT cliente_id)      AS clientes,
             ${M.pct()}                      AS margen_pct
      FROM ${VP.from} fv
    `, VP.params);

    const ventas = parseFloat(kpis.ventas_sin_iva) || 0;
    const costo  = parseFloat(kpis.costo_total)   || 0;
    const margen = parseFloat(kpis.margen_bruto)  || 0;
    const margenPct = ventas > 0 ? (margen / ventas * 100) : null;
    const ticketProm = (parseInt(kpis.facturas) || 0) > 0 ? ventas / parseInt(kpis.facturas) : 0;

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        ventana: P.ventana(),
        ventas_sin_iva: ventas,
        ventas_prev: parseFloat(prev.ventas) || 0,
        variacion_pct: parseFloat(prev.ventas) > 0 ? Math.round((ventas - parseFloat(prev.ventas)) / parseFloat(prev.ventas) * 1000) / 10 : null,
        facturas_prev: parseInt(prev.facturas) || 0,
        clientes_prev: parseInt(prev.clientes) || 0,
        margen_pct_prev: prev.margen_pct === null ? null : Math.round(parseFloat(prev.margen_pct) * 10) / 10,
        ventas_con_iva: parseFloat(kpis.ventas_con_iva) || 0,
        costo_total: costo,
        margen_bruto: margen,
        margen_bruto_pct: margenPct,
        // % de las ventas sin costo en el ERP (excluidas del cálculo de margen %)
        pct_ventas_sin_costo: Math.round((parseFloat(kpis.pct_sin_costo) || 0) * 10) / 10,
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



// GET /api/ventas/articulos   Top artículos por venta
router.get('/articulos', async (req, res) => {
  try {
    const P = parseWindow(req);
    const { desde, hasta } = P;
    const limit = Math.min(parseInt(req.query.limit) || 15, 100);
    const V = ventasFiltradas(req, P);

    const rows = await db.allAsync(`
      SELECT
        a.codigo_articulo    AS codigo,
        a.descripcion,
        a.linea, a.sublinea,
        COUNT(DISTINCT f.fact_num)             AS facturas,
        COUNT(DISTINCT f.cliente_id)           AS clientes,
        COALESCE(SUM(f.unidades), 0)           AS unidades,
        COALESCE(SUM(f.total_sin_iva), 0)      AS ventas,
        ${M.margen('f')}       AS margen,
        CASE WHEN SUM(f.total_sin_iva) > 0
             THEN ROUND(${M.pct('f')}::numeric, 1)
             ELSE NULL END                     AS margen_pct,
        ROUND(${M.pctSinCosto('f')}::numeric, 1)  AS pct_sin_costo
      FROM ${V.from} f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      GROUP BY a.codigo_articulo, a.descripcion, a.linea, a.sublinea
      ORDER BY ventas DESC
      LIMIT ${limit}
    `, V.params);

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
          pct_sin_costo: parseFloat(r.pct_sin_costo) || 0,
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
        ${M.costo('f')} AS costo,
        ${M.margen('f')}        AS margen,
        CASE WHEN SUM(f.total_sin_iva) > 0
             THEN ROUND(${M.pct('f')}::numeric, 1)
             ELSE NULL END                       AS margen_pct,
        ROUND(${M.pctSinCosto('f')}::numeric, 1)  AS pct_sin_costo,
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
          pct_sin_costo: parseFloat(r.pct_sin_costo) || 0,
          porcentaje: parseFloat(r.porcentaje) || 0,
        })),
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

    where.push(...filtrosProducto(req, params));
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
          // Línea sin costo en el ERP: su margen es desconocido, no 100%.
          sin_costo: !(parseFloat(r.costo_total_facturado) > 0),
          margen_bruto: parseFloat(r.costo_total_facturado) > 0 ? parseFloat(r.margen_bruto) || 0 : null,
          margen_bruto_pct: parseFloat(r.costo_total_facturado) > 0 && r.margen_bruto_pct !== null ? parseFloat(r.margen_bruto_pct) : null,
          tipo_cliente: r.tipo_cliente,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// -------------------------------------------------------------------
// Desglose genérico con drill-down y filtros cruzados
// -------------------------------------------------------------------
// Jerarquía de producto del ERP (Profit):
//   Categoría    = campo "marca"    (Laminados, Liners, Soplado, ...)
//   Subcategoría = campo "linea"    (Induccion, Envase PE, PVDC, ...)
//   Sublínea     = campo "sublinea" (cuello 28, 250 micras, ...)
// El campo "categoria" del ERP es casi siempre igual a "linea", por eso no se usa.
const limpio = (e, vacio) => `COALESCE(NULLIF(TRIM(${e}), ''), '${vacio}')`;
const DIMS = {
  categoria:    { expr: limpio('a.marca', 'Sin categoría'),    label: null },
  subcategoria: { expr: limpio('a.linea', 'Sin subcategoría'), label: null },
  sublinea:     { expr: limpio('a.sublinea', 'Sin sublínea'),  label: null },
  articulo:     { expr: 'a.codigo_articulo',                   label: 'MAX(a.descripcion)', extra: 'MAX(a.marca)' },
  // El ERP antepone el código al nombre ("322253-COLGATE..."); se quita para mostrar
  cliente:      { expr: 'c.codigo_cliente',                    label: `MAX(REGEXP_REPLACE(c.nombre, '^[A-Za-z]*[0-9][0-9A-Za-z]*-', ''))`, extra: 'MAX(c.forma_pago)' },
  vendedor:     { expr: limpio('v.nombre', 'Sin vendedor'),    label: null,                 extra: 'MAX(v.codigo_vendedor)' },
  sucursal:     { expr: limpio('s.nombre', 'Sin sucursal'),    label: null },
  tipo_cliente: { expr: limpio(`REGEXP_REPLACE(f.tipo_cliente, '^\\s*\\d+\\s*-\\s*', '')`, 'Sin tipo'), label: null },
};
const JOINS = `
  FROM thermoplastica.fact_ventas_linea f
  JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
  JOIN thermoplastica.dim_cliente  c ON c.cliente_id  = f.cliente_id
  JOIN thermoplastica.dim_sucursal s ON s.sucursal_id = f.sucursal_id
  LEFT JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id`;

const dimDe = (x, def) => (DIMS[x] ? x : def);

// Filtros ?categoria=..&subcategoria=..&cliente=.. (se pueden combinar todos)
function filtrosDesglose(req, params) {
  const where = [];
  for (const [k, d] of Object.entries(DIMS)) {
    const val = req.query[k];
    if (val === undefined || val === '') continue;
    params.push(String(val));
    where.push(`${d.expr} = $${params.length}`);
  }
  return where;
}

// Solo los filtros de producto (para endpoints con sus propios filtros de cliente/vendedor)
const DIMS_PRODUCTO = ['categoria', 'subcategoria', 'sublinea'];
function filtrosProducto(req, params) {
  const where = [];
  for (const k of DIMS_PRODUCTO) {
    const val = req.query[k];
    if (val === undefined || val === '') continue;
    params.push(String(val));
    where.push(`${DIMS[k].expr} = $${params.length}`);
  }
  return where;
}

// Líneas de venta del período con el filtro de producto aplicado, como subconsulta
// con las mismas columnas de fact_ventas_linea (para no tocar las consultas viejas).
function ventasFiltradas(req, P, anterior = false) {
  const params = [];
  const w = filtrosProducto(req, params);
  return {
    params,
    from: `(SELECT f.* ${JOINS}
            WHERE f.tipo_doc = 'FACT' AND f.fecha_emision BETWEEN ${anterior ? P.prevD : P.D} AND ${anterior ? P.prevH : P.H}
            ${w.length ? 'AND ' + w.join(' AND ') : ''})`,
  };
}

const n = (x) => parseFloat(x) || 0;
const r1 = (x) => (x === null || x === undefined ? null : Math.round(parseFloat(x) * 10) / 10);
const varPct = (v, vp) => (vp > 0 ? Math.round((v - vp) / vp * 1000) / 10 : null);

// Ranking del período por `dim`, con comparación contra el período anterior y la
// descomposición de la variación en efecto precio / volumen / nuevos / perdidos.
// La descomposición se hace artículo por artículo dentro de cada grupo (mismo
// artículo en ambos períodos → precio y volumen; solo en uno → nuevo o perdido).
async function calcularDesglose(req, dim) {
  const P = parseWindow(req);
  const D = DIMS[dim];
  const params = [];
  const filtros = filtrosDesglose(req, params);
  const act  = `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`;
  const prev = `f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}`;
  const where = [`f.tipo_doc = 'FACT'`, `((${act}) OR (${prev}))`, ...filtros].join(' AND ');

  const [rows, efectos] = await Promise.all([
    db.allAsync(`
      SELECT
        ${D.expr}                                                     AS clave,
        ${D.label || D.expr}                                          AS nombre,
        ${D.extra || 'NULL'}                                          AS extra,
        COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${act}), 0)       AS ventas,
        COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${prev}), 0)      AS ventas_prev,
        COALESCE(SUM(f.unidades) FILTER (WHERE ${act}), 0)            AS unidades,
        COALESCE(SUM(f.unidades) FILTER (WHERE ${prev}), 0)           AS unidades_prev,
        COUNT(DISTINCT f.fact_num)    FILTER (WHERE ${act})           AS facturas,
        COUNT(DISTINCT f.cliente_id)  FILTER (WHERE ${act})           AS clientes,
        COUNT(DISTINCT f.cliente_id)  FILTER (WHERE ${prev})          AS clientes_prev,
        COUNT(DISTINCT f.articulo_id) FILTER (WHERE ${act})           AS skus,
        ${M.margen('f', act)}                                         AS margen,
        ${M.pct('f', act)}                                            AS margen_pct,
        ${M.pct('f', prev)}                                           AS margen_pct_prev,
        ${M.pctSinCosto('f', act)}                                    AS pct_sin_costo,
        MAX(f.fecha_emision) FILTER (WHERE ${act})                    AS ultima_venta
      ${JOINS}
      WHERE ${where}
      GROUP BY ${D.expr}
      ORDER BY ventas DESC, ventas_prev DESC
    `, params),
    db.allAsync(`
      WITH base AS (
        SELECT ${D.expr} AS clave, f.articulo_id,
               COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${act}), 0)  AS v1,
               COALESCE(SUM(f.total_sin_iva) FILTER (WHERE ${prev}), 0) AS v0,
               COALESCE(SUM(f.unidades) FILTER (WHERE ${act}), 0)       AS u1,
               COALESCE(SUM(f.unidades) FILTER (WHERE ${prev}), 0)      AS u0
        ${JOINS}
        WHERE ${where}
        GROUP BY 1, 2
      )
      SELECT clave,
        SUM(CASE WHEN v1 > 0 AND v0 > 0 AND u1 > 0 AND u0 > 0 THEN (v1 / u1 - v0 / u0) * u1 ELSE 0 END) AS precio,
        SUM(CASE WHEN v1 > 0 AND v0 > 0 AND u1 > 0 AND u0 > 0 THEN (u1 - u0) * (v0 / u0)    ELSE 0 END) AS volumen,
        SUM(CASE WHEN v1 > 0 AND v0 <= 0 THEN v1  ELSE 0 END)                                         AS nuevos,
        SUM(CASE WHEN v0 > 0 AND v1 <= 0 THEN -v0 ELSE 0 END)                                         AS perdidos
      FROM base GROUP BY clave
    `, params),
  ]);

  const ef = Object.fromEntries(efectos.map(e => [e.clave, e]));
  const total = rows.reduce((s, r) => s + n(r.ventas), 0);
  const items = rows.map(r => {
    const v = n(r.ventas), vp = n(r.ventas_prev);
    const e = ef[r.clave] || {};
    const precio = n(e.precio), volumen = n(e.volumen), nuevos = n(e.nuevos), perdidos = n(e.perdidos);
    return {
      clave: r.clave,
      nombre: r.nombre,
      extra: r.extra,
      ventas: v,
      ventas_prev: vp,
      variacion: v - vp,
      variacion_pct: varPct(v, vp),
      efecto_precio: precio,
      efecto_volumen: volumen,
      efecto_nuevos: nuevos,
      efecto_perdidos: perdidos,
      // Notas de crédito, servicios sin unidades, etc.
      efecto_otros: (v - vp) - precio - volumen - nuevos - perdidos,
      unidades: n(r.unidades),
      unidades_prev: n(r.unidades_prev),
      precio_promedio: n(r.unidades) > 0 ? v / n(r.unidades) : null,
      precio_promedio_prev: n(r.unidades_prev) > 0 ? vp / n(r.unidades_prev) : null,
      facturas: parseInt(r.facturas) || 0,
      clientes: parseInt(r.clientes) || 0,
      clientes_prev: parseInt(r.clientes_prev) || 0,
      skus: parseInt(r.skus) || 0,
      margen: r.margen === null ? null : n(r.margen),
      margen_pct: r1(r.margen_pct),
      margen_pct_prev: r1(r.margen_pct_prev),
      pct_sin_costo: r1(r.pct_sin_costo) || 0,
      participacion: total > 0 ? Math.round(v / total * 1000) / 10 : 0,
      ultima_venta: r.ultima_venta,
      nuevo: v > 0 && vp === 0,
      perdido: v === 0 && vp > 0,
    };
  });
  const suma = (k) => items.reduce((s, i) => s + i[k], 0);
  const totalPrev = suma('ventas_prev');
  return {
    P, items, total, totalPrev,
    puente: {
      anterior: totalPrev,
      precio: suma('efecto_precio'),
      volumen: suma('efecto_volumen'),
      nuevos: suma('efecto_nuevos'),
      perdidos: suma('efecto_perdidos'),
      otros: suma('efecto_otros'),
      actual: total,
    },
  };
}

// GET /api/ventas/desglose?dim=categoria&categoria=Laminados&limit=100
router.get('/desglose', async (req, res) => {
  try {
    const dim = dimDe(req.query.dim, 'categoria');
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const { P, items, total, totalPrev, puente } = await calcularDesglose(req, dim);
    const perdidos = items.filter(i => i.perdido);
    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        dim,
        total,
        total_prev: totalPrev,
        variacion_pct: varPct(total, totalPrev),
        puente,
        n_items: items.filter(i => i.ventas > 0).length,
        n_items_prev: items.filter(i => i.ventas_prev > 0).length,
        items: items.filter(i => !i.perdido).slice(0, limit),
        // Vendían en el período anterior y en este no (ordenados por lo que se dejó de vender)
        perdidos: perdidos.sort((a, b) => b.ventas_prev - a.ventas_prev).slice(0, 25),
        venta_perdida: perdidos.reduce((s, i) => s + i.ventas_prev, 0),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/vendedores   Ranking de vendedores (acepta filtros de producto)
router.get('/vendedores', async (req, res) => {
  try {
    const { P, items, total, totalPrev } = await calcularDesglose(req, 'vendedor');
    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        total, total_prev: totalPrev, variacion_pct: varPct(total, totalPrev),
        vendedores: items.filter(i => i.clave !== 'Sin vendedor' && i.ventas > 0).map(i => ({
          ...i, vendedor: i.nombre, codigo: i.extra, porcentaje: i.participacion,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/clientes   Top clientes (acepta filtros de producto)
router.get('/clientes', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 15, 500);
    const { P, items, total, totalPrev } = await calcularDesglose(req, 'cliente');
    const activos = items.filter(i => i.ventas > 0);
    const perdidos = items.filter(i => i.perdido);
    res.json({
      status: 'success',
      data: {
        ventana: P.ventana(),
        total, total_prev: totalPrev, variacion_pct: varPct(total, totalPrev),
        n_clientes: activos.length,
        n_clientes_prev: items.filter(i => i.ventas_prev > 0).length,
        n_nuevos: activos.filter(i => i.nuevo).length,
        venta_nuevos: activos.filter(i => i.nuevo).reduce((s, i) => s + i.ventas, 0),
        n_perdidos: perdidos.length,
        venta_perdida: perdidos.reduce((s, i) => s + i.ventas_prev, 0),
        clientes: activos.slice(0, limit).map(i => ({
          ...i, codigo: i.clave, cliente: i.nombre, forma_pago: i.extra, porcentaje: i.participacion,
        })),
        perdidos: perdidos.sort((a, b) => b.ventas_prev - a.ventas_prev).slice(0, 25)
          .map(i => ({ ...i, codigo: i.clave, cliente: i.nombre })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/desglose-serie?dim=categoria&top=6&otros=1   Serie mensual de los top N (+ "Otros")
async function serieDesglose(req, dim, top, conOtros) {
  const P = parseWindow(req);
  const D = DIMS[dim];
  const params = [];
  const filtros = filtrosDesglose(req, params);
  const where = [`f.tipo_doc = 'FACT'`, `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`, ...filtros].join(' AND ');

  const rows = await db.allAsync(`
    WITH base AS (
      SELECT ${D.expr} AS clave, ${D.label ? D.label.replace(/^MAX\((.*)\)$/, '$1') : D.expr} AS nombre_fila,
             TO_CHAR(f.fecha_emision, 'YYYY-MM') AS periodo, f.total_sin_iva
      ${JOINS}
      WHERE ${where}
    ),
    ranking AS (
      SELECT clave, MAX(nombre_fila) AS nombre, SUM(total_sin_iva) AS total,
             ROW_NUMBER() OVER (ORDER BY SUM(total_sin_iva) DESC) AS rk
      FROM base GROUP BY clave
    )
    SELECT b.periodo,
           CASE WHEN r.rk <= ${top} THEN r.nombre ELSE 'Otros' END AS serie,
           MIN(r.rk) AS rk,
           SUM(b.total_sin_iva) AS ventas
    FROM base b JOIN ranking r USING (clave)
    ${conOtros ? '' : `WHERE r.rk <= ${top}`}
    GROUP BY 1, 2 ORDER BY 1, 3
  `, params);

  const nombres = [];
  for (const r of [...rows].sort((a, b) => a.rk - b.rk)) if (!nombres.includes(r.serie)) nombres.push(r.serie);
  const orden = [...nombres.filter(x => x !== 'Otros'), ...(nombres.includes('Otros') ? ['Otros'] : [])];
  const porMes = {};
  for (const r of rows) {
    porMes[r.periodo] = porMes[r.periodo] || { periodo: r.periodo };
    porMes[r.periodo][r.serie] = parseFloat(r.ventas) || 0;
  }
  return { ventana: P.ventana(), dim, series: orden, serie: Object.values(porMes).sort((a, b) => a.periodo.localeCompare(b.periodo)) };
}

router.get('/desglose-serie', async (req, res) => {
  try {
    const dim = dimDe(req.query.dim, 'categoria');
    const top = Math.min(parseInt(req.query.top) || 6, 12);
    res.json({ status: 'success', data: await serieDesglose(req, dim, top, req.query.otros !== '0') });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/serie-vendedores   Serie mensual de los top N vendedores (acepta filtros de producto)
router.get('/serie-vendedores', async (req, res) => {
  try {
    const top = Math.min(parseInt(req.query.limit) || 5, 20);
    const s = await serieDesglose(req, 'vendedor', top, false);
    res.json({ status: 'success', data: { ventana: s.ventana, vendedores: s.series, serie: s.serie } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/ventas/matriz?filas=categoria&columnas=vendedor&top_columnas=8&top_filas=30
// Tabla cruzada de ventas entre dos dimensiones (acepta los mismos filtros).
router.get('/matriz', async (req, res) => {
  try {
    const P = parseWindow(req);
    const fd = dimDe(req.query.filas, 'categoria');
    const cd = dimDe(req.query.columnas, 'vendedor');
    if (fd === cd) return res.status(400).json({ status: 'error', message: 'Filas y columnas deben ser dimensiones distintas' });
    const F = DIMS[fd], C = DIMS[cd];
    const topC = Math.min(parseInt(req.query.top_columnas) || 8, 15);
    const topF = Math.min(parseInt(req.query.top_filas) || 30, 100);
    const params = [];
    const filtros = filtrosDesglose(req, params);
    const where = [`f.tipo_doc = 'FACT'`, `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`, ...filtros].join(' AND ');
    const nom = (d) => (d.label ? d.label.replace(/^MAX\((.*)\)$/, '$1') : d.expr);

    const rows = await db.allAsync(`
      WITH base AS (
        SELECT ${F.expr} AS fk, ${nom(F)} AS fn, ${C.expr} AS ck, ${nom(C)} AS cn,
               f.total_sin_iva, f.margen_bruto, f.costo_total_facturado
        ${JOINS}
        WHERE ${where}
      ),
      rc AS (SELECT ck, MAX(cn) AS cn, ROW_NUMBER() OVER (ORDER BY SUM(total_sin_iva) DESC) AS rk FROM base GROUP BY ck),
      rf AS (SELECT fk, MAX(fn) AS fn, ROW_NUMBER() OVER (ORDER BY SUM(total_sin_iva) DESC) AS rk FROM base GROUP BY fk)
      SELECT CASE WHEN rf.rk <= ${topF} THEN rf.fn ELSE 'Otros' END AS fila,
             CASE WHEN rc.rk <= ${topC} THEN rc.cn ELSE 'Otros' END AS columna,
             MIN(rf.rk) AS frk, MIN(rc.rk) AS crk,
             SUM(b.total_sin_iva) AS ventas,
             SUM(b.margen_bruto) FILTER (WHERE b.costo_total_facturado > 0)
               / NULLIF(SUM(b.total_sin_iva) FILTER (WHERE b.costo_total_facturado > 0), 0) * 100 AS margen_pct
      FROM base b JOIN rc USING (ck) JOIN rf USING (fk)
      GROUP BY 1, 2
    `, params);

    const orden = (key, rk) => {
      const m = new Map();
      for (const r of rows) m.set(r[key], Math.min(m.get(r[key]) ?? Infinity, r[key === 'fila' ? 'frk' : 'crk'] * (r[key] === 'Otros' ? 1e9 : 1)));
      return [...m.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
    };
    const columnas = orden('columna');
    const filasN = orden('fila');
    const filas = filasN.map(fn => {
      const celdas = {};
      let total = 0;
      for (const r of rows.filter(x => x.fila === fn)) {
        celdas[r.columna] = { ventas: n(r.ventas), margen_pct: r1(r.margen_pct) };
        total += n(r.ventas);
      }
      return { nombre: fn, total, celdas };
    });
    const totalesCol = Object.fromEntries(columnas.map(c => [c, filas.reduce((s, f) => s + (f.celdas[c]?.ventas || 0), 0)]));
    res.json({
      status: 'success',
      data: { ventana: P.ventana(), filas_dim: fd, columnas_dim: cd, columnas, filas, totales_columna: totalesCol, total: filas.reduce((s, f) => s + f.total, 0) },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
