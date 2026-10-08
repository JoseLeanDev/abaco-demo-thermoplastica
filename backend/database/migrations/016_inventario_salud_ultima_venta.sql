-- ============================================================================
-- 016_inventario_salud_ultima_venta.sql
--
-- Corrige analitica.v_inventario_salud: la última venta tomada de
-- fact_ventas_mensuales usaba el último día del mes, así que para el mes en
-- curso quedaba en el futuro y los "días sin venta" salían negativos
-- (p. ej. "Venta hace -23 días"). Al usar la fecha exacta de la tabla diaria,
-- algunos artículos quedan con su venta real unos días antes y cruzan el umbral
-- de 180 días (al aplicarla el 2026-10-08: 2 artículos, Q13k, de lento a
-- inmovilizado).
--
-- CREATE OR REPLACE conserva columnas, comentario y vistas dependientes.
-- Idempotente.
-- ============================================================================

CREATE OR REPLACE VIEW analitica.v_inventario_salud AS
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
         -- La tabla mensual fecha cada mes en su ÚLTIMO día: para el mes en curso eso
         -- cae en el futuro (días sin venta negativos). Si la tabla diaria tiene una
         -- venta en ese mes o después, se usa su fecha exacta; si no, la mensual
         -- topada a hoy.
         CASE
           WHEN vm.ultima_venta IS NULL
             OR (v.ultima_venta IS NOT NULL AND v.ultima_venta >= date_trunc('month', vm.ultima_venta)::date)
           THEN v.ultima_venta
           ELSE least(vm.ultima_venta, CURRENT_DATE)
         END AS ultima_venta,
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
