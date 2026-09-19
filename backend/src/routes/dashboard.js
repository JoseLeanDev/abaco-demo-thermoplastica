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
    // Ventas rolling 12 meses desde ventas al detalle (fuente REAL, línea a línea)
    const ventasKpi = await db.getAsync(`
      SELECT COALESCE(SUM(total_sin_iva), 0)          AS ventas_12m,
             COALESCE(SUM(costo_total_facturado), 0)  AS costo_ventas_12m,
             COALESCE(SUM(margen_bruto), 0)           AS margen_bruto_real_12m,
             COUNT(DISTINCT fact_num)                 AS facturas_12m,
             COUNT(DISTINCT cliente_id)               AS clientes_activos_12m
      FROM thermoplastica.fact_ventas_linea
      WHERE fecha_emision >= CURRENT_DATE - INTERVAL '12 months'
        AND tipo_doc = 'FACT'
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

    // ---------- CxP real (desde fact_cxp_factura con fecha_vencimiento del ERP) ----------
    const cxp = await db.getAsync(`
      SELECT COALESCE(SUM(saldo), 0)                                                  AS total,
             COUNT(*)                                                                 AS facturas,
             COUNT(DISTINCT proveedor_id)                                             AS proveedores,
             COALESCE(SUM(saldo) FILTER (WHERE fecha_vencimiento < CURRENT_DATE), 0)  AS vencido
      FROM thermoplastica.fact_cxp_factura WHERE saldo > 0
    `);

    // Top 5 proveedores por CxP con dias_credito y facturas vencidas
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
    // (típico de importadores con L/C o dispute pendiente)
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

    // CxC: clientes con plazos otorgados mayores al pactado (dias_segun_facturas > dias_credito_ficha)
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

    // Top cliente + top vendedor por ventas 12m (para insights)
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

    // ---------- Derivados ----------
    const ventas12m       = parseFloat(ventasKpi.ventas_12m) || 0;
    const costoVentas12m  = parseFloat(ventasKpi.costo_ventas_12m) || 0;
    const margenRealVentas = parseFloat(ventasKpi.margen_bruto_real_12m) || 0;
    const margenRealPct   = ventas12m > 0 ? (margenRealVentas / ventas12m * 100) : null;
    const compras12m = parseFloat(comprasKpi.compras_12m) || 0;
    const gastos12m  = parseFloat(gastosKpi.gastos_12m) || 0;
    const cxcTotal   = parseFloat(cxc.total) || 0;
    const cxpTotal   = parseFloat(cxp.total) || 0;
    // Margen bruto ahora es el REAL (ventas - COGS al costo promedio facturado)
    const margenBrutoMP = margenRealVentas;
    const margenMPct = margenRealPct;
    const ebitdaEstimado = margenRealVentas - gastos12m;  // margen bruto real menos gastos operativos
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
          link: '/tesoreria/cuentas-por-cobrar',
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
        titulo: `Margen bruto real (ventas): ${margenMPct.toFixed(1)}%`,
        detalle: `Ventas Q${(ventas12m / 1e6).toFixed(1)}M − COGS Q${(costoVentas12m / 1e6).toFixed(1)}M = Q${(margenRealVentas / 1e6).toFixed(1)}M. Costo tomado del costo_promedio_facturado del ERP en cada línea de venta.`,
        link: '/ventas',
      });
    }

    // Concentración de cliente en ventas (top 1 >= 15% del total)
    if (topClienteVentas && parseFloat(topClienteVentas.porcentaje) >= 15) {
      insights.push({
        tipo: 'riesgo',
        titulo: `Concentración de cliente: ${topClienteVentas.cliente}`,
        detalle: `Representa el ${topClienteVentas.porcentaje}% de las ventas de los últimos 12m (Q${(parseFloat(topClienteVentas.ventas) / 1e6).toFixed(1)}M). Un problema con este cliente afecta un porcentaje material de la facturación.`,
        link: '/ventas',
      });
    }

    // Vendedor estrella (>= 20% del total con margen sano)
    if (topVendedor && parseFloat(topVendedor.porcentaje) >= 20) {
      const pct = parseFloat(topVendedor.porcentaje);
      const margenV = topVendedor.margen_pct !== null ? parseFloat(topVendedor.margen_pct) : null;
      insights.push({
        tipo: pct >= 40 ? 'atencion' : 'positivo',
        titulo: `Vendedor top: ${topVendedor.vendedor} (${pct}% del total)`,
        detalle: `${topVendedor.clientes} clientes, Q${(parseFloat(topVendedor.ventas) / 1e6).toFixed(1)}M facturados${margenV !== null ? `, margen ${margenV}%` : ''}. ${pct >= 40 ? 'Concentración alta: revisar plan de sucesión / distribución de cartera.' : 'Performance destacado del equipo comercial.'}`,
        link: '/ventas',
      });
    }

    // Proveedores importadores con 100% vencido y crédito ficha 0 — típico dispute o L/C sin registrar
    if (proveedoresRiesgo && proveedoresRiesgo.length > 0) {
      const top = proveedoresRiesgo[0];
      const totalRiesgo = proveedoresRiesgo.reduce((s, r) => s + parseFloat(r.monto), 0);
      insights.push({
        tipo: 'riesgo',
        titulo: `${proveedoresRiesgo.length} proveedor(es) con saldo pendiente sin condiciones de crédito`,
        detalle: `${top.proveedor} (Q${(parseFloat(top.monto) / 1e6).toFixed(1)}M) y ${proveedoresRiesgo.length - 1} más suman Q${(totalRiesgo / 1e6).toFixed(1)}M todos vencidos con ficha en 0 días de crédito. Probable disputa o pago por L/C no registrado en el ERP. Confirmar con contabilidad.`,
        link: '/tesoreria/cuentas-por-pagar',
      });
    }

    // CxC: disciplina de crédito — % de facturas dadas por encima del plazo pactado
    if (cxcDesviacion && parseInt(cxcDesviacion.total_facturas) > 0) {
      const pct = parseFloat(cxcDesviacion.pct_extension);
      if (pct >= 10) {
        insights.push({
          tipo: 'atencion',
          titulo: `${pct}% de las facturas CxC dieron más plazo del acordado`,
          detalle: `${cxcDesviacion.facturas_extendidas} de ${cxcDesviacion.total_facturas} facturas (últimos 12m) otorgaron más días de crédito de los pactados en la ficha del cliente. Revisar disciplina comercial.`,
          link: '/tesoreria/cuentas-por-cobrar',
        });
      } else if (pct > 0 && pct < 8) {
        insights.push({
          tipo: 'positivo',
          titulo: `Disciplina de crédito CxC: solo ${pct}% de facturas por encima del contrato`,
          detalle: `${cxcDesviacion.facturas_extendidas} de ${cxcDesviacion.total_facturas} facturas dieron plazo mayor al pactado. Muy sano.`,
          link: '/tesoreria/cuentas-por-cobrar',
        });
      }
    }

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        empresa: 'Thermoplástica, S.A.',
        fecha_corte: new Date().toISOString().split('T')[0],
        kpis: {
          ventas_12m: ventas12m,
          costo_ventas_12m: costoVentas12m,
          margen_bruto_real_12m: margenRealVentas,
          facturas_12m: parseInt(ventasKpi.facturas_12m) || 0,
          clientes_activos_12m: parseInt(ventasKpi.clientes_activos_12m) || 0,
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
          dias_credito: Math.round(parseFloat(t.dias_credito) || 0),
          facturas_vencidas: parseInt(t.facturas_vencidas) || 0,
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
