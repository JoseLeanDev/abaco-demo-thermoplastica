const express = require('express');
const router = express.Router();
const db = require('../../database/connection');
const proyecciones = require('../services/proyecciones');
const { parsePeriodo } = require('../services/periodo');
const M = require('../services/margen');
const { TIPO_EXPR, TIPOS } = require('../services/tipoCompra');

const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');

// GET /api/tesoreria/posicion
// Vista de working capital / posición neta.
// Bancos no están disponibles en el ERP TP_A actual — se reportan como N/D.
router.get('/posicion', async (req, res) => {
  try {
    // Saldos pendientes de documentos EMITIDOS dentro del período del filtro global.
    const P = parsePeriodo(req);
    // 1. Cuentas por cobrar (snapshot vivo)
    const cxc = await db.getAsync(`
      SELECT
        COALESCE(SUM(saldo_total), 0) AS total,
        COALESCE(SUM(porvencer), 0)   AS por_vencer,
        COALESCE(SUM(vencido), 0)     AS vencido,
        COUNT(*)                      AS documentos,
        AVG(GREATEST((CURRENT_DATE - fecha_vencimiento)::int, 0)) AS dias_promedio_vencido
      FROM thermoplastica.fact_cxc_snapshot_diario
      WHERE fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario)
        AND fecha_emision BETWEEN ${P.D} AND ${P.H}
    `);

    // 2. Cuentas por pagar (fuente real: thermoplastica.fact_cxp_factura,
    //    con fecha_vencimiento real del ERP y dias_credito_ficha por proveedor)
    const cxp = await db.getAsync(`
      SELECT
        COALESCE(SUM(saldo), 0)                                                   AS total,
        COUNT(*)                                                                  AS facturas,
        COUNT(DISTINCT proveedor_id)                                              AS proveedores,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento >= CURRENT_DATE), 0)  AS por_vencer,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento <  CURRENT_DATE), 0)  AS vencido,
        AVG(GREATEST((CURRENT_DATE - fecha_vencimiento)::int, 0))                 AS dias_promedio_vencido,
        AVG(dias_credito_ficha) FILTER (WHERE dias_credito_ficha > 0)             AS dias_credito_promedio
      FROM thermoplastica.fact_cxp_factura
      WHERE saldo > 0
        AND fecha_emision BETWEEN ${P.D} AND ${P.H}
    `);

    const cxcTotal = parseFloat(cxc.total) || 0;
    const cxpTotal = parseFloat(cxp.total) || 0;
    const posicionNeta = cxcTotal - cxpTotal;
    const cobertura = cxpTotal > 0 ? cxcTotal / cxpTotal : null;

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        fecha_corte: new Date().toISOString().split('T')[0],
        bancos: {
          disponible: false,
          nota: 'El ERP TP_A no expone saldos bancarios. Solicitar vista de cuentas bancarias al cliente para completar la posición.',
        },
        cxc: {
          total: cxcTotal,
          por_vencer: parseFloat(cxc.por_vencer) || 0,
          vencido: parseFloat(cxc.vencido) || 0,
          documentos: parseInt(cxc.documentos) || 0,
          dias_promedio_vencido: Math.round(parseFloat(cxc.dias_promedio_vencido) || 0),
        },
        cxp: {
          total: cxpTotal,
          por_vencer: parseFloat(cxp.por_vencer) || 0,
          vencido: parseFloat(cxp.vencido) || 0,
          facturas: parseInt(cxp.facturas) || 0,
          proveedores: parseInt(cxp.proveedores) || 0,
          dias_promedio_vencido: Math.round(parseFloat(cxp.dias_promedio_vencido) || 0),
          dias_credito_promedio: Math.round(parseFloat(cxp.dias_credito_promedio) || 0),
        },
        posicion_neta_working_capital: posicionNeta,
        ratio_cobertura_cxc_cxp: cobertura,
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/cxc
// Resumen de cartera vigente + aging + top 5 deudores.
// Fuente: thermoplastica.fact_cxc_snapshot_diario (snapshot del día más reciente).
router.get('/cxc', async (req, res) => {
  try {
    // Saldos pendientes de documentos EMITIDOS dentro del período del filtro global.
    const P = parsePeriodo(req);
    const distribucion = await db.getAsync(`
      SELECT
        COALESCE(SUM(porvencer), 0)                                       AS al_corriente,
        COALESCE(SUM(v30), 0)                                             AS _30_dias,
        COALESCE(SUM(v31a60), 0)                                          AS _60_dias,
        COALESCE(SUM(v61a90) + SUM(v91a120) + SUM(v120), 0)               AS _90_dias,
        COALESCE(SUM(saldo_total), 0)                                     AS total,
        COUNT(*)                                                          AS facturas
      FROM thermoplastica.fact_cxc_snapshot_diario
      WHERE fecha_snapshot = (
        SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario
      )
        AND fecha_emision BETWEEN ${P.D} AND ${P.H}
    `);

    const topDeudores = await db.allAsync(`
      SELECT
        c.codigo_cliente                                                  AS codigo,
        c.nombre                                                          AS cliente,
        SUM(f.saldo_total)                                                AS monto,
        SUM(f.vencido)                                                    AS vencido,
        MAX(GREATEST((CURRENT_DATE - f.fecha_vencimiento)::int, 0))       AS dias
      FROM thermoplastica.fact_cxc_snapshot_diario f
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id
      WHERE f.fecha_snapshot = (
        SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario
      )
        AND f.fecha_emision BETWEEN ${P.D} AND ${P.H}
      GROUP BY c.codigo_cliente, c.nombre
      ORDER BY monto DESC
      LIMIT 5
    `);

    const promedio = await db.getAsync(`
      SELECT AVG(GREATEST((CURRENT_DATE - fecha_vencimiento)::int, 0))    AS promedio
      FROM thermoplastica.fact_cxc_snapshot_diario
      WHERE fecha_snapshot = (
        SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario
      )
        AND fecha_emision BETWEEN ${P.D} AND ${P.H}
    `);

    const total = parseFloat(distribucion.total) || 1;
    const pct = (v) => parseFloat(((parseFloat(v) || 0) / total * 100).toFixed(1));

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        total_cxc: parseFloat(distribucion.total) || 0,
        facturas: parseInt(distribucion.facturas) || 0,
        promedio_dias_cobro: Math.round(parseFloat(promedio.promedio) || 0),
        distribucion_aging: {
          al_corriente: { monto: parseFloat(distribucion.al_corriente) || 0, porcentaje: pct(distribucion.al_corriente) },
          _30_dias:     { monto: parseFloat(distribucion._30_dias)     || 0, porcentaje: pct(distribucion._30_dias) },
          _60_dias:     { monto: parseFloat(distribucion._60_dias)     || 0, porcentaje: pct(distribucion._60_dias) },
          _90_dias:     { monto: parseFloat(distribucion._90_dias)     || 0, porcentaje: pct(distribucion._90_dias) }
        },
        top_deudores: topDeudores.map(d => ({
          codigo: d.codigo,
          cliente: d.cliente,
          monto: parseFloat(d.monto) || 0,
          vencido: parseFloat(d.vencido) || 0,
          dias: parseInt(d.dias) || 0
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/cxc/detalle
// Listado paginado de facturas de la cartera vigente.
// Query params: ?limit=200&offset=0&busqueda=&bucket=
//   bucket ∈ 'al_corriente' | '_30_dias' | '_60_dias' | '_90_dias' | 'todos'
router.get('/cxc/detalle', async (req, res) => {
  try {
    // Saldos pendientes de documentos EMITIDOS dentro del período del filtro global.
    const P = parsePeriodo(req);
    const limit = Math.min(parseInt(req.query.limit)  || 200, 1000);
    const offset = parseInt(req.query.offset)         || 0;
    const busqueda = (req.query.busqueda || '').trim();
    const bucket = req.query.bucket || 'todos';

    const where = [
      `f.fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario)`,
      `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`,
    ];
    const params = [];

    if (busqueda) {
      params.push(`%${busqueda}%`);
      const p = `$${params.length}`;
      where.push(`(c.nombre ILIKE ${p} OR c.codigo_cliente ILIKE ${p} OR f.documento::text ILIKE ${p})`);
    }
    if (bucket === 'al_corriente') where.push(`f.porvencer > 0 AND COALESCE(f.vencido, 0) = 0`);
    else if (bucket === '_30_dias') where.push(`f.v30 > 0`);
    else if (bucket === '_60_dias') where.push(`f.v31a60 > 0`);
    else if (bucket === '_90_dias') where.push(`(f.v61a90 > 0 OR f.v91a120 > 0 OR f.v120 > 0)`);

    const whereSql = where.join(' AND ');

    const rows = await db.allAsync(`
      SELECT
        f.snapshot_id                                                     AS id,
        c.cliente_id                                                      AS cliente_id,
        c.codigo_cliente                                                  AS codigo_cliente,
        c.nombre                                                          AS cliente,
        c.forma_pago                                                      AS forma_pago,
        s.codigo_sucursal                                                 AS codigo_sucursal,
        s.nombre                                                          AS sucursal,
        v.nombre                                                          AS vendedor,
        f.tipo_documento                                                  AS tipo_documento,
        f.documento                                                       AS documento,
        f.fecha_emision                                                   AS fecha_emision,
        f.fecha_vencimiento                                               AS fecha_vencimiento,
        GREATEST((CURRENT_DATE - f.fecha_vencimiento)::int, 0)            AS dias_atraso,
        f.saldo_total                                                     AS saldo_total,
        f.porvencer                                                       AS porvencer,
        f.vencido                                                         AS vencido,
        f.v30, f.v31a60, f.v61a90, f.v91a120, f.v120,
        f.estado_cxc                                                      AS estado_cxc,
        fac.dias_credito_ficha                                            AS dias_credito_ficha,
        fac.dias_segun_facturas                                           AS dias_segun_facturas
      FROM thermoplastica.fact_cxc_snapshot_diario f
      JOIN thermoplastica.dim_cliente   c ON c.cliente_id  = f.cliente_id
      JOIN thermoplastica.dim_sucursal  s ON s.sucursal_id = f.sucursal_id
      LEFT JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
      LEFT JOIN thermoplastica.fact_cxc_factura fac
             ON fac.cliente_id = f.cliente_id AND fac.factura_num = f.documento
      WHERE ${whereSql}
      ORDER BY f.saldo_total DESC, f.fecha_vencimiento ASC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    const totalRow = await db.getAsync(`
      SELECT COUNT(*) AS total, COALESCE(SUM(f.saldo_total), 0) AS suma_saldo
      FROM thermoplastica.fact_cxc_snapshot_diario f
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id
      WHERE ${whereSql}
    `, params);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        total_filas: parseInt(totalRow.total) || 0,
        suma_saldo: parseFloat(totalRow.suma_saldo) || 0,
        filas: rows.map(r => ({
          id: parseInt(r.id),
          cliente_id: parseInt(r.cliente_id),
          codigo_cliente: r.codigo_cliente,
          cliente: r.cliente,
          forma_pago: r.forma_pago,
          codigo_sucursal: r.codigo_sucursal,
          sucursal: r.sucursal,
          vendedor: r.vendedor,
          tipo_documento: r.tipo_documento,
          documento: r.documento?.toString(),
          fecha_emision: r.fecha_emision,
          fecha_vencimiento: r.fecha_vencimiento,
          dias_atraso: parseInt(r.dias_atraso) || 0,
          saldo_total: parseFloat(r.saldo_total) || 0,
          porvencer: parseFloat(r.porvencer) || 0,
          vencido: parseFloat(r.vencido) || 0,
          v30: parseFloat(r.v30) || 0,
          v31a60: parseFloat(r.v31a60) || 0,
          v61a90: parseFloat(r.v61a90) || 0,
          v91a120: parseFloat(r.v91a120) || 0,
          v120: parseFloat(r.v120) || 0,
          estado_cxc: r.estado_cxc,
          dias_credito_ficha:  r.dias_credito_ficha  !== null ? parseInt(r.dias_credito_ficha)  : null,
          dias_segun_facturas: r.dias_segun_facturas !== null ? parseInt(r.dias_segun_facturas) : null,
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/cxc/cliente/:id
// Ficha de un cliente: estado de cuenta, comportamiento de pago, compras.
//
// Fuentes:
// - Saldo y antigüedad: último corte de fact_cxc_snapshot_diario (reporte de
//   cartera del ERP), TODOS los documentos abiertos, sin importar el período.
// - Comportamiento de pago: fact_cxc_factura, que conserva las facturas ya
//   pagadas con su fecha de último cobro (historia desde sep-2024). Días de pago
//   = último cobro − emisión; atraso = último cobro − vencimiento. Se ponderan
//   por el valor de la factura. Se miden las facturas que TERMINARON de pagarse
//   dentro del período (y el mismo rango del año anterior para comparar).
// - Compras: fact_ventas_linea (sin IVA, mismo criterio que Ventas).
const SNAP_MAX = `(SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario)`;
const NOMBRE_LIMPIO = (col) => `REGEXP_REPLACE(${col}, '^[A-Za-z]*[0-9][0-9A-Za-z]*-', '')`;
const fecha = (col) => `to_char(${col}, 'YYYY-MM-DD')`;
const num = (v) => (v === null || v === undefined ? null : Number(v));
const redondo = (v, d = 1) => (v === null || v === undefined ? null : Number(Number(v).toFixed(d)));

// Comportamiento de pago de las facturas cuyo último cobro cae en [desde, hasta]
const SQL_COMPORTAMIENTO = (desde, hasta) => `
  SELECT
    COUNT(*)                                                                 AS facturas,
    COALESCE(SUM(valor), 0)                                                  AS monto,
    SUM(valor * GREATEST(fecha_ultimo_cobro - fecha_emision, 0)) / NULLIF(SUM(valor), 0) AS dias_pago,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY GREATEST(fecha_ultimo_cobro - fecha_emision, 0)) AS dias_pago_mediana,
    SUM(valor * (fecha_ultimo_cobro - fecha_vencimiento)) / NULLIF(SUM(valor), 0) AS atraso,
    COALESCE(SUM(valor) FILTER (WHERE fecha_ultimo_cobro <= fecha_vencimiento), 0) / NULLIF(SUM(valor), 0) * 100 AS pct_a_tiempo,
    SUM(valor * (fecha_vencimiento - fecha_emision)) / NULLIF(SUM(valor), 0) AS plazo,
    MAX(fecha_ultimo_cobro - fecha_vencimiento)                              AS peor_atraso
  FROM thermoplastica.fact_cxc_factura
  WHERE cliente_id = $1 AND saldo = 0 AND fecha_ultimo_cobro IS NOT NULL
    AND fecha_ultimo_cobro BETWEEN ${desde} AND ${hasta}`;

const SQL_COMPRAS = (desde, hasta) => `
  SELECT
    COALESCE(SUM(total_sin_iva), 0)   AS ventas,
    ${M.pct('')}                      AS margen_pct,
    COUNT(DISTINCT fact_num)          AS facturas,
    COALESCE(SUM(unidades), 0)        AS unidades
  FROM thermoplastica.v_ventas_costeadas
  WHERE cliente_id = $1 AND fecha_emision BETWEEN ${desde} AND ${hasta}`;

const comportamiento = (r) => ({
  facturas: parseInt(r.facturas) || 0,
  monto: num(r.monto) || 0,
  dias_pago: redondo(r.dias_pago),
  dias_pago_mediana: redondo(r.dias_pago_mediana, 0),
  atraso: redondo(r.atraso),
  pct_a_tiempo: redondo(r.pct_a_tiempo),
  plazo: redondo(r.plazo),
  peor_atraso: r.peor_atraso === null ? null : parseInt(r.peor_atraso),
});
const compras = (r) => ({
  ventas: num(r.ventas) || 0,
  margen_pct: redondo(r.margen_pct),
  facturas: parseInt(r.facturas) || 0,
  unidades: num(r.unidades) || 0,
  ticket: parseInt(r.facturas) ? (num(r.ventas) || 0) / parseInt(r.facturas) : 0,
});

// GET /api/tesoreria/cxc/clientes?busqueda=
// Cartera agrupada por cliente (documentos emitidos en el período, último corte),
// con el comportamiento de pago de las facturas que terminó de pagar en el período.
router.get('/cxc/clientes', async (req, res) => {
  try {
    const P = parsePeriodo(req);
    const busqueda = (req.query.busqueda || '').trim();
    const params = [];
    let filtroBusqueda = '';
    if (busqueda) {
      params.push(`%${busqueda}%`);
      filtroBusqueda = `AND (c.nombre ILIKE $1 OR c.codigo_cliente ILIKE $1 OR EXISTS (
        SELECT 1 FROM thermoplastica.fact_cxc_snapshot_diario d
        WHERE d.cliente_id = c.cliente_id AND d.fecha_snapshot = ${SNAP_MAX} AND d.documento::text ILIKE $1))`;
    }

    const rows = await db.allAsync(`
      WITH s AS (
        SELECT cliente_id,
          SUM(saldo_total) AS saldo, SUM(porvencer) AS por_vencer, SUM(vencido) AS vencido,
          SUM(v61a90 + v91a120 + v120) AS mas_60,
          COUNT(*) AS documentos, COUNT(*) FILTER (WHERE vencido > 0) AS documentos_vencidos,
          MAX(CASE WHEN vencido > 0 THEN (CURRENT_DATE - fecha_vencimiento)::int END) AS atraso_max
        FROM thermoplastica.fact_cxc_snapshot_diario
        WHERE fecha_snapshot = ${SNAP_MAX} AND fecha_emision BETWEEN ${P.D} AND ${P.H}
        GROUP BY cliente_id
      ), pago AS (
        SELECT cliente_id, COUNT(*) AS pagadas,
          SUM(valor * GREATEST(fecha_ultimo_cobro - fecha_emision, 0)) / NULLIF(SUM(valor), 0) AS dias_pago,
          SUM(valor * (fecha_ultimo_cobro - fecha_vencimiento)) / NULLIF(SUM(valor), 0) AS atraso_pago,
          COALESCE(SUM(valor) FILTER (WHERE fecha_ultimo_cobro <= fecha_vencimiento), 0) / NULLIF(SUM(valor), 0) * 100 AS pct_a_tiempo
        FROM thermoplastica.fact_cxc_factura
        WHERE saldo = 0 AND fecha_ultimo_cobro BETWEEN ${P.D} AND ${P.H}
          AND cliente_id IN (SELECT cliente_id FROM s)
        GROUP BY cliente_id
      ), ficha AS (
        SELECT DISTINCT ON (cliente_id) cliente_id, dias_credito_ficha
        FROM thermoplastica.fact_cxc_factura
        WHERE dias_credito_ficha IS NOT NULL AND cliente_id IN (SELECT cliente_id FROM s)
        ORDER BY cliente_id, fecha_emision DESC
      )
      SELECT c.cliente_id, c.codigo_cliente, ${NOMBRE_LIMPIO('c.nombre')} AS cliente, c.forma_pago AS sector,
        s.*, pago.pagadas, pago.dias_pago, pago.atraso_pago, pago.pct_a_tiempo, ficha.dias_credito_ficha
      FROM s
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = s.cliente_id
      LEFT JOIN pago  ON pago.cliente_id  = s.cliente_id
      LEFT JOIN ficha ON ficha.cliente_id = s.cliente_id
      WHERE TRUE ${filtroBusqueda}
      ORDER BY s.saldo DESC`, params);

    const total = rows.reduce((t, r) => t + (Number(r.saldo) || 0), 0);
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        total_clientes: rows.length,
        suma_saldo: total,
        filas: rows.map(r => ({
          cliente_id: parseInt(r.cliente_id),
          codigo_cliente: r.codigo_cliente,
          cliente: r.cliente,
          sector: r.sector,
          saldo: num(r.saldo) || 0,
          pct_saldo: total > 0 ? redondo((Number(r.saldo) || 0) / total * 100) : 0,
          por_vencer: num(r.por_vencer) || 0,
          vencido: num(r.vencido) || 0,
          mas_60: num(r.mas_60) || 0,
          documentos: parseInt(r.documentos) || 0,
          documentos_vencidos: parseInt(r.documentos_vencidos) || 0,
          atraso_max: r.atraso_max === null ? 0 : parseInt(r.atraso_max),
          pagadas: parseInt(r.pagadas) || 0,
          dias_pago: redondo(r.dias_pago, 0),
          atraso_pago: redondo(r.atraso_pago, 0),
          pct_a_tiempo: redondo(r.pct_a_tiempo, 0),
          dias_credito: r.dias_credito_ficha === null ? null : parseInt(r.dias_credito_ficha),
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/cxc/cliente/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ status: 'error', message: 'Cliente inválido' });
    const P = parsePeriodo(req);
    const p = [id];

    const info = await db.getAsync(`
      SELECT c.cliente_id, c.codigo_cliente, ${NOMBRE_LIMPIO('c.nombre')} AS nombre, c.forma_pago AS sector
      FROM thermoplastica.dim_cliente c WHERE c.cliente_id = $1`, p);
    if (!info) return res.status(404).json({ status: 'error', message: 'Cliente no encontrado' });

    const [
      relacion, plazoFicha, docs, compAct, compPrev, histPagadas,
      serie, comprasAct, comprasPrev, frecuencia, ultimas, productos, categorias,
    ] = await Promise.all([
      // Primera / última compra y vendedor y sucursal principales (últimos 12 meses)
      db.getAsync(`
        WITH u AS (
          SELECT f.*, v.nombre AS vendedor, s.nombre AS sucursal
          FROM thermoplastica.v_ventas_costeadas f
          LEFT JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
          LEFT JOIN thermoplastica.dim_sucursal s ON s.sucursal_id = f.sucursal_id
          WHERE f.cliente_id = $1
        )
        SELECT
          ${fecha('MIN(fecha_emision)')} AS primera_compra,
          ${fecha('MAX(fecha_emision)')} AS ultima_compra,
          (SELECT vendedor FROM u WHERE fecha_emision > CURRENT_DATE - 365 GROUP BY vendedor ORDER BY SUM(total_sin_iva) DESC NULLS LAST LIMIT 1) AS vendedor,
          (SELECT sucursal FROM u WHERE fecha_emision > CURRENT_DATE - 365 GROUP BY sucursal ORDER BY SUM(total_sin_iva) DESC NULLS LAST LIMIT 1) AS sucursal,
          (SELECT REGEXP_REPLACE(tipo_cliente, '^\\s*\\d+\\s*-\\s*', '') FROM u WHERE tipo_cliente IS NOT NULL ORDER BY fecha_emision DESC LIMIT 1) AS tipo_cliente
        FROM u`, p),

      // Días de crédito pactados en la ficha (de la factura más reciente)
      db.getAsync(`
        SELECT dias_credito_ficha FROM thermoplastica.fact_cxc_factura
        WHERE cliente_id = $1 AND dias_credito_ficha IS NOT NULL
        ORDER BY fecha_emision DESC LIMIT 1`, p),

      // Estado de cuenta: documentos abiertos al último corte
      db.allAsync(`
        SELECT
          s.documento::text AS documento, s.tipo_documento,
          ${fecha('s.fecha_emision')} AS fecha_emision, ${fecha('s.fecha_vencimiento')} AS fecha_vencimiento,
          (CURRENT_DATE - s.fecha_vencimiento)::int AS dias_vencido,
          s.saldo_total, s.porvencer, s.vencido, s.v30, s.v31a60, s.v61a90, s.v91a120, s.v120,
          fac.valor, ${fecha('fac.fecha_ultimo_cobro')} AS ultimo_abono,
          suc.nombre AS sucursal, ven.nombre AS vendedor, ${fecha('s.fecha_snapshot')} AS corte, fel.fel
        FROM thermoplastica.fact_cxc_snapshot_diario s
        LEFT JOIN thermoplastica.fact_cxc_factura fac ON fac.cliente_id = s.cliente_id AND fac.factura_num = s.documento
        -- Número FEL (serie-número del DTE) desde las líneas de venta
        LEFT JOIN LATERAL (
          SELECT v.fel FROM thermoplastica.fact_ventas_linea v
          WHERE v.cliente_id = s.cliente_id AND v.fact_num = s.documento AND v.fel IS NOT NULL LIMIT 1
        ) fel ON true
        LEFT JOIN thermoplastica.dim_sucursal suc ON suc.sucursal_id = s.sucursal_id
        LEFT JOIN thermoplastica.dim_vendedor ven ON ven.vendedor_id = s.vendedor_id
        WHERE s.cliente_id = $1 AND s.fecha_snapshot = ${SNAP_MAX}
        ORDER BY s.fecha_vencimiento ASC, s.documento`, p),

      db.getAsync(SQL_COMPORTAMIENTO(P.D, P.H), p),
      db.getAsync(SQL_COMPORTAMIENTO(P.prevD, P.prevH), p),

      // Facturas ya pagadas, más recientes primero
      db.allAsync(`
        SELECT factura_num::text AS documento, ${fecha('fecha_emision')} AS fecha_emision,
               ${fecha('fecha_vencimiento')} AS fecha_vencimiento, ${fecha('fecha_ultimo_cobro')} AS fecha_cobro,
               valor, GREATEST(fecha_ultimo_cobro - fecha_emision, 0) AS dias_pago,
               (fecha_ultimo_cobro - fecha_vencimiento) AS atraso
        FROM thermoplastica.fact_cxc_factura
        WHERE cliente_id = $1 AND saldo = 0 AND fecha_ultimo_cobro IS NOT NULL
        ORDER BY fecha_ultimo_cobro DESC, factura_num DESC
        LIMIT 200`, p),

      // 24 meses hasta el fin del período: facturado y cobrado (con IVA) y días de pago
      db.allAsync(`
        WITH m AS (
          SELECT generate_series(date_trunc('month', ${P.H}) - interval '23 months', date_trunc('month', ${P.H}), interval '1 month')::date AS mes
        ), fac AS (
          SELECT * FROM thermoplastica.fact_cxc_factura WHERE cliente_id = $1
        )
        SELECT to_char(m.mes, 'YYYY-MM') AS mes,
          (SELECT COALESCE(SUM(valor), 0) FROM fac WHERE date_trunc('month', fecha_emision) = m.mes) AS facturado,
          (SELECT COALESCE(SUM(valor), 0) FROM fac WHERE saldo = 0 AND date_trunc('month', fecha_ultimo_cobro) = m.mes) AS cobrado,
          (SELECT SUM(valor * GREATEST(fecha_ultimo_cobro - fecha_emision, 0)) / NULLIF(SUM(valor), 0)
             FROM fac WHERE saldo = 0 AND date_trunc('month', fecha_ultimo_cobro) = m.mes) AS dias_pago,
          (SELECT COALESCE(SUM(total_sin_iva), 0) FROM thermoplastica.v_ventas_costeadas v
             WHERE v.cliente_id = $1 AND date_trunc('month', v.fecha_emision) = m.mes) AS compras
        FROM m ORDER BY m.mes`, p),

      db.getAsync(SQL_COMPRAS(P.D, P.H), p),
      db.getAsync(SQL_COMPRAS(P.prevD, P.prevH), p),

      // Frecuencia de compra: días promedio entre fechas de compra (últimos 12 meses)
      db.getAsync(`
        SELECT COUNT(DISTINCT fecha_emision) AS dias_con_compra,
               (MAX(fecha_emision) - MIN(fecha_emision))::numeric / NULLIF(COUNT(DISTINCT fecha_emision) - 1, 0) AS cada_dias
        FROM thermoplastica.v_ventas_costeadas
        WHERE cliente_id = $1 AND fecha_emision > CURRENT_DATE - 365`, p),

      // Últimas facturas de venta con su detalle y estado de pago
      db.allAsync(`
        WITH ult AS (
          SELECT fact_num, MIN(fecha_emision) AS fecha
          FROM thermoplastica.v_ventas_costeadas WHERE cliente_id = $1
          GROUP BY fact_num ORDER BY MIN(fecha_emision) DESC, fact_num DESC LIMIT 25
        )
        SELECT u.fact_num::text AS documento, ${fecha('u.fecha')} AS fecha,
          SUM(f.total_sin_iva) AS total_sin_iva, SUM(f.total_con_iva) AS total_con_iva,
          ${M.pct('f')} AS margen_pct,
          MAX(v.nombre) AS vendedor,
          json_agg(json_build_object(
            'codigo', a.codigo_articulo, 'articulo', a.descripcion, 'categoria', a.marca,
            'unidades', f.unidades, 'total', f.total_sin_iva,
            'precio', f.total_sin_iva / NULLIF(f.unidades, 0)
          ) ORDER BY f.total_sin_iva DESC) AS lineas,
          MAX(fac.saldo) AS saldo, MAX(fac.estado) AS estado_pago,
          ${fecha('MAX(fac.fecha_vencimiento)')} AS fecha_vencimiento,
          ${fecha('MAX(fac.fecha_ultimo_cobro)')} AS fecha_cobro
        FROM ult u
        JOIN thermoplastica.v_ventas_costeadas f ON f.fact_num = u.fact_num AND f.cliente_id = $1
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        LEFT JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
        LEFT JOIN thermoplastica.fact_cxc_factura fac ON fac.cliente_id = $1 AND fac.factura_num = u.fact_num
        GROUP BY u.fact_num, u.fecha
        ORDER BY u.fecha DESC, u.fact_num DESC`, p),

      // Productos del período (con el mismo rango del año anterior)
      db.allAsync(`
        SELECT a.codigo_articulo AS codigo, MAX(a.descripcion) AS articulo, MAX(a.marca) AS categoria,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision BETWEEN ${P.D} AND ${P.H}), 0) AS ventas,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}), 0) AS ventas_prev,
          COALESCE(SUM(f.unidades) FILTER (WHERE f.fecha_emision BETWEEN ${P.D} AND ${P.H}), 0) AS unidades,
          ${M.pct('f', `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`)} AS margen_pct,
          ${fecha('MAX(f.fecha_emision)')} AS ultima_compra
        FROM thermoplastica.v_ventas_costeadas f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.cliente_id = $1 AND (f.fecha_emision BETWEEN ${P.D} AND ${P.H} OR f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH})
        GROUP BY a.codigo_articulo
        ORDER BY 4 DESC, 5 DESC
        LIMIT 30`, p),

      // Categorías del período vs año anterior
      db.allAsync(`
        SELECT COALESCE(NULLIF(TRIM(a.marca), ''), 'Sin categoría') AS categoria,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision BETWEEN ${P.D} AND ${P.H}), 0) AS ventas,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}), 0) AS ventas_prev,
          ${M.pct('f', `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`)} AS margen_pct
        FROM thermoplastica.v_ventas_costeadas f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.cliente_id = $1 AND (f.fecha_emision BETWEEN ${P.D} AND ${P.H} OR f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH})
        GROUP BY 1
        ORDER BY 2 DESC, 3 DESC`, p),
    ]);

    // ---- Saldo y antigüedad ----
    const suma = (k) => docs.reduce((t, d) => t + (Number(d[k]) || 0), 0);
    const saldo = {
      corte: docs[0]?.corte || null,
      total: suma('saldo_total'),
      por_vencer: suma('porvencer'),
      vencido: suma('vencido'),
      documentos: docs.length,
      vencidos: docs.filter(d => Number(d.vencido) > 0).length,
      aging: {
        por_vencer: suma('porvencer'),
        d1_30: suma('v30'),
        d31_60: suma('v31a60'),
        d61_90: suma('v61a90'),
        d90_mas: suma('v91a120') + suma('v120'),
      },
      mas_antiguo_dias: docs.reduce((m, d) => Math.max(m, Number(d.vencido) > 0 ? d.dias_vencido : 0), 0),
      proximo_vencimiento: docs.find(d => d.dias_vencido <= 0)?.fecha_vencimiento || null,
    };

    const cAct = comportamiento(compAct);
    const cPrev = comportamiento(compPrev);
    const kAct = compras(comprasAct);
    const kPrev = compras(comprasPrev);
    const cadaDias = redondo(frecuencia?.cada_dias, 0);
    const diasSinComprar = relacion?.ultima_compra
      ? Math.round((Date.now() - new Date(`${relacion.ultima_compra}T00:00:00`)) / 86400000)
      : null;
    const plazoPactado = plazoFicha ? parseInt(plazoFicha.dias_credito_ficha) : null;

    // ---- Señales en lenguaje simple (reglas, no IA) ----
    const senales = [];
    const fmtQ = (v) => `Q${Math.round(v).toLocaleString('es-GT')}`;
    if (cAct.facturas >= 3 && cAct.atraso !== null) {
      if (cAct.atraso > 5) senales.push({ tipo: 'alerta', texto: `Paga en promedio ${Math.round(cAct.atraso)} días después del vencimiento (ponderado por monto).` });
      else if (cAct.atraso < -2) senales.push({ tipo: 'bien', texto: `Paga en promedio ${Math.round(-cAct.atraso)} días antes del vencimiento.` });
      else senales.push({ tipo: 'bien', texto: 'Paga en su fecha de vencimiento o muy cerca de ella.' });
    }
    if (cAct.facturas >= 3 && cPrev.facturas >= 3 && cAct.dias_pago !== null && cPrev.dias_pago !== null) {
      const d = cAct.dias_pago - cPrev.dias_pago;
      if (d >= 7) senales.push({ tipo: 'alerta', texto: `Tarda ${Math.round(d)} días más en pagar que en el mismo período del año anterior (${Math.round(cPrev.dias_pago)} → ${Math.round(cAct.dias_pago)} días).` });
      else if (d <= -7) senales.push({ tipo: 'bien', texto: `Paga ${Math.round(-d)} días más rápido que en el mismo período del año anterior (${Math.round(cPrev.dias_pago)} → ${Math.round(cAct.dias_pago)} días).` });
    }
    if (saldo.vencido > 0) {
      senales.push({
        tipo: saldo.mas_antiguo_dias > 60 ? 'alerta' : 'aviso',
        texto: `${fmtQ(saldo.vencido)} vencidos en ${saldo.vencidos} documento${saldo.vencidos === 1 ? '' : 's'}; el más antiguo tiene ${saldo.mas_antiguo_dias} días de atraso.`,
      });
    }
    if (kPrev.ventas > 0) {
      const v = (kAct.ventas / kPrev.ventas - 1) * 100;
      if (Math.abs(v) >= 15) senales.push({ tipo: v > 0 ? 'bien' : 'aviso', texto: `Compras ${v > 0 ? 'suben' : 'caen'} ${Math.abs(v).toFixed(0)}% vs el mismo período del año anterior.` });
    } else if (kAct.ventas > 0) {
      senales.push({ tipo: 'bien', texto: 'Cliente sin compras en el mismo período del año anterior: es nuevo o se reactivó.' });
    }
    if (cadaDias && diasSinComprar !== null && diasSinComprar > Math.max(30, cadaDias * 2.5)) {
      senales.push({ tipo: 'aviso', texto: `Lleva ${diasSinComprar} días sin comprar; normalmente compra cada ${cadaDias} días.` });
    }
    if (plazoPactado !== null && cAct.plazo !== null && cAct.plazo - plazoPactado > 5) {
      senales.push({ tipo: 'aviso', texto: `Sus facturas se emiten con ${Math.round(cAct.plazo)} días de plazo en promedio, más que los ${plazoPactado} de su ficha.` });
    } else if (plazoPactado !== null && cAct.plazo !== null && plazoPactado - cAct.plazo > 5 && cAct.atraso > 5 && cAct.dias_pago <= plazoPactado + 5) {
      // Paga "tarde" contra la factura pero dentro de lo pactado en la ficha
      senales.push({ tipo: 'aviso', texto: `Sus facturas vencen a ${Math.round(cAct.plazo)} días pero su ficha dice ${plazoPactado}: paga en ${Math.round(cAct.dias_pago)} días, dentro de la ficha. Conviene alinear el plazo de facturación.` });
      // El "atraso" se explica por la diferencia de plazos: no es una alerta roja
      const atraso = senales.find(s => s.texto.startsWith('Paga en promedio'));
      if (atraso) atraso.tipo = 'aviso';
    }

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        cliente: {
          id: info.cliente_id,
          codigo: info.codigo_cliente,
          nombre: info.nombre,
          sector: info.sector,
          tipo_cliente: relacion?.tipo_cliente || null,
          vendedor: relacion?.vendedor || null,
          sucursal: relacion?.sucursal || null,
          primera_compra: relacion?.primera_compra || null,
          ultima_compra: relacion?.ultima_compra || null,
          dias_sin_comprar: diasSinComprar,
          dias_credito: plazoPactado,
          historia_desde: '2024-09-18',
        },
        saldo,
        estado_cuenta: docs.map(d => ({
          documento: d.documento,
          tipo_documento: d.tipo_documento,
          fel: d.fel || null,
          fecha_emision: d.fecha_emision,
          fecha_vencimiento: d.fecha_vencimiento,
          dias_vencido: d.dias_vencido,
          valor: num(d.valor),
          abonado: d.valor !== null ? Math.max(0, Number(d.valor) - Number(d.saldo_total)) : null,
          saldo: num(d.saldo_total) || 0,
          vencido: num(d.vencido) || 0,
          ultimo_abono: d.ultimo_abono,
          sucursal: d.sucursal,
          vendedor: d.vendedor,
        })),
        comportamiento: { actual: cAct, anterior: cPrev },
        pagadas: histPagadas.map(r => ({
          documento: r.documento,
          fecha_emision: r.fecha_emision,
          fecha_vencimiento: r.fecha_vencimiento,
          fecha_cobro: r.fecha_cobro,
          valor: num(r.valor) || 0,
          dias_pago: parseInt(r.dias_pago),
          atraso: parseInt(r.atraso),
        })),
        serie: serie.map(r => ({
          mes: r.mes,
          facturado: num(r.facturado) || 0,
          cobrado: num(r.cobrado) || 0,
          compras: num(r.compras) || 0,
          dias_pago: redondo(r.dias_pago),
          sin_datos: r.mes < '2024-09',
        })),
        compras: {
          actual: kAct,
          anterior: kPrev,
          variacion_pct: kPrev.ventas > 0 ? redondo((kAct.ventas / kPrev.ventas - 1) * 100) : null,
          cada_dias: cadaDias,
        },
        ultimas_facturas: ultimas.map(u => ({
          documento: u.documento,
          fecha: u.fecha,
          total_sin_iva: num(u.total_sin_iva) || 0,
          total_con_iva: num(u.total_con_iva) || 0,
          margen_pct: redondo(u.margen_pct),
          vendedor: u.vendedor,
          saldo: num(u.saldo),
          estado_pago: u.estado_pago,
          fecha_vencimiento: u.fecha_vencimiento,
          fecha_cobro: u.fecha_cobro,
          lineas: (u.lineas || []).map(l => ({ ...l, unidades: num(l.unidades), total: num(l.total), precio: num(l.precio) })),
        })),
        // Montos de centavos (ajustes del ERP) dan márgenes absurdos: se omiten
        productos: productos.filter(r => Math.max(Math.abs(num(r.ventas)), Math.abs(num(r.ventas_prev))) >= 1).map(r => ({
          codigo: r.codigo, articulo: r.articulo, categoria: r.categoria,
          ventas: num(r.ventas) || 0, ventas_prev: num(r.ventas_prev) || 0,
          unidades: num(r.unidades) || 0, margen_pct: num(r.ventas) >= 100 ? redondo(r.margen_pct) : null, ultima_compra: r.ultima_compra,
        })),
        categorias: categorias.filter(r => Math.max(Math.abs(num(r.ventas)), Math.abs(num(r.ventas_prev))) >= 1).map(r => ({
          categoria: r.categoria, ventas: num(r.ventas) || 0, ventas_prev: num(r.ventas_prev) || 0,
          margen_pct: num(r.ventas) >= 100 ? redondo(r.margen_pct) : null,
        })),
        senales,
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/cxp
// Fuente real: thermoplastica.fact_cxp_factura (vista vstAnalisisCxP del ERP).
// Aging por fecha_vencimiento REAL (no estimada). Buckets alineados con CxC.
router.get('/cxp', async (req, res) => {
  try {
    // Saldos pendientes de documentos EMITIDOS dentro del período del filtro global.
    const P = parsePeriodo(req);
    const dias = parseInt(req.query.proximos_dias) || 30;

    const resumen = await db.getAsync(`
      SELECT
        COALESCE(SUM(saldo), 0)                                              AS total,
        COUNT(*)                                                             AS facturas,
        COUNT(DISTINCT proveedor_id)                                         AS proveedores,
        AVG(GREATEST((CURRENT_DATE - fecha_vencimiento)::int, 0))            AS promedio_dias,
        AVG(dias_credito_ficha) FILTER (WHERE dias_credito_ficha > 0)        AS dias_credito_promedio
      FROM thermoplastica.fact_cxp_factura
      WHERE saldo > 0
        AND fecha_emision BETWEEN ${P.D} AND ${P.H}
    `);

    // Aging real por fecha_vencimiento (buckets iguales a los de CxC)
    const aging = await db.getAsync(`
      SELECT
        COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento >= CURRENT_DATE), 0)                                 AS por_vencer,
        COALESCE(SUM(saldo) FILTER (WHERE (CURRENT_DATE - fecha_vencimiento) BETWEEN 1  AND 30), 0)              AS v_1_30,
        COALESCE(SUM(saldo) FILTER (WHERE (CURRENT_DATE - fecha_vencimiento) BETWEEN 31 AND 60), 0)              AS v_31_60,
        COALESCE(SUM(saldo) FILTER (WHERE (CURRENT_DATE - fecha_vencimiento) BETWEEN 61 AND 90), 0)              AS v_61_90,
        COALESCE(SUM(saldo) FILTER (WHERE (CURRENT_DATE - fecha_vencimiento) > 90), 0)                            AS v_90_mas
      FROM thermoplastica.fact_cxp_factura
      WHERE saldo > 0
        AND fecha_emision BETWEEN ${P.D} AND ${P.H}
    `);

    // Próximos pagos por fecha_vencimiento real en los próximos N días
    const proximos = await db.allAsync(`
      SELECT
        p.proveedor_id,
        p.nombre                       AS proveedor,
        p.codigo_proveedor             AS codigo,
        f.numero_interno,
        f.factura_proveedor,
        f.fecha_emision,
        f.fecha_vencimiento,
        f.saldo                        AS monto,
        f.dias_credito_ficha,
        (f.fecha_vencimiento - CURRENT_DATE)::int AS dias_restantes
      FROM thermoplastica.fact_cxp_factura f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      WHERE f.saldo > 0
        AND f.fecha_emision BETWEEN ${P.D} AND ${P.H}
        AND f.fecha_vencimiento <= CURRENT_DATE + (? || ' days')::interval
        AND f.fecha_vencimiento >= CURRENT_DATE
      ORDER BY f.fecha_vencimiento ASC
      LIMIT 100
    `, [dias]);

    // Top proveedores por CxP
    const topProveedores = await db.allAsync(`
      SELECT
        p.proveedor_id,
        p.nombre                              AS proveedor,
        p.codigo_proveedor                    AS codigo,
        COUNT(*)                              AS facturas,
        COALESCE(SUM(f.saldo), 0)             AS monto,
        AVG(f.dias_credito_ficha) FILTER (WHERE f.dias_credito_ficha > 0) AS dias_credito,
        COUNT(*) FILTER (WHERE f.fecha_vencimiento < CURRENT_DATE) AS facturas_vencidas
      FROM thermoplastica.fact_cxp_factura f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      WHERE f.saldo > 0
        AND f.fecha_emision BETWEEN ${P.D} AND ${P.H}
      GROUP BY p.proveedor_id, p.nombre, p.codigo_proveedor
      ORDER BY monto DESC
      LIMIT 10
    `);

    const total = parseFloat(resumen.total) || 0;
    const pct = (v) => (total > 0 ? Math.round((parseFloat(v) || 0) / total * 1000) / 10 : 0);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        total_cxp: total,
        facturas: parseInt(resumen.facturas) || 0,
        proveedores: parseInt(resumen.proveedores) || 0,
        promedio_dias_pago: Math.round(parseFloat(resumen.promedio_dias) || 0),
        dias_credito_promedio: Math.round(parseFloat(resumen.dias_credito_promedio) || 0),
        distribucion_aging: {
          por_vencer: { monto: parseFloat(aging.por_vencer) || 0, porcentaje: pct(aging.por_vencer) },
          v_1_30:     { monto: parseFloat(aging.v_1_30)     || 0, porcentaje: pct(aging.v_1_30) },
          v_31_60:    { monto: parseFloat(aging.v_31_60)    || 0, porcentaje: pct(aging.v_31_60) },
          v_61_90:    { monto: parseFloat(aging.v_61_90)    || 0, porcentaje: pct(aging.v_61_90) },
          v_90_mas:   { monto: parseFloat(aging.v_90_mas)   || 0, porcentaje: pct(aging.v_90_mas) },
        },
        proximos_pagos: proximos.map(p => ({
          proveedor_id: parseInt(p.proveedor_id),
          proveedor: p.proveedor,
          codigo: p.codigo,
          numero_interno: p.numero_interno,
          factura_proveedor: p.factura_proveedor,
          fecha_emision: p.fecha_emision,
          fecha_vencimiento: p.fecha_vencimiento,
          monto: parseFloat(p.monto) || 0,
          dias_credito_ficha: parseInt(p.dias_credito_ficha) || 0,
          dias_restantes: parseInt(p.dias_restantes) || 0,
        })),
        top_proveedores: topProveedores.map(p => ({
          proveedor_id: parseInt(p.proveedor_id),
          proveedor: p.proveedor,
          codigo: p.codigo,
          facturas: parseInt(p.facturas) || 0,
          monto: parseFloat(p.monto) || 0,
          dias_credito: Math.round(parseFloat(p.dias_credito) || 0),
          facturas_vencidas: parseInt(p.facturas_vencidas) || 0,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/cxp/detalle
// Listado paginado de facturas de CxP con filtros.
// Query params: ?limit=200&offset=0&busqueda=&bucket=&proveedor=
//   bucket ∈ 'por_vencer' | 'v_1_30' | 'v_31_60' | 'v_61_90' | 'v_90_mas' | 'todos'
router.get('/cxp/detalle', async (req, res) => {
  try {
    // Saldos pendientes de documentos EMITIDOS dentro del período del filtro global.
    const P = parsePeriodo(req);
    const limit    = Math.min(parseInt(req.query.limit) || 200, 1000);
    const offset   = parseInt(req.query.offset) || 0;
    const busqueda = (req.query.busqueda || '').trim();
    const bucket   = req.query.bucket || 'todos';
    const codigoProv = (req.query.proveedor || '').trim();

    const where = ['f.saldo > 0', `f.fecha_emision BETWEEN ${P.D} AND ${P.H}`];
    const params = [];

    if (busqueda) {
      params.push(`%${busqueda}%`);
      const p = `$${params.length}`;
      where.push(`(p.nombre ILIKE ${p} OR p.codigo_proveedor ILIKE ${p} OR f.numero_interno::text ILIKE ${p} OR f.factura_proveedor ILIKE ${p})`);
    }
    if (codigoProv) {
      params.push(codigoProv);
      where.push(`p.codigo_proveedor = $${params.length}`);
    }
    if      (bucket === 'por_vencer') where.push(`f.fecha_vencimiento >= CURRENT_DATE`);
    else if (bucket === 'v_1_30')     where.push(`(CURRENT_DATE - f.fecha_vencimiento) BETWEEN 1 AND 30`);
    else if (bucket === 'v_31_60')    where.push(`(CURRENT_DATE - f.fecha_vencimiento) BETWEEN 31 AND 60`);
    else if (bucket === 'v_61_90')    where.push(`(CURRENT_DATE - f.fecha_vencimiento) BETWEEN 61 AND 90`);
    else if (bucket === 'v_90_mas')   where.push(`(CURRENT_DATE - f.fecha_vencimiento) > 90`);

    const whereSql = where.join(' AND ');

    const rows = await db.allAsync(`
      SELECT
        f.factura_pk                              AS id,
        p.proveedor_id,
        p.codigo_proveedor                        AS codigo_proveedor,
        p.nombre                                  AS proveedor,
        p.rif                                     AS rif,
        s.codigo_sucursal                         AS codigo_sucursal,
        s.nombre                                  AS sucursal,
        f.numero_interno,
        f.factura_proveedor,
        f.fecha_emision,
        f.fecha_vencimiento,
        f.dias_credito_ficha,
        f.dias_segun_facturas,
        GREATEST((CURRENT_DATE - f.fecha_vencimiento)::int, 0) AS dias_atraso,
        f.valor,
        f.saldo,
        f.forma_pago,
        f.estado,
        f.fecha_ultimo_pago
      FROM thermoplastica.fact_cxp_factura f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      JOIN thermoplastica.dim_sucursal  s ON s.sucursal_id  = f.sucursal_id
      WHERE ${whereSql}
      ORDER BY f.saldo DESC, f.fecha_vencimiento ASC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    const totalRow = await db.getAsync(`
      SELECT COUNT(*) AS total, COALESCE(SUM(f.saldo), 0) AS suma_saldo
      FROM thermoplastica.fact_cxp_factura f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      WHERE ${whereSql}
    `, params);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        total_filas: parseInt(totalRow.total) || 0,
        suma_saldo: parseFloat(totalRow.suma_saldo) || 0,
        filas: rows.map(r => ({
          id: parseInt(r.id),
          proveedor_id: parseInt(r.proveedor_id),
          codigo_proveedor: r.codigo_proveedor,
          proveedor: r.proveedor,
          rif: r.rif,
          codigo_sucursal: r.codigo_sucursal,
          sucursal: r.sucursal,
          numero_interno: r.numero_interno,
          factura_proveedor: r.factura_proveedor,
          fecha_emision: r.fecha_emision,
          fecha_vencimiento: r.fecha_vencimiento,
          dias_credito_ficha: parseInt(r.dias_credito_ficha) || 0,
          dias_segun_facturas: parseInt(r.dias_segun_facturas) || 0,
          dias_atraso: parseInt(r.dias_atraso) || 0,
          valor: parseFloat(r.valor) || 0,
          saldo: parseFloat(r.saldo) || 0,
          forma_pago: r.forma_pago,
          estado: r.estado,
          fecha_ultimo_pago: r.fecha_ultimo_pago,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/cxp/proveedor/:id
// Ficha de un proveedor: estado de cuenta, cómo le pagamos y qué le compramos.
//
// Fuentes:
// - Saldo y antigüedad: fact_cxp_factura con saldo > 0, TODOS los documentos
//   abiertos sin importar el período. El saldo ya viene depurado (cxp_depuracion):
//   importaciones pagadas fuera del documento y retenciones no aplicadas en el ERP.
// - Cómo le pagamos: facturas con saldo 0 y fecha_ultimo_pago (historia desde
//   sep-2024; incluye las que quedaron en 0 por depuración de residuos). Las
//   importaciones depuradas sin ningún pago registrado no tienen fecha y no cuentan. Días de pago = último pago − emisión; atraso = último pago −
//   vencimiento; ponderados por valor. Se miden las facturas que terminamos de
//   pagar dentro del período (y el mismo rango del año anterior).
// - Compras: fact_compras_linea (sin IVA, mismo criterio que la página Compras).
const SQL_PAGOS_PROV = (desde, hasta) => `
  SELECT
    COUNT(*)                                                                 AS facturas,
    COALESCE(SUM(valor), 0)                                                  AS monto,
    SUM(valor * GREATEST(fecha_ultimo_pago - fecha_emision, 0)) / NULLIF(SUM(valor), 0) AS dias_pago,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY GREATEST(fecha_ultimo_pago - fecha_emision, 0)) AS dias_pago_mediana,
    SUM(valor * (fecha_ultimo_pago - fecha_vencimiento)) / NULLIF(SUM(valor), 0) AS atraso,
    COALESCE(SUM(valor) FILTER (WHERE fecha_ultimo_pago <= fecha_vencimiento), 0) / NULLIF(SUM(valor), 0) * 100 AS pct_a_tiempo,
    SUM(valor * (fecha_vencimiento - fecha_emision)) / NULLIF(SUM(valor), 0) AS plazo,
    MAX(fecha_ultimo_pago - fecha_vencimiento)                               AS peor_atraso
  FROM thermoplastica.fact_cxp_factura
  WHERE proveedor_id = $1 AND saldo = 0 AND fecha_ultimo_pago IS NOT NULL
    AND fecha_ultimo_pago BETWEEN ${desde} AND ${hasta}`;

const SQL_COMPRAS_PROV = (desde, hasta) => `
  SELECT
    COALESCE(SUM(total_sin_iva), 0)   AS compras,
    COUNT(DISTINCT fact_num)          AS facturas,
    COALESCE(SUM(unidades), 0)        AS unidades
  FROM thermoplastica.fact_compras_linea
  WHERE proveedor_id = $1 AND fecha_emision BETWEEN ${desde} AND ${hasta}`;

const comprasProv = (r) => ({
  compras: num(r.compras) || 0,
  facturas: parseInt(r.facturas) || 0,
  unidades: num(r.unidades) || 0,
  ticket: parseInt(r.facturas) ? (num(r.compras) || 0) / parseInt(r.facturas) : 0,
});

router.get('/cxp/proveedor/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ status: 'error', message: 'Proveedor inválido' });
    const P = parsePeriodo(req);
    const p = [id];

    const info = await db.getAsync(`
      SELECT proveedor_id, codigo_proveedor, ${NOMBRE_LIMPIO('nombre')} AS nombre, rif
      FROM thermoplastica.dim_proveedor WHERE proveedor_id = $1`, p);
    if (!info) return res.status(404).json({ status: 'error', message: 'Proveedor no encontrado' });

    const [
      relacion, plazoFicha, docs, pagAct, pagPrev, histPagadas,
      serie, comprasAct, comprasPrev, frecuencia, ultimas, productos, categorias, tipos,
    ] = await Promise.all([
      // Primera / última compra y sucursal principal (últimos 12 meses)
      db.getAsync(`
        SELECT ${fecha('MIN(f.fecha_emision)')} AS primera_compra, ${fecha('MAX(f.fecha_emision)')} AS ultima_compra,
          (SELECT s.nombre FROM thermoplastica.fact_compras_linea x
             JOIN thermoplastica.dim_sucursal s ON s.sucursal_id = x.sucursal_id
           WHERE x.proveedor_id = $1 AND x.fecha_emision > CURRENT_DATE - 365
           GROUP BY s.nombre ORDER BY SUM(x.total_sin_iva) DESC LIMIT 1) AS sucursal
        FROM thermoplastica.fact_compras_linea f WHERE f.proveedor_id = $1`, p),

      // Días de crédito pactados en la ficha (de la factura más reciente)
      db.getAsync(`
        SELECT dias_credito_ficha FROM thermoplastica.fact_cxp_factura
        WHERE proveedor_id = $1 AND dias_credito_ficha IS NOT NULL
        ORDER BY fecha_emision DESC LIMIT 1`, p),

      // Estado de cuenta: documentos abiertos
      db.allAsync(`
        SELECT f.numero_interno::text AS documento, f.factura_proveedor,
          ${fecha('f.fecha_emision')} AS fecha_emision, ${fecha('f.fecha_vencimiento')} AS fecha_vencimiento,
          (CURRENT_DATE - f.fecha_vencimiento)::int AS dias_vencido,
          f.valor, f.saldo, f.saldo_erp, f.saldo_depurado, ${fecha('f.fecha_ultimo_pago')} AS ultimo_pago,
          s.nombre AS sucursal
        FROM thermoplastica.fact_cxp_factura f
        LEFT JOIN thermoplastica.dim_sucursal s ON s.sucursal_id = f.sucursal_id
        WHERE f.proveedor_id = $1 AND f.saldo > 0
        ORDER BY f.fecha_vencimiento ASC, f.numero_interno`, p),

      db.getAsync(SQL_PAGOS_PROV(P.D, P.H), p),
      db.getAsync(SQL_PAGOS_PROV(P.prevD, P.prevH), p),

      // Facturas ya pagadas, más recientes primero
      db.allAsync(`
        SELECT numero_interno::text AS documento, factura_proveedor, ${fecha('fecha_emision')} AS fecha_emision,
               ${fecha('fecha_vencimiento')} AS fecha_vencimiento, ${fecha('fecha_ultimo_pago')} AS fecha_pago,
               valor, GREATEST(fecha_ultimo_pago - fecha_emision, 0) AS dias_pago,
               (fecha_ultimo_pago - fecha_vencimiento) AS atraso
        FROM thermoplastica.fact_cxp_factura
        WHERE proveedor_id = $1 AND saldo = 0 AND fecha_ultimo_pago IS NOT NULL
        ORDER BY fecha_ultimo_pago DESC, numero_interno DESC
        LIMIT 200`, p),

      // 24 meses hasta el fin del período: facturado y pagado (con IVA), días de pago y compras sin IVA
      db.allAsync(`
        WITH m AS (
          SELECT generate_series(date_trunc('month', ${P.H}) - interval '23 months', date_trunc('month', ${P.H}), interval '1 month')::date AS mes
        ), fac AS (
          SELECT * FROM thermoplastica.fact_cxp_factura WHERE proveedor_id = $1
        )
        SELECT to_char(m.mes, 'YYYY-MM') AS mes,
          (SELECT COALESCE(SUM(valor), 0) FROM fac WHERE date_trunc('month', fecha_emision) = m.mes) AS facturado,
          (SELECT COALESCE(SUM(valor), 0) FROM fac WHERE saldo = 0 AND fecha_ultimo_pago IS NOT NULL AND date_trunc('month', fecha_ultimo_pago) = m.mes) AS pagado,
          (SELECT SUM(valor * GREATEST(fecha_ultimo_pago - fecha_emision, 0)) / NULLIF(SUM(valor), 0)
             FROM fac WHERE saldo = 0 AND fecha_ultimo_pago IS NOT NULL AND date_trunc('month', fecha_ultimo_pago) = m.mes) AS dias_pago,
          (SELECT COALESCE(SUM(total_sin_iva), 0) FROM thermoplastica.fact_compras_linea c
             WHERE c.proveedor_id = $1 AND date_trunc('month', c.fecha_emision) = m.mes) AS compras
        FROM m ORDER BY m.mes`, p),

      db.getAsync(SQL_COMPRAS_PROV(P.D, P.H), p),
      db.getAsync(SQL_COMPRAS_PROV(P.prevD, P.prevH), p),

      // Frecuencia de compra: días promedio entre fechas de compra (últimos 12 meses)
      db.getAsync(`
        SELECT (MAX(fecha_emision) - MIN(fecha_emision))::numeric / NULLIF(COUNT(DISTINCT fecha_emision) - 1, 0) AS cada_dias
        FROM thermoplastica.fact_compras_linea
        WHERE proveedor_id = $1 AND fecha_emision > CURRENT_DATE - 365`, p),

      // Últimas facturas de compra con su detalle y estado de pago
      db.allAsync(`
        WITH ult AS (
          SELECT fact_num, MIN(fecha_emision) AS fecha
          FROM thermoplastica.fact_compras_linea WHERE proveedor_id = $1
          GROUP BY fact_num ORDER BY MIN(fecha_emision) DESC, fact_num DESC LIMIT 25
        )
        SELECT u.fact_num::text AS documento, ${fecha('u.fecha')} AS fecha,
          SUM(f.total_sin_iva) AS total_sin_iva, SUM(f.total_con_iva) AS total_con_iva,
          json_agg(json_build_object(
            'codigo', a.codigo_articulo, 'articulo', a.descripcion, 'categoria', a.marca,
            'unidades', f.unidades, 'total', f.total_sin_iva,
            'precio', f.total_sin_iva / NULLIF(f.unidades, 0)
          ) ORDER BY f.total_sin_iva DESC) AS lineas,
          MAX(cxp.factura_proveedor) AS factura_proveedor,
          MAX(cxp.saldo) AS saldo, MAX(cxp.estado) AS estado_pago,
          ${fecha('MAX(cxp.fecha_vencimiento)')} AS fecha_vencimiento,
          ${fecha('MAX(cxp.fecha_ultimo_pago)')} AS fecha_pago
        FROM ult u
        JOIN thermoplastica.fact_compras_linea f ON f.fact_num = u.fact_num AND f.proveedor_id = $1
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        LEFT JOIN thermoplastica.fact_cxp_factura cxp ON cxp.proveedor_id = $1 AND cxp.numero_interno = u.fact_num
        GROUP BY u.fact_num, u.fecha
        ORDER BY u.fecha DESC, u.fact_num DESC`, p),

      // Artículos del período (con el mismo rango del año anterior) y su precio unitario
      db.allAsync(`
        SELECT a.codigo_articulo AS codigo, MAX(a.descripcion) AS articulo, MAX(a.marca) AS categoria,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision BETWEEN ${P.D} AND ${P.H}), 0) AS compras,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}), 0) AS compras_prev,
          COALESCE(SUM(f.unidades) FILTER (WHERE f.fecha_emision BETWEEN ${P.D} AND ${P.H}), 0) AS unidades,
          SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision BETWEEN ${P.D} AND ${P.H})
            / NULLIF(SUM(f.unidades) FILTER (WHERE f.fecha_emision BETWEEN ${P.D} AND ${P.H}), 0) AS precio,
          SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH})
            / NULLIF(SUM(f.unidades) FILTER (WHERE f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}), 0) AS precio_prev,
          ${fecha('MAX(f.fecha_emision)')} AS ultima_compra
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.proveedor_id = $1 AND (f.fecha_emision BETWEEN ${P.D} AND ${P.H} OR f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH})
        GROUP BY a.codigo_articulo
        ORDER BY 4 DESC, 5 DESC
        LIMIT 300`, p),

      // Por categoría
      db.allAsync(`
        SELECT COALESCE(NULLIF(TRIM(a.marca), ''), 'Sin categoría') AS categoria,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision BETWEEN ${P.D} AND ${P.H}), 0) AS compras,
          COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH}), 0) AS compras_prev
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.proveedor_id = $1 AND (f.fecha_emision BETWEEN ${P.D} AND ${P.H} OR f.fecha_emision BETWEEN ${P.prevD} AND ${P.prevH})
        GROUP BY 1
        ORDER BY 2 DESC, 3 DESC`, p),

      // Tipo de compra principal (materiales, gastos, importación...) en los últimos 12 meses
      db.allAsync(`
        SELECT ${TIPO_EXPR} AS tipo, SUM(f.total_sin_iva) AS compras
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.proveedor_id = $1 AND f.fecha_emision > CURRENT_DATE - 365
        GROUP BY 1 ORDER BY 2 DESC`, p),
    ]);

    // ---- Saldo y antigüedad ----
    const suma = (fn) => docs.reduce((t, d) => t + fn(d), 0);
    const sal = (d) => Number(d.saldo) || 0;
    const tramo = (min, max) => suma(d => (d.dias_vencido >= min && d.dias_vencido <= max ? sal(d) : 0));
    const vencidos = docs.filter(d => d.dias_vencido > 0);
    const saldo = {
      total: suma(sal),
      por_vencer: tramo(-Infinity, 0),
      vencido: tramo(1, Infinity),
      depurado: suma(d => Number(d.saldo_depurado) || 0),
      documentos: docs.length,
      vencidos: vencidos.length,
      aging: {
        por_vencer: tramo(-Infinity, 0),
        d1_30: tramo(1, 30),
        d31_60: tramo(31, 60),
        d61_90: tramo(61, 90),
        d90_mas: tramo(91, Infinity),
      },
      mas_antiguo_dias: vencidos.reduce((m, d) => Math.max(m, d.dias_vencido), 0),
      proximo_vencimiento: docs.find(d => d.dias_vencido <= 0)?.fecha_vencimiento || null,
    };

    const pAct = comportamiento(pagAct);
    const pPrev = comportamiento(pagPrev);
    const kAct = comprasProv(comprasAct);
    const kPrev = comprasProv(comprasPrev);
    const cadaDias = redondo(frecuencia?.cada_dias, 0);
    const plazoPactado = plazoFicha ? parseInt(plazoFicha.dias_credito_ficha) : null;
    const TIPO_LABEL = Object.fromEntries(TIPOS.map(t => [t.id, t.label]));
    const totalTipos = tipos.reduce((t, r) => t + (Number(r.compras) || 0), 0);

    // Precio: artículos comprados en ambos períodos → (precio actual − anterior) × unidades actuales
    let sobrecosto = 0;
    let baseComparable = 0;
    for (const r of productos) {
      if (num(r.precio) > 0 && num(r.precio_prev) > 0 && num(r.unidades) > 0) {
        sobrecosto += (num(r.precio) - num(r.precio_prev)) * num(r.unidades);
        baseComparable += num(r.precio_prev) * num(r.unidades);
      }
    }
    const variacionPrecio = baseComparable > 0 ? redondo(sobrecosto / baseComparable * 100) : null;

    // ---- Señales en lenguaje simple (reglas, no IA) ----
    const senales = [];
    const fmtQ = (v) => `Q${Math.round(v).toLocaleString('es-GT')}`;
    if (pAct.facturas >= 3 && pAct.atraso !== null) {
      if (pAct.atraso > 5) senales.push({ tipo: 'aviso', texto: `Le pagamos en promedio ${Math.round(pAct.atraso)} días después del vencimiento (ponderado por monto).` });
      else if (pAct.atraso < -5) senales.push({ tipo: 'aviso', texto: `Le pagamos en promedio ${Math.round(-pAct.atraso)} días antes del vencimiento: hay margen para usar más el crédito.` });
      else senales.push({ tipo: 'bien', texto: 'Le pagamos en la fecha de vencimiento o muy cerca de ella.' });
    }
    if (saldo.vencido > 0) {
      senales.push({
        tipo: saldo.mas_antiguo_dias > 60 ? 'alerta' : 'aviso',
        texto: `${fmtQ(saldo.vencido)} vencidos en ${saldo.vencidos} documento${saldo.vencidos === 1 ? '' : 's'}; el más antiguo tiene ${saldo.mas_antiguo_dias} días de atraso.`,
      });
    }
    if (kPrev.compras > 0) {
      const v = (kAct.compras / kPrev.compras - 1) * 100;
      if (Math.abs(v) >= 15) senales.push({ tipo: 'aviso', texto: `Le compramos ${Math.abs(v).toFixed(0)}% ${v > 0 ? 'más' : 'menos'} que en el mismo período del año anterior.` });
    } else if (kAct.compras > 0) {
      senales.push({ tipo: 'aviso', texto: 'Sin compras en el mismo período del año anterior: es un proveedor nuevo o se reactivó.' });
    }
    if (variacionPrecio !== null && Math.abs(variacionPrecio) >= 3 && Math.abs(sobrecosto) >= 1000) {
      senales.push({
        tipo: variacionPrecio > 0 ? 'alerta' : 'bien',
        texto: `Sus precios ${variacionPrecio > 0 ? 'subieron' : 'bajaron'} ${Math.abs(variacionPrecio).toFixed(1)}% en los artículos que también compramos el año anterior (${variacionPrecio > 0 ? '+' : '−'}${fmtQ(Math.abs(sobrecosto))} en el período).`,
      });
    }
    if (plazoPactado !== null && pAct.plazo !== null && plazoPactado - pAct.plazo > 5) {
      senales.push({ tipo: 'aviso', texto: `Sus facturas vencen a ${Math.round(pAct.plazo)} días en promedio, menos que los ${plazoPactado} de su ficha.` });
    }
    if (saldo.depurado > 0) {
      senales.push({ tipo: 'aviso', texto: `${fmtQ(saldo.depurado)} de saldo del ERP en facturas abiertas se descontaron por depuración (pagos confirmados que el ERP no aplicó).` });
    }

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        periodo: P.ventana(),
        proveedor: {
          id: parseInt(info.proveedor_id),
          codigo: info.codigo_proveedor,
          nombre: info.nombre,
          nit: info.rif,
          sucursal: relacion?.sucursal || null,
          tipo_principal: tipos[0] ? TIPO_LABEL[tipos[0].tipo] : null,
          tipos: tipos.map(t => ({ tipo: TIPO_LABEL[t.tipo] || t.tipo, compras: num(t.compras) || 0, pct: totalTipos > 0 ? redondo(num(t.compras) / totalTipos * 100) : 0 })),
          primera_compra: relacion?.primera_compra || null,
          ultima_compra: relacion?.ultima_compra || null,
          dias_credito: plazoPactado,
          historia_desde: '2024-09-18',
        },
        saldo,
        estado_cuenta: docs.map(d => ({
          documento: d.documento,
          factura_proveedor: d.factura_proveedor,
          fecha_emision: d.fecha_emision,
          fecha_vencimiento: d.fecha_vencimiento,
          dias_vencido: d.dias_vencido,
          valor: num(d.valor),
          abonado: d.valor !== null ? Math.max(0, Number(d.valor) - Number(d.saldo_erp ?? d.saldo)) : null,
          depurado: num(d.saldo_depurado) || 0,
          saldo: num(d.saldo) || 0,
          ultimo_pago: d.ultimo_pago,
          sucursal: d.sucursal,
        })),
        pagos: { actual: pAct, anterior: pPrev },
        pagadas: histPagadas.map(r => ({
          documento: r.documento,
          factura_proveedor: r.factura_proveedor,
          fecha_emision: r.fecha_emision,
          fecha_vencimiento: r.fecha_vencimiento,
          fecha_pago: r.fecha_pago,
          valor: num(r.valor) || 0,
          dias_pago: parseInt(r.dias_pago),
          atraso: parseInt(r.atraso),
        })),
        serie: serie.map(r => ({
          mes: r.mes,
          facturado: num(r.facturado) || 0,
          pagado: num(r.pagado) || 0,
          compras: num(r.compras) || 0,
          dias_pago: redondo(r.dias_pago),
          sin_datos: r.mes < '2024-09',
        })),
        compras: {
          actual: kAct,
          anterior: kPrev,
          variacion_pct: kPrev.compras > 0 ? redondo((kAct.compras / kPrev.compras - 1) * 100) : null,
          variacion_precio_pct: variacionPrecio,
          sobrecosto,
          cada_dias: cadaDias,
        },
        ultimas_facturas: ultimas.map(u => ({
          documento: u.documento,
          factura_proveedor: u.factura_proveedor,
          fecha: u.fecha,
          total_sin_iva: num(u.total_sin_iva) || 0,
          total_con_iva: num(u.total_con_iva) || 0,
          saldo: num(u.saldo),
          estado_pago: u.estado_pago,
          fecha_vencimiento: u.fecha_vencimiento,
          fecha_pago: u.fecha_pago,
          lineas: (u.lineas || []).map(l => ({ ...l, unidades: num(l.unidades), total: num(l.total), precio: num(l.precio) })),
        })),
        // Montos de centavos (ajustes del ERP) se omiten
        productos: productos.filter(r => Math.max(Math.abs(num(r.compras)), Math.abs(num(r.compras_prev))) >= 1).map(r => ({
          codigo: r.codigo, articulo: r.articulo, categoria: r.categoria,
          compras: num(r.compras) || 0, compras_prev: num(r.compras_prev) || 0,
          unidades: num(r.unidades) || 0, precio: num(r.precio), precio_prev: num(r.precio_prev),
          ultima_compra: r.ultima_compra,
        })),
        categorias: categorias.filter(r => Math.max(Math.abs(num(r.compras)), Math.abs(num(r.compras_prev))) >= 1).map(r => ({
          categoria: r.categoria, compras: num(r.compras) || 0, compras_prev: num(r.compras_prev) || 0,
        })),
        senales,
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/tesoreria/proyeccion
// Flujo de caja operativo proyectado sobre datos reales (CxC, CxP, ventas y
// compras). Es el mismo cálculo que /api/analisis/flujo-caja.
router.get('/proyeccion', async (req, res) => {
  try {
    const semanas = Math.min(Math.max(parseInt(req.query.semanas) || 13, 1), 26);
    const data = await proyecciones.proyectarFlujo({ semanas });
    res.json({ status: 'success', timestamp: new Date().toISOString(), data });
  } catch (error) {
    console.error('[GET /tesoreria/proyeccion] Error:', error);
    res.status(500).json({ status: 'error', message: 'Error al proyectar el flujo de caja' });
  }
});

module.exports = router;
