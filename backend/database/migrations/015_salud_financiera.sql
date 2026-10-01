-- ============================================================================
-- 015_salud_financiera.sql
--
-- Métricas financieras cruzadas para la página de Análisis ("Salud financiera")
-- y para el analista diario. Viven como vistas en analitica para que la página,
-- el playbook "salud" y el chat lean EXACTAMENTE los mismos números.
--
--   v_ciclo_caja          una fila: DSO, DIO, DPO, ciclo de conversión de efectivo
--   v_ciclo_caja_mensual  días reales de cobro y pago, mes a mes (tendencia)
--   v_inventario_salud    inventario por artículo clasificado (materia prima /
--                         producto) y con estado (activo / lento / inmovilizado)
--   v_capital_trabajo     una fila: capital de trabajo operativo y la caja que
--                         consume el crecimiento
--
-- Reglas de negocio que se fijan aquí:
--   - Ventana: 365 días hasta la última venta registrada (no CURRENT_DATE), para
--     que el rezago de carga no infle los días.
--   - CxC vencida a más de 90 días = "dudosa"; CxP vencida a más de 90 días =
--     "por depurar" (facturas sin cerrar en el ERP). Ninguna entra al ciclo.
--   - Materia prima = artículo que se compra y nunca se ha vendido. Producto =
--     artículo con ventas. Sin movimiento = ni compras ni ventas registradas.
--
-- Además siembra el playbook "salud" del analista diario.
-- Idempotente. No modifica datos del ERP.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- v_ciclo_caja
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_capital_trabajo CASCADE;
DROP VIEW IF EXISTS analitica.v_ciclo_caja CASCADE;
CREATE VIEW analitica.v_ciclo_caja AS
WITH corte AS (
  SELECT max(fecha_emision) AS f FROM thermoplastica.fact_ventas_linea WHERE tipo_doc = 'FACT'
),
ventas AS (
  SELECT sum(v.total_sin_iva) AS sin_iva, sum(v.total_con_iva) AS con_iva,
         sum(v.costo_total_facturado) AS costo
  FROM thermoplastica.fact_ventas_linea v, corte
  WHERE v.tipo_doc = 'FACT' AND v.fecha_emision > corte.f - 365 AND v.fecha_emision <= corte.f
),
compras AS (
  SELECT sum(c.total_con_iva) AS con_iva
  FROM thermoplastica.fact_compras_linea c, corte
  WHERE c.tipo_doc = 'FACT' AND NOT coalesce(c.es_outlier_fecha, false)
    AND c.fecha_emision > corte.f - 365 AND c.fecha_emision <= corte.f
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
  FROM thermoplastica.fact_cxc_factura, corte
  WHERE saldo <= 0 AND fecha_ultimo_cobro >= fecha_emision AND fecha_ultimo_cobro > corte.f - 365
),
pago_real AS (
  SELECT sum((fecha_ultimo_pago - fecha_emision) * valor) / nullif(sum(valor), 0) AS dias
  FROM thermoplastica.fact_cxp_factura, corte
  WHERE saldo <= 0 AND fecha_ultimo_pago >= fecha_emision AND fecha_ultimo_pago > corte.f - 365
),
base AS (
  SELECT corte.f AS fecha_corte,
         ventas.sin_iva AS ventas_12m, ventas.con_iva AS ventas_12m_con_iva, ventas.costo AS costo_ventas_12m,
         compras.con_iva AS compras_12m_con_iva,
         cxc.operativa AS cxc_operativa, cxc.dudosa AS cxc_dudosa,
         inv.valor AS inventario,
         cxp.operativa AS cxp_operativa, cxp.por_depurar AS cxp_por_depurar, cxp.facturas_por_depurar,
         ventas.con_iva / 365.0 AS valor_dia_cobro,
         ventas.costo   / 365.0 AS valor_dia_inventario,
         compras.con_iva / 365.0 AS valor_dia_pago,
         cobro_real.dias AS dias_cobro_real,
         pago_real.dias  AS dias_pago_real
  FROM corte, ventas, compras, cxc, cxp, inv, cobro_real, pago_real
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
  round(ventas_12m) AS ventas_12m, round(ventas_12m_con_iva) AS ventas_12m_con_iva,
  round(costo_ventas_12m) AS costo_ventas_12m, round(compras_12m_con_iva) AS compras_12m_con_iva,
  round(cxc_operativa) AS cxc_operativa, round(cxc_dudosa) AS cxc_dudosa,
  round(inventario) AS inventario,
  round(cxp_operativa) AS cxp_operativa, round(cxp_por_depurar) AS cxp_por_depurar, facturas_por_depurar
FROM base;

COMMENT ON VIEW analitica.v_ciclo_caja IS
'Ciclo de conversion de efectivo (CCC). UNA fila. Ventana: 365 dias hasta fecha_corte
(ultima venta registrada). Montos GTQ.
- dso = dias de cobro = cxc_operativa / (ventas con IVA / 365).
- dio = dias de inventario = inventario / (costo de ventas / 365).
- dpo = dias de pago = cxp_operativa / (compras con IVA / 365).
- ciclo_caja = dso + dio - dpo: dias que el efectivo queda atrapado en la operacion.
- dias_cobro_real / dias_pago_real = dias reales ponderados por monto de las facturas
  ya cobradas/pagadas en los ultimos 12 meses (comportamiento, no saldo).
- valor_dia_* = cuanto efectivo libera 1 dia menos de cobro/inventario (o 1 dia mas de pago).
- cxc_dudosa = CxC vencida a mas de 90 dias; NO entra al ciclo.
- cxp_por_depurar = CxP vencida a mas de 90 dias, casi seguro facturas sin cerrar en
  el ERP; NO entra al ciclo ni a proyecciones. No la presentes como deuda real.';

-- ---------------------------------------------------------------------------
-- v_ciclo_caja_mensual  —  tendencia de dias reales de cobro y pago
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_ciclo_caja_mensual CASCADE;
CREATE VIEW analitica.v_ciclo_caja_mensual AS
WITH cobros AS (
  SELECT to_char(fecha_ultimo_cobro, 'YYYY-MM') AS anio_mes,
         sum((fecha_ultimo_cobro - fecha_emision) * valor) / nullif(sum(valor), 0) AS dias,
         sum(valor) AS monto
  FROM thermoplastica.fact_cxc_factura
  WHERE saldo <= 0 AND fecha_ultimo_cobro >= fecha_emision
    AND fecha_ultimo_cobro >= date_trunc('month', CURRENT_DATE) - interval '12 months'
    AND fecha_ultimo_cobro <= CURRENT_DATE
  GROUP BY 1
),
pagos AS (
  SELECT to_char(fecha_ultimo_pago, 'YYYY-MM') AS anio_mes,
         sum((fecha_ultimo_pago - fecha_emision) * valor) / nullif(sum(valor), 0) AS dias,
         sum(valor) AS monto
  FROM thermoplastica.fact_cxp_factura
  WHERE saldo <= 0 AND fecha_ultimo_pago >= fecha_emision
    AND fecha_ultimo_pago >= date_trunc('month', CURRENT_DATE) - interval '12 months'
    AND fecha_ultimo_pago <= CURRENT_DATE
  GROUP BY 1
)
SELECT coalesce(c.anio_mes, p.anio_mes) AS anio_mes,
       round(c.dias, 1) AS dias_cobro_real, round(c.monto) AS monto_cobrado,
       round(p.dias, 1) AS dias_pago_real,  round(p.monto) AS monto_pagado,
       round(c.dias - p.dias, 1) AS brecha_dias
FROM cobros c FULL JOIN pagos p ON p.anio_mes = c.anio_mes
ORDER BY 1;

COMMENT ON VIEW analitica.v_ciclo_caja_mensual IS
'Tendencia mensual (ultimos 12 meses) de los dias REALES que tarda en cobrarse y pagarse
una factura, ponderados por monto. El mes es el mes en que se cobro/pago.
brecha_dias = dias_cobro_real - dias_pago_real: cuantos dias financia Thermoplastica a
sus clientes por encima de lo que le financian sus proveedores. Si sube, empeora.';

-- ---------------------------------------------------------------------------
-- v_inventario_salud  —  inventario clasificado y con estado
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_inventario_salud CASCADE;
CREATE VIEW analitica.v_inventario_salud AS
WITH snap AS (
  SELECT s.*
  FROM thermoplastica.fact_inventario_snapshot s
  WHERE s.stock_actual > 0
    AND s.fecha_snapshot = (SELECT max(fecha_snapshot) FROM thermoplastica.fact_inventario_snapshot)
),
ventas AS (
  SELECT articulo_id,
         max(fecha_emision) AS ultima_venta,
         sum(costo_total_facturado) FILTER (WHERE fecha_emision > CURRENT_DATE - 180) AS costo_vendido_180d
  FROM thermoplastica.fact_ventas_linea WHERE tipo_doc = 'FACT'
  GROUP BY articulo_id
),
ventas_mes AS (
  SELECT articulo_id,
         max((make_date(anio, mes, 1) + interval '1 month - 1 day')::date) AS ultima_venta
  FROM thermoplastica.fact_ventas_mensuales WHERE monto > 0
  GROUP BY articulo_id
),
compras AS (
  SELECT articulo_id,
         max(fecha_emision) AS ultima_compra,
         sum(total_sin_iva) FILTER (WHERE fecha_emision > CURRENT_DATE - 365) AS compras_365d
  FROM thermoplastica.fact_compras_linea
  WHERE tipo_doc = 'FACT' AND NOT coalesce(es_outlier_fecha, false) AND fecha_emision <= CURRENT_DATE
  GROUP BY articulo_id
),
x AS (
  SELECT s.articulo_id, a.codigo_articulo, a.descripcion AS articulo, a.linea, a.categoria,
         s.stock_actual, s.valor_inventario,
         greatest(v.ultima_venta, vm.ultima_venta) AS ultima_venta,
         c.ultima_compra,
         CASE
           WHEN v.ultima_venta IS NOT NULL OR vm.ultima_venta IS NOT NULL THEN 'producto'
           WHEN c.ultima_compra IS NOT NULL THEN 'materia_prima'
           ELSE 'sin_movimiento'
         END AS clase,
         -- Consumo diario a costo: lo vendido (producto) o lo que se recompra (materia prima)
         CASE
           WHEN v.ultima_venta IS NOT NULL OR vm.ultima_venta IS NOT NULL THEN coalesce(v.costo_vendido_180d, 0) / 180.0
           ELSE coalesce(c.compras_365d, 0) / 365.0
         END AS consumo_diario
  FROM snap s
  JOIN thermoplastica.dim_articulo a ON a.articulo_id = s.articulo_id
  LEFT JOIN ventas v      ON v.articulo_id  = s.articulo_id
  LEFT JOIN ventas_mes vm ON vm.articulo_id = s.articulo_id
  LEFT JOIN compras c     ON c.articulo_id  = s.articulo_id
)
SELECT articulo_id, codigo_articulo, articulo, linea, categoria, clase,
       stock_actual, round(valor_inventario, 2) AS valor_inventario,
       ultima_venta, ultima_compra,
       CURRENT_DATE - ultima_venta  AS dias_sin_venta,
       CURRENT_DATE - ultima_compra AS dias_sin_compra,
       round(valor_inventario / nullif(consumo_diario, 0)) AS dias_cobertura,
       CASE
         WHEN clase = 'sin_movimiento' THEN 'inmovilizado'
         WHEN clase = 'producto'      AND (ultima_venta  IS NULL OR ultima_venta  < CURRENT_DATE - 180) THEN 'inmovilizado'
         WHEN clase = 'materia_prima' AND (ultima_compra IS NULL OR ultima_compra < CURRENT_DATE - 365) THEN 'inmovilizado'
         WHEN consumo_diario <= 0 OR valor_inventario / consumo_diario > 180 THEN 'lento'
         ELSE 'activo'
       END AS estado
FROM x;

COMMENT ON VIEW analitica.v_inventario_salud IS
'Inventario actual por articulo, clasificado y con estado de rotacion. Grano: un articulo
con stock > 0. Montos GTQ a costo.
- clase: producto (tiene ventas registradas), materia_prima (se compra pero nunca se ha
  vendido: insumo de fabricacion), sin_movimiento (ni compras ni ventas registradas).
- dias_cobertura = valor_inventario / consumo diario (costo vendido 180d para producto;
  compras 365d para materia prima, como aproximacion del consumo).
- estado:
    inmovilizado: producto sin venta en 180 dias, materia prima sin recompra en 365 dias,
                  o sin movimiento. Es capital muerto.
    lento:        cobertura mayor a 180 dias.
    activo:       el resto.
Para "capital inmovilizado" sumar valor_inventario where estado = ''inmovilizado''.';

-- ---------------------------------------------------------------------------
-- v_capital_trabajo  —  capital de trabajo operativo y caja que pide el crecimiento
-- ---------------------------------------------------------------------------
CREATE VIEW analitica.v_capital_trabajo AS
WITH meses AS (
  SELECT make_date(anio, mes, 1) AS mes, sum(monto) AS ventas
  FROM thermoplastica.fact_ventas_mensuales GROUP BY 1
),
ultimo AS (
  -- Último mes COMPLETO: el mes de corte cuenta solo si la última venta es fin de mes.
  SELECT CASE
           WHEN (fecha_corte + 1)::date = date_trunc('month', fecha_corte + 1)::date
             THEN date_trunc('month', fecha_corte)::date
           ELSE (date_trunc('month', fecha_corte) - interval '1 month')::date
         END AS mes
  FROM analitica.v_ciclo_caja
),
t AS (
  SELECT
    (SELECT sum(ventas) FROM meses, ultimo WHERE meses.mes >  ultimo.mes - interval '12 months' AND meses.mes <= ultimo.mes) AS t12,
    (SELECT sum(ventas) FROM meses, ultimo WHERE meses.mes >  ultimo.mes - interval '24 months' AND meses.mes <= ultimo.mes - interval '12 months') AS t12_prev,
    (SELECT to_char(mes, 'YYYY-MM') FROM ultimo) AS ultimo_mes_completo
)
SELECT
  c.fecha_corte, t.ultimo_mes_completo,
  c.cxc_operativa, c.inventario, c.cxp_operativa,
  c.cxc_operativa + c.inventario - c.cxp_operativa AS capital_trabajo,
  round(t.t12) AS ventas_12m, round(t.t12_prev) AS ventas_12m_previos,
  round((t.t12 / nullif(t.t12_prev, 0) - 1) * 100, 1) AS crecimiento_pct,
  round((c.cxc_operativa + c.inventario - c.cxp_operativa) / nullif(t.t12, 0) * 100, 1) AS capital_trabajo_pct_ventas,
  round((c.cxc_operativa + c.inventario - c.cxp_operativa) / nullif(t.t12, 0)
        * greatest(t.t12 - t.t12_prev, 0)) AS caja_requerida_crecimiento,
  c.ciclo_caja,
  round(c.valor_dia_cobro + c.valor_dia_inventario) AS caja_por_dia_de_ciclo
FROM analitica.v_ciclo_caja c, t;

COMMENT ON VIEW analitica.v_capital_trabajo IS
'Capital de trabajo operativo (UNA fila). Montos GTQ.
- capital_trabajo = cxc_operativa + inventario - cxp_operativa: efectivo amarrado en la operacion.
- ventas_12m / ventas_12m_previos: ultimos 12 meses completos vs los 12 anteriores (sin IVA).
- crecimiento_pct = variacion interanual de ventas.
- capital_trabajo_pct_ventas = cuantos quetzales de capital de trabajo exige cada Q100 de venta anual.
- caja_requerida_crecimiento = efectivo adicional que habra que inmovilizar en los proximos 12
  meses si las ventas vuelven a crecer lo mismo que el ultimo ano, con el ciclo actual.
- caja_por_dia_de_ciclo = efectivo aproximado que se libera por cada dia que se acorte el ciclo
  via cobro o inventario.';

-- ---------------------------------------------------------------------------
-- Permisos para el agente (solo lectura)
-- ---------------------------------------------------------------------------
DO $perm$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agente_ia') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA analitica TO agente_ia';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA analitica TO agente_ia';
  END IF;
END
$perm$;

-- ---------------------------------------------------------------------------
-- Playbook "salud" del analista diario
-- ---------------------------------------------------------------------------
INSERT INTO analisis_playbooks (slug, nombre, vertical, orden, prompt) VALUES
(
  'salud', 'Salud financiera', 'salud', 5,
$prompt$Analiza la salud financiera CRUZANDO cartera, inventario y proveedores. Usa las vistas v_ciclo_caja, v_ciclo_caja_mensual, v_inventario_salud y v_capital_trabajo: ya traen las metricas calculadas con las reglas del negocio, NO las recalcules desde cero. No hay saldo bancario: habla de ciclo y de capital de trabajo, nunca de saldo en caja ni runway. Cubre estos angulos y quedate con los de mayor impacto:

- Ciclo de conversion de efectivo (ciclo_caja) y cual de sus tres componentes (dso, dio, dpo) lo alarga mas. Traducelo a quetzales con valor_dia_*: cuanto efectivo se libera acortando 10 dias el componente peor.
- Tendencia de v_ciclo_caja_mensual: estan cobrando mas lento o pagando mas rapido que hace unos meses? Si brecha_dias sube, es alerta.
- Capital inmovilizado en v_inventario_salud: valor con estado 'inmovilizado' separado por clase (materia_prima vs producto). Nombra las lineas y los articulos con mas valor inmovilizado.
- Crecimiento vs caja (v_capital_trabajo): si crecimiento_pct es positivo, cuanta caja_requerida_crecimiento va a pedir el siguiente ano con el ciclo actual.
- Menciona cxp_por_depurar solo como problema de calidad de datos (facturas de proveedor sin cerrar en el ERP), nunca como deuda real.$prompt$
)
ON CONFLICT (slug) DO NOTHING;
