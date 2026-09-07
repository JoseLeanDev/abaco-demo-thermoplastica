const express = require('express');
const router = express.Router();
const db = require('../../database/connection');

// GET /api/dashboard
// Executive briefing: números north-star + serie de ventas + concentraciones + acciones.
router.get('/', async (req, res) => {
  try {
    // ---------- Ventas mensuales (últ 12 meses completos + mes en curso) ----------
    const ventasMensuales = await db.allAsync(`
      SELECT anio, mes,
             COALESCE(SUM(monto), 0)    AS ventas,
             COALESCE(SUM(unidades), 0) AS unidades
      FROM thermoplastica.fact_ventas_mensuales
      WHERE (anio * 100 + mes) >= (EXTRACT(YEAR FROM CURRENT_DATE)::int - 1) * 100 + EXTRACT(MONTH FROM CURRENT_DATE)::int
      GROUP BY anio, mes
      ORDER BY anio, mes
    `);

    // ---------- KPIs financieros ----------
    // Ventas rolling 12 meses (excluye mes en curso incompleto)
    const ventasKpi = await db.getAsync(`
      WITH periodo_actual AS (
        SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS y, EXTRACT(MONTH FROM CURRENT_DATE)::int AS m
      )
      SELECT COALESCE(SUM(monto), 0) AS ventas_12m
      FROM thermoplastica.fact_ventas_mensuales, periodo_actual
      WHERE (anio * 100 + mes) BETWEEN
              ((y - 1) * 100 + m)     -- 12 meses atrás
          AND (y * 100 + (m - 1))     -- mes anterior
    `);

    // Compras materia prima últ 12 meses
    const comprasKpi = await db.getAsync(`
      SELECT COALESCE(SUM(f.total_sin_iva), 0) AS compras_12m
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
        AND COALESCE(a.es_gasto_operativo, FALSE) = FALSE
    `);

    // Gastos operativos últ 12 meses
    const gastosKpi = await db.getAsync(`
      SELECT COALESCE(SUM(f.total_sin_iva), 0) AS gastos_12m
      FROM thermoplastica.fact_compras_linea f
      JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
      WHERE f.fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
        AND COALESCE(a.es_gasto_operativo, FALSE) = TRUE
    `);

    // ---------- CxC snapshot vivo ----------
    const cxc = await db.getAsync(`
      SELECT COALESCE(SUM(saldo_total), 0) AS total,
             COALESCE(SUM(vencido), 0)     AS vencido,
             COUNT(*)                      AS documentos
      FROM thermoplastica.fact_cxc_snapshot_diario
      WHERE fecha_snapshot = (SELECT MAX(fecha_snapshot) FROM thermoplastica.fact_cxc_snapshot_diario)
    `);

    // Top 5 clientes por CxC
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

    // ---------- CxP proxy ----------
    const cxp = await db.getAsync(`
      WITH facturas AS (
        SELECT proveedor_id, MAX(saldo) AS saldo
        FROM thermoplastica.fact_compras_linea
        GROUP BY fact_num, proveedor_id
      )
      SELECT COALESCE(SUM(saldo), 0)          AS total,
             COUNT(*)                         AS facturas,
             COUNT(DISTINCT proveedor_id)     AS proveedores
      FROM facturas WHERE saldo > 0
    `);

    // Top 5 proveedores por CxP
    const topProveedores = await db.allAsync(`
      WITH facturas AS (
        SELECT proveedor_id, fact_num, MAX(saldo) AS saldo
        FROM thermoplastica.fact_compras_linea
        GROUP BY proveedor_id, fact_num
      )
      SELECT p.codigo_proveedor AS codigo, p.nombre AS proveedor,
             COUNT(*)                  AS facturas,
             COALESCE(SUM(saldo), 0)   AS monto
      FROM facturas f
      JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
      WHERE f.saldo > 0
      GROUP BY p.codigo_proveedor, p.nombre
      ORDER BY monto DESC
      LIMIT 5
    `);

    // Concentración de compras (top proveedor por gasto 12m)
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

    // Facturas críticamente vencidas (CxC vencido > 60 días)
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

    // ---------- Derivados ----------
    const ventas12m  = parseFloat(ventasKpi.ventas_12m) || 0;
    const compras12m = parseFloat(comprasKpi.compras_12m) || 0;
    const gastos12m  = parseFloat(gastosKpi.gastos_12m) || 0;
    const cxcTotal   = parseFloat(cxc.total) || 0;
    const cxpTotal   = parseFloat(cxp.total) || 0;
    const margenBrutoMP = ventas12m - compras12m;  // margen bruto sobre materia prima
    const margenMPct = ventas12m > 0 ? (margenBrutoMP / ventas12m * 100) : null;
    const ebitdaEstimado = ventas12m - compras12m - gastos12m;
    const ebitdaPct = ventas12m > 0 ? (ebitdaEstimado / ventas12m * 100) : null;
    const posicionNetaWC = cxcTotal - cxpTotal;
    const coberturaCxCCxP = cxpTotal > 0 ? cxcTotal / cxpTotal : null;

    // Tendencia: mes anterior vs promedio 12m previos
    const mesAnterior = ventasMensuales.length >= 2 ? parseFloat(ventasMensuales[ventasMensuales.length - 2].ventas) : 0;
    const promedioPrevios = ventasMensuales.length >= 3
      ? ventasMensuales.slice(0, -2).reduce((s, r) => s + parseFloat(r.ventas), 0) / (ventasMensuales.length - 2)
      : 0;
    const tendenciaMes = promedioPrevios > 0 ? ((mesAnterior - promedioPrevios) / promedioPrevios * 100) : null;

    // ---------- Insights automáticos ----------
    const insights = [];

    if (concentracionCompras[0] && concentracionCompras[0].porcentaje >= 25) {
      insights.push({
        tipo: 'riesgo',
        titulo: `Concentración de proveedor: ${concentracionCompras[0].proveedor}`,
        detalle: `Representa el ${concentracionCompras[0].porcentaje}% del gasto en compras (Q${Math.round(concentracionCompras[0].gasto / 1e6 * 10) / 10}M). Un problema con este proveedor te expone. Buscar segunda fuente.`,
        link: '/compras',
      });
    }

    if (coberturaCxCCxP !== null && coberturaCxCCxP < 1) {
      insights.push({
        tipo: 'riesgo',
        titulo: 'CxP mayor que CxC',
        detalle: `Cobertura CxC/CxP: ${coberturaCxCCxP.toFixed(2)}x. Debés a proveedores Q${Math.round((cxpTotal - cxcTotal) / 1e6 * 10) / 10}M más de lo que te deben clientes. Confirmar caja disponible.`,
        link: '/tesoreria',
      });
    }

    if (cxc.vencido > 0 && cxcTotal > 0) {
      const pctVencido = (parseFloat(cxc.vencido) / cxcTotal) * 100;
      if (pctVencido >= 15) {
        insights.push({
          tipo: 'atencion',
          titulo: `${pctVencido.toFixed(1)}% de la cartera está vencida`,
          detalle: `Q${Math.round(cxc.vencido / 1e6 * 10) / 10}M en cobros atrasados. Priorizar cobranza.`,
          link: '/tesoreria/cxc',
        });
      }
    }

    if (tendenciaMes !== null && Math.abs(tendenciaMes) >= 10) {
      insights.push({
        tipo: tendenciaMes >= 0 ? 'positivo' : 'atencion',
        titulo: `Ventas mes anterior ${tendenciaMes >= 0 ? '+' : ''}${tendenciaMes.toFixed(1)}% vs promedio 12m`,
        detalle: `El mes cerrado facturó Q${Math.round(mesAnterior / 1e6 * 10) / 10}M vs un promedio previo de Q${Math.round(promedioPrevios / 1e6 * 10) / 10}M.`,
        link: '/compras',
      });
    }

    if (margenMPct !== null) {
      insights.push({
        tipo: margenMPct >= 30 ? 'positivo' : 'atencion',
        titulo: `Margen bruto sobre materia prima: ${margenMPct.toFixed(1)}%`,
        detalle: `Ventas Q${(ventas12m / 1e6).toFixed(1)}M − compras materia prima Q${(compras12m / 1e6).toFixed(1)}M = Q${(margenBrutoMP / 1e6).toFixed(1)}M. Sin descontar gastos operativos ni mano de obra.`,
        link: '/margenes',
      });
    }

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        empresa: 'Thermoplástica, S.A.',
        fecha_corte: new Date().toISOString().split('T')[0],
        kpis: {
          ventas_12m: ventas12m,
          compras_12m: compras12m,
          gastos_operativos_12m: gastos12m,
          margen_bruto_materia_prima: margenBrutoMP,
          margen_bruto_pct: margenMPct,
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
        },
        ventas_mensuales: ventasMensuales.map(r => ({
          anio: r.anio, mes: r.mes,
          ventas: parseFloat(r.ventas) || 0,
          unidades: parseFloat(r.unidades) || 0,
          periodo: `${r.anio}-${String(r.mes).padStart(2, '0')}`,
        })),
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
        })),
        concentracion_compras: concentracionCompras.map(c => ({
          codigo: c.codigo, proveedor: c.proveedor,
          gasto: parseFloat(c.gasto) || 0,
          porcentaje: parseFloat(c.porcentaje) || 0,
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
