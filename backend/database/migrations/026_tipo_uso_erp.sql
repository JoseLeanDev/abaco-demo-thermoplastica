-- Clase de inventario desde el ERP: campo "Tipo Uso" de vst_Articulos (llenado por el
-- cliente en oct-2026: MATERIA PRIMA, PRODUCTO TERMINADO, SERVICIO, CONSUMO/GASTO).
-- Reemplaza la deducción por movimiento (vendido → producto; solo comprado → materia
-- prima), que queda solo como respaldo para artículos sin Tipo Uso.
-- dim_articulo.tipo ya trae otros códigos del ERP, por eso va en una columna nueva.

ALTER TABLE thermoplastica.dim_articulo ADD COLUMN IF NOT EXISTS tipo_uso TEXT;

-- Tipo Uso del ERP → clase de la plataforma
CREATE OR REPLACE FUNCTION thermoplastica.clase_tipo_uso(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE UPPER(TRIM(t))
    WHEN 'MATERIA PRIMA'      THEN 'materia_prima'
    WHEN 'PRODUCTO TERMINADO' THEN 'producto'
    WHEN 'SERVICIO'           THEN 'consumo'
    WHEN 'CONSUMO/GASTO'      THEN 'consumo'
  END
$$;

-- La ingesta (VPS) carga raw_thermoplastica.articulos_snapshot y luego hace upsert en
-- dim_articulo; este trigger copia el Tipo Uso en ese upsert. Si el artículo no está en
-- el snapshot (alta desde ventas/compras antes de cargarlo) se conserva el valor anterior.
CREATE OR REPLACE FUNCTION thermoplastica.dim_articulo_tipo_uso() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE t TEXT;
BEGIN
  SELECT NULLIF(TRIM(r.tipo_uso), '') INTO t
    FROM raw_thermoplastica.articulos_snapshot r
   WHERE r.codigo = NEW.codigo_articulo
   LIMIT 1;
  IF t IS NOT NULL THEN
    NEW.tipo_uso := t;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.tipo_uso := COALESCE(NEW.tipo_uso, OLD.tipo_uso);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dim_articulo_tipo_uso ON thermoplastica.dim_articulo;
CREATE TRIGGER trg_dim_articulo_tipo_uso
  BEFORE INSERT OR UPDATE ON thermoplastica.dim_articulo
  FOR EACH ROW EXECUTE FUNCTION thermoplastica.dim_articulo_tipo_uso();

-- Carga inicial con el snapshot de hoy
UPDATE thermoplastica.dim_articulo a
   SET tipo_uso = NULLIF(TRIM(r.tipo_uso), '')
  FROM raw_thermoplastica.articulos_snapshot r
 WHERE r.codigo = a.codigo_articulo
   AND NULLIF(TRIM(r.tipo_uso), '') IS NOT NULL;

-- Vista de salud: misma estructura que 024; solo cambia de dónde sale la clase.
CREATE OR REPLACE VIEW analitica.v_inventario_salud AS
WITH snap AS (
         SELECT s.inv_id,
            s.articulo_id,
            s.proveedor_id,
            s.stock_actual,
            s.stock_en_transito,
            s.costo_promedio,
            s.costo_proveedor,
            s.costo_ultimo,
            s.precio_venta_1,
            s.precio_venta_2,
            s.precio_venta_3,
            s.precio_venta_4,
            s.precio_venta_5,
            s.valor_inventario,
            s.fecha_snapshot,
            s.batch_id,
            s.created_at,
            s.updated_at,
            s.margen_bruto_pct
           FROM thermoplastica.fact_inventario_snapshot s
          WHERE s.stock_actual > 0::numeric AND s.fecha_snapshot = (( SELECT max(fact_inventario_snapshot.fecha_snapshot) AS max
                   FROM thermoplastica.fact_inventario_snapshot))
        ), ventas AS (
         SELECT v_ventas_costeadas.articulo_id,
            max(v_ventas_costeadas.fecha_emision) AS ultima_venta,
            sum(v_ventas_costeadas.costo_total_facturado) FILTER (WHERE v_ventas_costeadas.fecha_emision > (CURRENT_DATE - 180)) AS costo_vendido_180d
           FROM thermoplastica.v_ventas_costeadas
          WHERE v_ventas_costeadas.tipo_doc = 'FACT'::text
          GROUP BY v_ventas_costeadas.articulo_id
        ), ventas_mes AS (
         SELECT fact_ventas_mensuales.articulo_id,
            max((make_date(fact_ventas_mensuales.anio::integer, fact_ventas_mensuales.mes::integer, 1) + '1 mon -1 days'::interval)::date) AS ultima_venta
           FROM thermoplastica.fact_ventas_mensuales
          WHERE fact_ventas_mensuales.monto > 0::numeric
          GROUP BY fact_ventas_mensuales.articulo_id
        ), compras AS (
         SELECT fact_compras_linea.articulo_id,
            max(fact_compras_linea.fecha_emision) AS ultima_compra,
            sum(fact_compras_linea.total_sin_iva) FILTER (WHERE fact_compras_linea.fecha_emision > (CURRENT_DATE - 365)) AS compras_365d
           FROM thermoplastica.fact_compras_linea
          WHERE fact_compras_linea.tipo_doc = 'FACT'::text AND NOT COALESCE(fact_compras_linea.es_outlier_fecha, false) AND fact_compras_linea.fecha_emision <= CURRENT_DATE
          GROUP BY fact_compras_linea.articulo_id
        ), x AS (
         SELECT s.articulo_id,
            a.codigo_articulo,
            a.descripcion AS articulo,
            a.linea,
            a.categoria,
            s.stock_actual,
            s.valor_inventario,
                CASE
                    WHEN vm.ultima_venta IS NULL OR v.ultima_venta IS NOT NULL AND v.ultima_venta >= date_trunc('month'::text, vm.ultima_venta::timestamp with time zone)::date THEN v.ultima_venta
                    ELSE LEAST(vm.ultima_venta, CURRENT_DATE)
                END AS ultima_venta,
            c.ultima_compra,
                COALESCE(thermoplastica.clase_tipo_uso(a.tipo_uso),
                CASE
                    WHEN v.ultima_venta IS NOT NULL OR vm.ultima_venta IS NOT NULL THEN 'producto'::text
                    WHEN c.ultima_compra IS NOT NULL THEN 'materia_prima'::text
                    ELSE 'sin_movimiento'::text
                END) AS clase,
                CASE
                    WHEN v.ultima_venta IS NOT NULL OR vm.ultima_venta IS NOT NULL THEN COALESCE(v.costo_vendido_180d, 0::numeric) / 180.0
                    ELSE NULL::numeric
                END AS consumo_diario
           FROM snap s
             JOIN thermoplastica.dim_articulo a ON a.articulo_id = s.articulo_id
             LEFT JOIN ventas v ON v.articulo_id = s.articulo_id
             LEFT JOIN ventas_mes vm ON vm.articulo_id = s.articulo_id
             LEFT JOIN compras c ON c.articulo_id = s.articulo_id
        )
 SELECT articulo_id,
    codigo_articulo,
    articulo,
    linea,
    categoria,
    clase,
    stock_actual,
    round(valor_inventario, 2) AS valor_inventario,
    ultima_venta,
    ultima_compra,
    CURRENT_DATE - ultima_venta AS dias_sin_venta,
    CURRENT_DATE - ultima_compra AS dias_sin_compra,
    CASE WHEN clase = 'producto' THEN round(valor_inventario / NULLIF(consumo_diario, 0::numeric)) END AS dias_cobertura,
        CASE
            WHEN clase <> 'producto'::text THEN 'por_validar'::text
            WHEN ultima_venta IS NULL OR ultima_venta < (CURRENT_DATE - 180) THEN 'inmovilizado'::text
            WHEN consumo_diario <= 0::numeric OR (valor_inventario / consumo_diario) > 180::numeric THEN 'lento'::text
            ELSE 'activo'::text
        END AS estado
   FROM x;

COMMENT ON VIEW analitica.v_inventario_salud IS 'Stock positivo al último corte. clase = Tipo Uso del ERP (materia_prima, producto, consumo = servicio o consumo/gasto); sin Tipo Uso se deduce: producto = venta directa observada, materia_prima = compras sin venta, sin_movimiento = sin compras/ventas. estado por_validar (todo lo que no es producto): consumo de producción no disponible, NO sumar a activo, lento, inmovilizado ni exceso; dias_cobertura NULL. Compra no equivale a consumo. Producto: inmovilizado por falta de venta directa >180d; lento por cobertura >180d; activo el resto. El valor total del inventario se conserva.';
