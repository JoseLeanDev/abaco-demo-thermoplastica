const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

// GET /api/dashboard
// Executive briefing CEO-grade: KPIs, aging, YoY, márgenes, inventario, concentración, insights.
router.get('/', async (req, res) => {
  try {
    // ==============================================================
    // 1) SERIE MENSUAL 24 MESES (ventas + margen) — para YoY overlay
    // ==============================================================
    const serie24m = await db.allAsync(`
      SELECT EXTRACT(YEAR FROM fecha_emision)::int  AS anio,
             EXTRACT(MONTH FROM fecha_emision)::int AS mes,
             COALESCE(SUM(total_sin_iva), 0)        AS ventas,
             COALESCE(SUM(margen_bruto), 0)         AS margen,
             COALESCE(SUM(costo_total_facturado),0) AS costo,
             COUNT(DISTINCT fact_num)               AS facturas
      FROM thermoplastica.fact_ventas_linea
      WHERE tipo_doc = 'FACT'
        AND fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);

    // ==============================================================
    // 2) VENTAS 12m vs 12m previo (YoY comparison)
    // ==============================================================
    const yoy = await db.getAsync(`
      SELECT
        COALESCE(SUM(total_sin_iva)         FILTER (WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months'), 0) AS ventas_actual,
        COALESCE(SUM(total_sin_iva)         FILTER (WHERE fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
                                                     AND fecha_emision <  CURRENT_DATE - INTERVAL '12 months'), 0) AS ventas_previo,
        COALESCE(SUM(margen_bruto)          FILTER (WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months'), 0) AS margen_actual,
        COALESCE(SUM(margen_bruto)          FILTER (WHERE fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
                                                     AND fecha_emision <  CURRENT_DATE - INTERVAL '12 months'), 0) AS margen_previo,
        COALESCE(SUM(costo_total_facturado) FILTER (WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months'), 0) AS costo_actual,
        COUNT(DISTINCT fact_num)            FILTER (WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months')    AS facturas_actual,
        COUNT(DISTINCT cliente_id)          FILTER (WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months')    AS clientes_actual,
        COUNT(DISTINCT cliente_id)          FILTER (WHERE fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
                                                     AND fecha_emision <  CURRENT_DATE - INTERVAL '12 months')    AS clientes_previo
      FROM thermoplastica.fact_ventas_linea
      WHERE tipo_doc = 'FACT'
    `);

    // ==============================================================
    // 3) Compras materia prima y gastos operativos (12m + 12m previo)
    // ==============================================================
    const comprasGastos = await db.getAsync(`
      SELECT
        COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
                                                AND COALESCE(a.es_gasto_operativo, FALSE) = FALSE), 0) AS compras_actual,
        COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
                                                AND f.fecha_emision <  CURRENT_DATE - INTERVAL '12 months'
                                                AND COALESCE(a.es_gasto_operativo, FALSE) = FALSE), 0) AS compras_previo,
        COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
                                                AND COALESCE(a.es_gasto_operativo, FALSE) = TRUE), 0) AS gastos_actual,
        COALESCE(SUM(f.total_sin_iva) FILTER (WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '24 months'
                                                AND f.fecha_emision <  CURRENT_DATE - INTERVAL '12 months'
                                                AND COALESCE(a.es_gasto_operativo, FALSE) = TRUE), 0) AS gastos_previo
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
    `);

    // ==============================================================
    // 4) CxC aging (buckets)
    // ==============================================================
    const cxc = await db.getAsync(`
      SELECT
        COALESCE(SUM(saldo_total), 0)        AS total,
        COALESCE(SUM(vencido), 0)            AS vencido,
        COALESCE(SUM(porvencer), 0)          AS por_vencer,
        COALESCE(SUM(v30), 0)                AS v_1_30,
        COALESCE(SUM(v31a60), 0)             AS v_31_60,
        COALESCE(SUM(v61a90), 0)             AS v_61_90,
        COALESCE(SUM(v91a120 + v120), 0)     AS v_90_mas,
        COUNT(*)                             AS documentos
      FROM thermoplastica.fact_cxc_snapshot_diario
      WHERE fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario)
    `);

    // ==============================================================
    // 5) CxP aging (buckets)
    // ==============================================================
    const cxp = await db.getAsync(`
      SELECT
        COALESCE(SUM(saldo), 0)                                                                              AS total,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento >= CURRENT_DATE), 0)                             AS por_vencer,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE - 1), 0)  AS v_1_30,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE - 31), 0) AS v_31_60,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 61), 0) AS v_61_90,
        COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento < CURRENT_DATE - 90), 0)                         AS v_90_mas,
        COUNT(*)                                                                                             AS facturas,
        COUNT(DISTINCT proveedor_id)                                                                         AS proveedores
      FROM thermoplastica.fact_cxp_factura
      WHERE saldo > 0
    `);

    // ==============================================================
    // 6) Inventario snapshot vivo
    // ==============================================================
    const inventario = await db.getAsync(`
      SELECT
        COALESCE(SUM(valor_inventario), 0)   AS valor_total,
        COUNT(DISTINCT articulo_id)          AS articulos,
        COUNT(*) FILTER (WHERE stock_actual > 0) AS con_stock,
        COUNT(*) FILTER (WHERE precio_venta_1 IS NULL OR precio_venta_1 = 0) AS sin_precio
      FROM thermoplastica.fact_inventario_snapshot
      WHERE fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_inventario_snapshot)
    `);

    // ==============================================================
    // 7) Top 5 clientes por CxC + top 5 proveedores por CxP
    // ==============================================================
    const topClientes = await db.allAsync(`
      SELECT c.codigo_cliente AS codigo, c.nombre AS cliente,
             SUM(f.saldo_total) AS monto,
             SUM(f.vencido)     AS vencido
      FROM thermoplastica.fact_cxc_snapshot_diario f
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id
      WHERE f.fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario)
      GROUP BY c.codigo_cliente, c.nombre
      ORDER BY monto DESC
      LIMIT 5
    `);

    const topProveedores = await db.allAsync(`
      SELECT p.codigo_proveedor AS codigo, p.nombre AS proveedor,
             COUNT(*)                                                        AS facturas,
             COALESCE(SUM(f.saldo), 0)                                       AS monto,
             AVG(f.dias_credito_ficha) FILTER (WHERE f.dias_credito_ficha > 0) AS dias_credito,
             COUNT(*) FILTER (WHERE f.fecha_vencimiento < CURRENT_DATE)      AS facturas_vencidas
      FROM thermoplastica.fact_cxp_factura f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      WHERE f.saldo > 0
      GROUP BY p.codigo_proveedor, p.nombre
      ORDER BY monto DESC
      LIMIT 5
    `);

    // Proveedores con ALTO riesgo: 100% vencidos + crédito ficha = 0 + monto material
    const proveedoresRiesgo = await db.allAsync(`
      SELECT p.nombre AS proveedor, p.codigo_proveedor AS codigo,
             COUNT(*) AS facturas,
             COALESCE(SUM(f.saldo), 0) AS monto
      FROM thermoplastica.fact_cxp_factura f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      WHERE f.saldo > 0
      GROUP BY p.nombre, p.codigo_proveedor
      HAVING BOOL_AND(f.dias_credito_ficha = 0)
         AND BOOL_AND(f.fecha_vencimiento < CURRENT_DATE)
         AND SUM(f.saldo) > 1000000
      ORDER BY monto DESC
      LIMIT 3
    `);

    // CxC: disciplina de crédito
    const cxcDesviacion = await db.getAsync(`
      SELECT
        COUNT(*) FILTER (WHERE dias_segun_facturas > dias_credito_ficha) AS facturas_extendidas,
        COUNT(*)                                                          AS total_facturas,
        ROUND(100.0 * COUNT(*) FILTER (WHERE dias_segun_facturas > dias_credito_ficha) / NULLIF(COUNT(*), 0), 1) AS pct_extension
      FROM thermoplastica.fact_cxc_factura
      WHERE dias_credito_ficha IS NOT NULL
        AND dias_segun_facturas IS NOT NULL
        AND fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
    `);

    // Concentración de compras (top 3 proveedores)
    const concentracionCompras = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(f.total_sin_iva), 0) AS total
        FROM thermoplastica.fact_compras_linea f
        JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
        WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
          AND COALESCE(a.es_gasto_operativo, FALSE) = FALSE
      )
      SELECT p.nombre AS proveedor, p.codigo_proveedor AS codigo,
             COALESCE(SUM(f.total_sin_iva), 0) AS gasto,
             ROUND(100 * SUM(f.total_sin_iva) / NULLIF((SELECT total FROM tot), 0), 1) AS porcentaje
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      JOIN thermoplastica.dim_articulo  a ON a.articulo_id  = f.articulo_id
      WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
        AND COALESCE(a.es_gasto_operativo, FALSE) = FALSE
      GROUP BY p.nombre, p.codigo_proveedor
      ORDER BY gasto DESC
      LIMIT 3
    `);

    // ==============================================================
    // 8) Top líneas de producto por ventas 12m (para inventario/mix)
    // ==============================================================
    const topLineas = await db.allAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(f.total_sin_iva), 0) AS total
        FROM thermoplastica.fact_ventas_linea f
        WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months' AND f.tipo_doc = 'FACT'
      )
      SELECT COALESCE(a.linea, 'Sin línea') AS linea,
             COALESCE(SUM(f.total_sin_iva), 0)  AS ventas,
             COALESCE(SUM(f.margen_bruto), 0)   AS margen,
             CASE WHEN SUM(f.total_sin_iva) > 0
                  THEN ROUND(SUM(f.margen_bruto) / SUM(f.total_sin_iva) * 100, 1)
                  ELSE 0 END AS margen_pct,
             ROUND(100 * SUM(f.total_sin_iva) / NULLIF((SELECT total FROM tot), 0), 1) AS porcentaje
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months' AND f.tipo_doc = 'FACT'
        AND a.codigo_articulo NOT IN ('GENARTICULO','GENARTICULOEXENTO','GENSERV','GENSERVICIO')
      GROUP BY 1
      ORDER BY ventas DESC
      LIMIT 6
    `);

    // ==============================================================
    // 9) CxC críticas y top cliente/vendedor
    // ==============================================================
    const cxcCriticas = await db.allAsync(`
      SELECT c.nombre AS cliente, f.tipo_documento, f.documento,
             f.fecha_vencimiento,
             (CURRENT_DATE - f.fecha_vencimiento)::int AS dias_atraso,
             f.saldo_total
      FROM thermoplastica.fact_cxc_snapshot_diario f
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id
      WHERE f.fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario)
        AND (CURRENT_DATE - f.fecha_vencimiento) > 60
        AND f.saldo_total > 0
      ORDER BY f.saldo_total DESC
      LIMIT 5
    `);

    const topClienteVentas = await db.getAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(total_sin_iva), 0) AS total
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months' AND tipo_doc = 'FACT'
      )
      SELECT c.codigo_cliente AS codigo, c.nombre AS cliente,
             COALESCE(SUM(f.total_sin_iva), 0) AS ventas,
             CASE WHEN (SELECT total FROM tot) > 0
                  THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
                  ELSE 0 END AS porcentaje
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id
      WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months' AND f.tipo_doc = 'FACT'
      GROUP BY c.codigo_cliente, c.nombre
      ORDER BY ventas DESC LIMIT 1
    `);

    const topVendedor = await db.getAsync(`
      WITH tot AS (
        SELECT COALESCE(SUM(total_sin_iva), 0) AS total
        FROM thermoplastica.fact_ventas_linea
        WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months' AND tipo_doc = 'FACT'
      )
      SELECT v.nombre AS vendedor, v.codigo_vendedor AS codigo,
             COUNT(DISTINCT f.cliente_id) AS clientes,
             COALESCE(SUM(f.total_sin_iva), 0) AS ventas,
             CASE WHEN SUM(f.total_sin_iva) > 0
                  THEN ROUND(SUM(f.margen_bruto) / SUM(f.total_sin_iva) * 100, 1)
                  ELSE NULL END AS margen_pct,
             CASE WHEN (SELECT total FROM tot) > 0
                  THEN ROUND(100 * SUM(f.total_sin_iva) / (SELECT total FROM tot), 1)
                  ELSE 0 END AS porcentaje
      FROM thermoplastica.fact_ventas_linea f
      JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
      WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months' AND f.tipo_doc = 'FACT'
      GROUP BY v.nombre, v.codigo_vendedor
      ORDER BY ventas DESC LIMIT 1
    `);

    // ==============================================================
    // 10) DERIVADOS + serie mensual normalizada (con etiqueta YoY)
    // ==============================================================
    const ventas12m       = parseFloat(yoy.ventas_actual) || 0;
    const ventas12mPrev   = parseFloat(yoy.ventas_previo) || 0;
    const margenReal12m   = parseFloat(yoy.margen_actual) || 0;
    const margenPrev12m   = parseFloat(yoy.margen_previo) || 0;
    const costoVentas12m  = parseFloat(yoy.costo_actual)  || 0;
    const facturas12m     = parseInt(yoy.facturas_actual) || 0;
    const clientesAct12m  = parseInt(yoy.clientes_actual) || 0;
    const clientesPrev12m = parseInt(yoy.clientes_previo) || 0;

    const margenRealPct   = ventas12m > 0     ? (margenReal12m / ventas12m * 100)     : null;
    const margenPrevPct   = ventas12mPrev > 0 ? (margenPrev12m / ventas12mPrev * 100) : null;
    const deltaVentasPct  = ventas12mPrev > 0 ? ((ventas12m - ventas12mPrev) / ventas12mPrev * 100) : null;
    const deltaMargenPp   = (margenRealPct !== null && margenPrevPct !== null) ? (margenRealPct - margenPrevPct) : null;

    const compras12m = parseFloat(comprasGastos.compras_actual) || 0;
    const comprasPrev12m = parseFloat(comprasGastos.compras_previo) || 0;
    const gastos12m  = parseFloat(comprasGastos.gastos_actual) || 0;
    const gastosPrev12m = parseFloat(comprasGastos.gastos_previo) || 0;
    const deltaComprasPct = comprasPrev12m > 0 ? ((compras12m - comprasPrev12m) / comprasPrev12m * 100) : null;
    const deltaGastosPct  = gastosPrev12m > 0  ? ((gastos12m  - gastosPrev12m)  / gastosPrev12m  * 100) : null;

    const cxcTotal   = parseFloat(cxc.total) || 0;
    const cxpTotal   = parseFloat(cxp.total) || 0;
    const ebitdaEstimado = margenReal12m - gastos12m;
    const ebitdaPct = ventas12m > 0 ? (ebitdaEstimado / ventas12m * 100) : null;
    const posicionNetaWC = cxcTotal - cxpTotal;
    const coberturaCxCCxP = cxpTotal > 0 ? cxcTotal / cxpTotal : null;

    // Cash Conversion Cycle proxy
    const dso = ventas12m > 0 ? (cxcTotal / (ventas12m / 365)) : null;
    const dpo = compras12m > 0 ? (cxpTotal / (compras12m / 365)) : null;
    const valorInventario = parseFloat(inventario.valor_total) || 0;
    const dio = costoVentas12m > 0 ? (valorInventario / (costoVentas12m / 365)) : null;
    const ccc = (dso !== null && dpo !== null && dio !== null) ? (dso + dio - dpo) : null;

    // Tendencia mes anterior
    const serieOrdenada = serie24m.slice(-13); // hasta 12 meses + curso
    const mesAnterior = serieOrdenada.length >= 2 ? parseFloat(serieOrdenada[serieOrdenada.length - 2].ventas) : 0;
    const promedioPrevios = serieOrdenada.length >= 3
      ? serieOrdenada.slice(0, -2).reduce((s, r) => s + parseFloat(r.ventas), 0) / (serieOrdenada.length - 2)
      : 0;
    const tendenciaMes = promedioPrevios > 0 ? ((mesAnterior - promedioPrevios) / promedioPrevios * 100) : null;

    // Serie mensual con overlay YoY (ventas mismo mes año previo)
    const serieMap = {};
    serie24m.forEach(r => { serieMap[`${r.anio}-${r.mes}`] = r; });
    const serieYoY = serie24m.slice(-13).map(r => {
      const prev = serieMap[`${parseInt(r.anio) - 1}-${r.mes}`];
      return {
        anio: r.anio,
        mes: r.mes,
        periodo: `${r.anio}-${String(r.mes).padStart(2, '0')}`,
        ventas: parseFloat(r.ventas) || 0,
        margen: parseFloat(r.margen) || 0,
        margen_pct: parseFloat(r.ventas) > 0 ? Math.round(parseFloat(r.margen) / parseFloat(r.ventas) * 1000) / 10 : 0,
        ventas_prev: prev ? parseFloat(prev.ventas) || 0 : null,
      };
    });

    // ==============================================================
    // 11) HEALTH SCORE COMPOSITE (0-100)
    // ==============================================================
    // Componentes: crecimiento ventas, margen bruto, EBITDA %, cobertura CxC/CxP,
    //              disciplina crédito CxC, concentración cliente #1, % vencido CxC.
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const scoreCrecimiento = deltaVentasPct === null ? 60 : clamp(50 + deltaVentasPct * 3, 0, 100);
    const scoreMargen      = margenRealPct  === null ? 60 : clamp((margenRealPct - 15) * 4, 0, 100);
    const scoreEbitda      = ebitdaPct      === null ? 60 : clamp((ebitdaPct - 5) * 6, 0, 100);
    const scoreCobertura   = coberturaCxCCxP === null ? 60 : clamp((coberturaCxCCxP - 0.5) * 100, 0, 100);
    const pctVencidoCxC    = cxcTotal > 0 ? (parseFloat(cxc.vencido) / cxcTotal * 100) : 0;
    const scoreVencido     = clamp(100 - pctVencidoCxC * 2, 0, 100);
    const concentracionTop1 = topClienteVentas ? parseFloat(topClienteVentas.porcentaje) : 0;
    const scoreConcentracion = clamp(100 - concentracionTop1 * 2, 0, 100);
    const scoreDisciplina  = cxcDesviacion && cxcDesviacion.pct_extension !== null
      ? clamp(100 - parseFloat(cxcDesviacion.pct_extension) * 3, 0, 100) : 70;

    const healthScore = Math.round(
      scoreCrecimiento * 0.20 +
      scoreMargen      * 0.20 +
      scoreEbitda      * 0.15 +
      scoreCobertura   * 0.15 +
      scoreVencido     * 0.10 +
      scoreConcentracion * 0.10 +
      scoreDisciplina  * 0.10
    );
    const healthGrade = healthScore >= 80 ? 'excelente' :
                        healthScore >= 65 ? 'saludable' :
                        healthScore >= 50 ? 'atencion'  : 'critico';

    // ==============================================================
    // 12) INSIGHTS
    // ==============================================================
    const insights = [];

    if (deltaVentasPct !== null && deltaMargenPp !== null) {
      const buenaTend = deltaVentasPct >= 5 && deltaMargenPp >= 2;
      insights.push({
        tipo: buenaTend ? 'positivo' : (deltaVentasPct < -5 ? 'riesgo' : 'atencion'),
        titulo: `Ventas ${deltaVentasPct >= 0 ? '+' : ''}${deltaVentasPct.toFixed(1)}% vs 12m previo · margen ${deltaMargenPp >= 0 ? '+' : ''}${deltaMargenPp.toFixed(1)}pp`,
        detalle: `Facturación ${(ventas12m/1e6).toFixed(1)}M vs ${(ventas12mPrev/1e6).toFixed(1)}M el período anterior. Margen bruto real pasó de ${margenPrevPct.toFixed(1)}% a ${margenRealPct.toFixed(1)}%.`,
        link: '/ventas',
      });
    }

    if (concentracionCompras[0] && concentracionCompras[0].porcentaje >= 25) {
      insights.push({
        tipo: 'riesgo',
        titulo: `Concentración proveedor: ${concentracionCompras[0].proveedor}`,
        detalle: `Representa el ${concentracionCompras[0].porcentaje}% del gasto en compras (Q${(concentracionCompras[0].gasto/1e6).toFixed(1)}M). Buscar segunda fuente.`,
        link: '/compras',
      });
    }

    if (coberturaCxCCxP !== null && coberturaCxCCxP < 1) {
      insights.push({
        tipo: 'riesgo',
        titulo: 'CxP mayor que CxC',
        detalle: `Cobertura CxC/CxP: ${coberturaCxCCxP.toFixed(2)}x. Debés Q${((cxpTotal - cxcTotal)/1e6).toFixed(1)}M más de lo que te deben. Confirmar caja disponible.`,
        link: '/tesoreria',
      });
    }

    if (pctVencidoCxC >= 15) {
      insights.push({
        tipo: 'atencion',
        titulo: `${pctVencidoCxC.toFixed(1)}% de la cartera está vencida`,
        detalle: `Q${(parseFloat(cxc.vencido)/1e6).toFixed(1)}M en cobros atrasados sobre Q${(cxcTotal/1e6).toFixed(1)}M de cartera total.`,
        link: '/tesoreria/cuentas-por-cobrar',
      });
    }

    if (topClienteVentas && parseFloat(topClienteVentas.porcentaje) >= 15) {
      insights.push({
        tipo: 'riesgo',
        titulo: `Concentración cliente: ${topClienteVentas.cliente}`,
        detalle: `Representa el ${topClienteVentas.porcentaje}% de las ventas 12m (Q${(parseFloat(topClienteVentas.ventas)/1e6).toFixed(1)}M).`,
        link: '/ventas',
      });
    }

    if (topVendedor && parseFloat(topVendedor.porcentaje) >= 20) {
      const pct = parseFloat(topVendedor.porcentaje);
      const margenV = topVendedor.margen_pct !== null ? parseFloat(topVendedor.margen_pct) : null;
      insights.push({
        tipo: pct >= 40 ? 'atencion' : 'positivo',
        titulo: `Vendedor top: ${topVendedor.vendedor} (${pct}%)`,
        detalle: `${topVendedor.clientes} clientes, Q${(parseFloat(topVendedor.ventas)/1e6).toFixed(1)}M${margenV !== null ? `, margen ${margenV}%` : ''}. ${pct >= 40 ? 'Concentración: revisar sucesión.' : 'Performance destacado.'}`,
        link: '/ventas',
      });
    }

    if (proveedoresRiesgo && proveedoresRiesgo.length > 0) {
      const top = proveedoresRiesgo[0];
      const totalRiesgo = proveedoresRiesgo.reduce((s, r) => s + parseFloat(r.monto), 0);
      insights.push({
        tipo: 'riesgo',
        titulo: `${proveedoresRiesgo.length} proveedor(es) con saldo material sin condiciones de crédito`,
        detalle: `${top.proveedor} (Q${(parseFloat(top.monto)/1e6).toFixed(1)}M)${proveedoresRiesgo.length > 1 ? ` y ${proveedoresRiesgo.length - 1} más suman Q${(totalRiesgo/1e6).toFixed(1)}M` : ''}, todo vencido con ficha 0d. Probable L/C no registrado.`,
        link: '/tesoreria/cuentas-por-pagar',
      });
    }

    if (cxcDesviacion && parseInt(cxcDesviacion.total_facturas) > 0) {
      const pct = parseFloat(cxcDesviacion.pct_extension);
      if (pct >= 10) {
        insights.push({
          tipo: 'atencion',
          titulo: `${pct}% de facturas CxC dieron más plazo del acordado`,
          detalle: `${cxcDesviacion.facturas_extendidas} de ${cxcDesviacion.total_facturas} facturas (12m) con más días que la ficha. Revisar disciplina comercial.`,
          link: '/tesoreria/cuentas-por-cobrar',
        });
      }
    }

    if (parseInt(inventario.sin_precio) > 100) {
      const totalArt = parseInt(inventario.articulos) || 1;
      const pctSinPrecio = (parseInt(inventario.sin_precio) / totalArt * 100);
      if (pctSinPrecio > 30) {
        insights.push({
          tipo: 'atencion',
          titulo: `${pctSinPrecio.toFixed(0)}% de artículos sin precio_venta_1`,
          detalle: `${inventario.sin_precio} de ${totalArt} artículos no tienen precio de lista. Impacta análisis de margen y cotización.`,
          link: '/inventario',
        });
      }
    }

    // ==============================================================
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        empresa: 'Thermoplástica, S.A.',
        fecha_corte: new Date().toISOString().split('T')[0],
        health: {
          score: healthScore,
          grade: healthGrade,
          componentes: {
            crecimiento: Math.round(scoreCrecimiento),
            margen: Math.round(scoreMargen),
            ebitda: Math.round(scoreEbitda),
            cobertura: Math.round(scoreCobertura),
            cobros: Math.round(scoreVencido),
            concentracion: Math.round(scoreConcentracion),
            disciplina: Math.round(scoreDisciplina),
          },
        },
        kpis: {
          ventas_12m: ventas12m,
          ventas_12m_previo: ventas12mPrev,
          delta_ventas_pct: deltaVentasPct,
          costo_ventas_12m: costoVentas12m,
          margen_bruto_real_12m: margenReal12m,
          margen_bruto_previo_12m: margenPrev12m,
          margen_bruto_pct: margenRealPct,
          margen_bruto_pct_previo: margenPrevPct,
          delta_margen_pp: deltaMargenPp,
          facturas_12m: facturas12m,
          clientes_activos_12m: clientesAct12m,
          clientes_previo_12m: clientesPrev12m,
          compras_12m: compras12m,
          delta_compras_pct: deltaComprasPct,
          gastos_operativos_12m: gastos12m,
          delta_gastos_pct: deltaGastosPct,
          ebitda_estimado: ebitdaEstimado,
          ebitda_pct: ebitdaPct,
          cxc_total: cxcTotal,
          cxc_vencido: parseFloat(cxc.vencido) || 0,
          cxc_documentos: parseInt(cxc.documentos) || 0,
          cxp_total: cxpTotal,
          cxp_facturas: parseInt(cxp.facturas) || 0,
          cxp_proveedores: parseInt(cxp.proveedores) || 0,
          posicion_neta_wc: posicionNetaWC,
          cobertura_cxc_cxp: coberturaCxCCxP,
          tendencia_mes_pct: tendenciaMes,
          inventario_valor: valorInventario,
          inventario_articulos: parseInt(inventario.articulos) || 0,
          inventario_con_stock: parseInt(inventario.con_stock) || 0,
          dso, dpo, dio, ccc,
        },
        ventas_mensuales: serieYoY,
        cxc_aging: {
          total: cxcTotal,
          por_vencer: parseFloat(cxc.por_vencer) || 0,
          v_1_30:    parseFloat(cxc.v_1_30) || 0,
          v_31_60:   parseFloat(cxc.v_31_60) || 0,
          v_61_90:   parseFloat(cxc.v_61_90) || 0,
          v_90_mas:  parseFloat(cxc.v_90_mas) || 0,
        },
        cxp_aging: {
          total: cxpTotal,
          por_vencer: parseFloat(cxp.por_vencer) || 0,
          v_1_30:    parseFloat(cxp.v_1_30) || 0,
          v_31_60:   parseFloat(cxp.v_31_60) || 0,
          v_61_90:   parseFloat(cxp.v_61_90) || 0,
          v_90_mas:  parseFloat(cxp.v_90_mas) || 0,
        },
        top_clientes: topClientes.map(t => ({
          codigo: t.codigo, cliente: t.cliente,
          monto: parseFloat(t.monto) || 0,
          vencido: parseFloat(t.vencido) || 0,
          porcentaje: cxcTotal > 0 ? Math.round(parseFloat(t.monto) / cxcTotal * 1000) / 10 : 0,
        })),
        top_proveedores_cxp: topProveedores.map(t => ({
          codigo: t.codigo, proveedor: t.proveedor,
          facturas: parseInt(t.facturas) || 0,
          monto: parseFloat(t.monto) || 0,
          porcentaje: cxpTotal > 0 ? Math.round(parseFloat(t.monto) / cxpTotal * 1000) / 10 : 0,
          dias_credito: Math.round(parseFloat(t.dias_credito) || 0),
          facturas_vencidas: parseInt(t.facturas_vencidas) || 0,
        })),
        concentracion_compras: concentracionCompras.map(c => ({
          codigo: c.codigo, proveedor: c.proveedor,
          gasto: parseFloat(c.gasto) || 0,
          porcentaje: parseFloat(c.porcentaje) || 0,
        })),
        top_lineas: topLineas.map(l => ({
          linea: l.linea,
          ventas: parseFloat(l.ventas) || 0,
          margen: parseFloat(l.margen) || 0,
          margen_pct: parseFloat(l.margen_pct) || 0,
          porcentaje: parseFloat(l.porcentaje) || 0,
        })),
        cxc_criticas: cxcCriticas.map(c => ({
          cliente: c.cliente,
          documento: `${c.tipo_documento} ${c.documento}`,
          fecha_vencimiento: c.fecha_vencimiento,
          dias_atraso: parseInt(c.dias_atraso) || 0,
          saldo: parseFloat(c.saldo_total) || 0,
        })),
        insights,
      },
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
