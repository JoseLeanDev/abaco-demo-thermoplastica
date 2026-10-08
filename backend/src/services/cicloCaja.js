// Ciclo de conversión de efectivo con la ventana del filtro global.
// Única fuente para Salud financiera (/api/analisis/salud) y el Panel (/api/dashboard),
// para que ambos muestren los mismos días.
const M = require('./margen');

// Ciclo de caja con la ventana del filtro global. Replica analitica.v_ciclo_caja
// (migración 015) pero con flujos del período [desde, hasta] diarizados por sus
// días reales en vez de 365 fijos. Los saldos (CxC, CxP, inventario) son al corte
// de hoy: el ciclo compara saldos actuales contra el ritmo de flujo del período.
async function cicloPeriodo(db, P) {
  return db.getAsync(`
    WITH ventas AS (
      SELECT sum(total_sin_iva) AS sin_iva, sum(total_con_iva) AS con_iva, ${M.costo()} AS costo,
             max(fecha_emision) AS fecha_corte
      FROM thermoplastica.fact_ventas_linea
      WHERE tipo_doc = 'FACT' AND fecha_emision BETWEEN ${P.D} AND ${P.H}
    ),
    compras AS (
      SELECT sum(total_con_iva) AS con_iva
      FROM thermoplastica.fact_compras_linea
      WHERE tipo_doc = 'FACT' AND NOT coalesce(es_outlier_fecha, false)
        AND fecha_emision BETWEEN ${P.D} AND ${P.H}
    ),
    cxc AS (
      SELECT coalesce(sum(saldo) FILTER (WHERE fecha_vencimiento >= CURRENT_DATE - 90), 0) AS operativa,
             coalesce(sum(saldo) FILTER (WHERE fecha_vencimiento <  CURRENT_DATE - 90), 0) AS dudosa
      FROM thermoplastica.fact_cxc_factura WHERE saldo > 0
    ),
    cxp AS (
      SELECT coalesce(sum(saldo) FILTER (WHERE fecha_vencimiento >= CURRENT_DATE - 90), 0) AS operativa,
             coalesce(sum(saldo) FILTER (WHERE fecha_vencimiento <  CURRENT_DATE - 90), 0) AS por_depurar,
             count(*)            FILTER (WHERE fecha_vencimiento <  CURRENT_DATE - 90)       AS facturas_por_depurar
      FROM thermoplastica.fact_cxp_factura WHERE saldo > 0
    ),
    inv AS (
      SELECT coalesce(sum(valor_inventario), 0) AS valor
      FROM thermoplastica.fact_inventario_snapshot
      WHERE stock_actual > 0
        AND fecha_snapshot = (SELECT max(fecha_snapshot) FROM thermoplastica.fact_inventario_snapshot)
    ),
    cobro_real AS (
      SELECT sum((fecha_ultimo_cobro - fecha_emision) * valor) / nullif(sum(valor), 0) AS dias
      FROM thermoplastica.fact_cxc_factura
      WHERE saldo <= 0 AND fecha_ultimo_cobro >= fecha_emision
        AND fecha_ultimo_cobro BETWEEN ${P.D} AND ${P.H}
    ),
    pago_real AS (
      SELECT sum((fecha_ultimo_pago - fecha_emision) * valor) / nullif(sum(valor), 0) AS dias
      FROM thermoplastica.fact_cxp_factura
      WHERE saldo <= 0 AND fecha_ultimo_pago >= fecha_emision
        AND fecha_ultimo_pago BETWEEN ${P.D} AND ${P.H}
    ),
    base AS (
      SELECT ventas.fecha_corte,
             ventas.sin_iva AS ventas_periodo, ventas.con_iva AS ventas_periodo_con_iva, ventas.costo AS costo_ventas_periodo,
             compras.con_iva AS compras_periodo_con_iva,
             cxc.operativa AS cxc_operativa, cxc.dudosa AS cxc_dudosa,
             inv.valor AS inventario,
             cxp.operativa AS cxp_operativa, cxp.por_depurar AS cxp_por_depurar, cxp.facturas_por_depurar,
             ventas.con_iva  / ${P.dias}.0 AS valor_dia_cobro,
             ventas.costo    / ${P.dias}.0 AS valor_dia_inventario,
             compras.con_iva / ${P.dias}.0 AS valor_dia_pago,
             cobro_real.dias AS dias_cobro_real,
             pago_real.dias  AS dias_pago_real
      FROM ventas, compras, cxc, cxp, inv, cobro_real, pago_real
    )
    SELECT
      fecha_corte,
      round(cxc_operativa / nullif(valor_dia_cobro, 0), 1)      AS dso,
      round(inventario    / nullif(valor_dia_inventario, 0), 1) AS dio,
      round(cxp_operativa / nullif(valor_dia_pago, 0), 1)       AS dpo,
      round(cxc_operativa / nullif(valor_dia_cobro, 0)
          + inventario    / nullif(valor_dia_inventario, 0)
          - cxp_operativa / nullif(valor_dia_pago, 0), 1)       AS ciclo_caja,
      round(dias_cobro_real, 1) AS dias_cobro_real,
      round(dias_pago_real, 1)  AS dias_pago_real,
      round(valor_dia_cobro)      AS valor_dia_cobro,
      round(valor_dia_inventario) AS valor_dia_inventario,
      round(valor_dia_pago)       AS valor_dia_pago,
      round(ventas_periodo) AS ventas_periodo, round(ventas_periodo_con_iva) AS ventas_periodo_con_iva,
      round(costo_ventas_periodo) AS costo_ventas_periodo, round(compras_periodo_con_iva) AS compras_periodo_con_iva,
      round(cxc_operativa) AS cxc_operativa, round(cxc_dudosa) AS cxc_dudosa,
      round(inventario) AS inventario,
      round(cxp_operativa) AS cxp_operativa, round(cxp_por_depurar) AS cxp_por_depurar, facturas_por_depurar
    FROM base
  `);
}

module.exports = { cicloPeriodo };
