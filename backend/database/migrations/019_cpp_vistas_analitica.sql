-- Reemplazos sin CASCADE; se conservan nombres, tipos, grants y dependencias.

CREATE OR REPLACE VIEW analitica.v_meta AS
SELECT ( SELECT max(v_ventas_costeadas.fecha_emision) AS max
           FROM thermoplastica.v_ventas_costeadas) AS ultima_venta,
    ( SELECT min(v_ventas_costeadas.fecha_emision) AS min
           FROM thermoplastica.v_ventas_costeadas) AS primera_venta,
    CURRENT_DATE AS hoy,
    CURRENT_DATE - (( SELECT max(v_ventas_costeadas.fecha_emision) AS max
           FROM thermoplastica.v_ventas_costeadas)) AS dias_de_rezago,
    'GTQ'::text AS moneda_base,
    (SELECT corte FROM thermoplastica.cpp_laminados_publicacion WHERE singleton) AS corte_cpp_laminados,
    (SELECT publicado_en FROM thermoplastica.cpp_laminados_publicacion WHERE singleton) AS actualizado_cpp_laminados,
    (SELECT i.desde_ventas FROM thermoplastica.cpp_laminados_publicacion p JOIN thermoplastica.cpp_laminados_importacion i ON i.id=p.importacion_id WHERE singleton) AS desde_laminados;

CREATE OR REPLACE VIEW analitica.v_ventas AS
SELECT f.venta_id,
    f.fact_num,
    f.fecha_emision,
    d.anio,
    d.mes,
    d.anio_mes,
    d.mes_nombre,
    d.trimestre,
    c.nombre AS cliente,
    c.cliente_id,
    f.tipo_cliente,
    s.nombre AS sucursal,
    f.sucursal_id,
    v.nombre AS vendedor,
    f.vendedor_id,
    a.descripcion AS articulo,
    a.codigo_articulo,
    a.linea,
    a.sublinea,
    a.categoria,
    a.marca,
    a.color,
    f.unidades,
    f.total_sin_iva AS ventas,
    f.costo_total_facturado::numeric(18,2) AS costo,
    f.margen_bruto::numeric(18,2) AS margen_bruto,
    f.margen_bruto_pct::numeric(10,2) AS margen_bruto_pct,
    f.total_sin_iva_dev AS devoluciones,
    f.saldo, f.es_cpp, f.ventas_base_margen, f.costo_total_facturado AS costo_comercial, f.margen_bruto AS margen_comercial
   FROM thermoplastica.v_ventas_costeadas f
     JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id
     LEFT JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
     JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
     LEFT JOIN thermoplastica.dim_sucursal s ON s.sucursal_id = f.sucursal_id
     LEFT JOIN thermoplastica.dim_fecha d ON d.fecha = f.fecha_emision;

CREATE OR REPLACE VIEW analitica.v_ciclo_caja AS
WITH corte AS (
         SELECT max(v_ventas_costeadas.fecha_emision) AS f
           FROM thermoplastica.v_ventas_costeadas
          WHERE v_ventas_costeadas.tipo_doc = 'FACT'::text
        ), ventas AS (
         SELECT sum(v.total_sin_iva) AS sin_iva,
            sum(v.total_con_iva) AS con_iva,
            (analitica.margen_comercial(v.es_cpp,v.total_sin_iva,v.costo_total_facturado,v.margen_bruto,v.ventas_base_margen)->>'costo')::numeric AS costo
           FROM thermoplastica.v_ventas_costeadas v,
            corte
          WHERE v.tipo_doc = 'FACT'::text AND v.fecha_emision > (corte.f - 365) AND v.fecha_emision <= corte.f
        ), compras AS (
         SELECT sum(c.total_con_iva) AS con_iva
           FROM thermoplastica.fact_compras_linea c,
            corte
          WHERE c.tipo_doc = 'FACT'::text AND NOT COALESCE(c.es_outlier_fecha, false) AND c.fecha_emision > (corte.f - 365) AND c.fecha_emision <= corte.f
        ), cxc AS (
         SELECT COALESCE(sum(fact_cxc_factura.saldo) FILTER (WHERE fact_cxc_factura.fecha_vencimiento >= (CURRENT_DATE - 90)), 0::numeric) AS operativa,
            COALESCE(sum(fact_cxc_factura.saldo) FILTER (WHERE fact_cxc_factura.fecha_vencimiento < (CURRENT_DATE - 90)), 0::numeric) AS dudosa
           FROM thermoplastica.fact_cxc_factura
          WHERE fact_cxc_factura.saldo > 0::numeric
        ), cxp AS (
         SELECT COALESCE(sum(fact_cxp_factura.saldo) FILTER (WHERE fact_cxp_factura.fecha_vencimiento >= (CURRENT_DATE - 90)), 0::numeric) AS operativa,
            COALESCE(sum(fact_cxp_factura.saldo) FILTER (WHERE fact_cxp_factura.fecha_vencimiento < (CURRENT_DATE - 90)), 0::numeric) AS por_depurar,
            count(*) FILTER (WHERE fact_cxp_factura.fecha_vencimiento < (CURRENT_DATE - 90)) AS facturas_por_depurar
           FROM thermoplastica.fact_cxp_factura
          WHERE fact_cxp_factura.saldo > 0::numeric
        ), inv AS (
         SELECT COALESCE(sum(fact_inventario_snapshot.valor_inventario), 0::numeric) AS valor
           FROM thermoplastica.fact_inventario_snapshot
          WHERE fact_inventario_snapshot.stock_actual > 0::numeric AND fact_inventario_snapshot.fecha_snapshot = (( SELECT max(fact_inventario_snapshot_1.fecha_snapshot) AS max
                   FROM thermoplastica.fact_inventario_snapshot fact_inventario_snapshot_1))
        ), cobro_real AS (
         SELECT sum((fact_cxc_factura.fecha_ultimo_cobro - fact_cxc_factura.fecha_emision)::numeric * fact_cxc_factura.valor) / NULLIF(sum(fact_cxc_factura.valor), 0::numeric) AS dias
           FROM thermoplastica.fact_cxc_factura,
            corte
          WHERE fact_cxc_factura.saldo <= 0::numeric AND fact_cxc_factura.fecha_ultimo_cobro >= fact_cxc_factura.fecha_emision AND fact_cxc_factura.fecha_ultimo_cobro > (corte.f - 365)
        ), pago_real AS (
         SELECT sum((fact_cxp_factura.fecha_ultimo_pago - fact_cxp_factura.fecha_emision)::numeric * fact_cxp_factura.valor) / NULLIF(sum(fact_cxp_factura.valor), 0::numeric) AS dias
           FROM thermoplastica.fact_cxp_factura,
            corte
          WHERE fact_cxp_factura.saldo <= 0::numeric AND fact_cxp_factura.fecha_ultimo_pago >= fact_cxp_factura.fecha_emision AND fact_cxp_factura.fecha_ultimo_pago > (corte.f - 365)
        ), base AS (
         SELECT corte.f AS fecha_corte,
            ventas.sin_iva AS ventas_12m,
            ventas.con_iva AS ventas_12m_con_iva,
            ventas.costo AS costo_ventas_12m,
            compras.con_iva AS compras_12m_con_iva,
            cxc.operativa AS cxc_operativa,
            cxc.dudosa AS cxc_dudosa,
            inv.valor AS inventario,
            cxp.operativa AS cxp_operativa,
            cxp.por_depurar AS cxp_por_depurar,
            cxp.facturas_por_depurar,
            ventas.con_iva / 365.0 AS valor_dia_cobro,
            ventas.costo / 365.0 AS valor_dia_inventario,
            compras.con_iva / 365.0 AS valor_dia_pago,
            cobro_real.dias AS dias_cobro_real,
            pago_real.dias AS dias_pago_real
           FROM corte,
            ventas,
            compras,
            cxc,
            cxp,
            inv,
            cobro_real,
            pago_real
        )
 SELECT fecha_corte,
    round(cxc_operativa / NULLIF(valor_dia_cobro, 0::numeric), 1) AS dso,
    round(inventario / NULLIF(valor_dia_inventario, 0::numeric), 1) AS dio,
    round(cxp_operativa / NULLIF(valor_dia_pago, 0::numeric), 1) AS dpo,
    round(cxc_operativa / NULLIF(valor_dia_cobro, 0::numeric) + inventario / NULLIF(valor_dia_inventario, 0::numeric) - cxp_operativa / NULLIF(valor_dia_pago, 0::numeric), 1) AS ciclo_caja,
    round(dias_cobro_real, 1) AS dias_cobro_real,
    round(dias_pago_real, 1) AS dias_pago_real,
    round(valor_dia_cobro) AS valor_dia_cobro,
    round(valor_dia_inventario) AS valor_dia_inventario,
    round(valor_dia_pago) AS valor_dia_pago,
    round(ventas_12m) AS ventas_12m,
    round(ventas_12m_con_iva) AS ventas_12m_con_iva,
    round(costo_ventas_12m) AS costo_ventas_12m,
    round(compras_12m_con_iva) AS compras_12m_con_iva,
    round(cxc_operativa) AS cxc_operativa,
    round(cxc_dudosa) AS cxc_dudosa,
    round(inventario) AS inventario,
    round(cxp_operativa) AS cxp_operativa,
    round(cxp_por_depurar) AS cxp_por_depurar,
    facturas_por_depurar
   FROM base;

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
                CASE
                    WHEN v.ultima_venta IS NOT NULL OR vm.ultima_venta IS NOT NULL THEN 'producto'::text
                    WHEN c.ultima_compra IS NOT NULL THEN 'materia_prima'::text
                    ELSE 'sin_movimiento'::text
                END AS clase,
                CASE
                    WHEN v.ultima_venta IS NOT NULL OR vm.ultima_venta IS NOT NULL THEN COALESCE(v.costo_vendido_180d, 0::numeric) / 180.0
                    ELSE COALESCE(c.compras_365d, 0::numeric) / 365.0
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
    round(valor_inventario / NULLIF(consumo_diario, 0::numeric)) AS dias_cobertura,
        CASE
            WHEN clase = 'sin_movimiento'::text THEN 'inmovilizado'::text
            WHEN clase = 'producto'::text AND (ultima_venta IS NULL OR ultima_venta < (CURRENT_DATE - 180)) THEN 'inmovilizado'::text
            WHEN clase = 'materia_prima'::text AND (ultima_compra IS NULL OR ultima_compra < (CURRENT_DATE - 365)) THEN 'inmovilizado'::text
            WHEN consumo_diario <= 0::numeric OR (valor_inventario / consumo_diario) > 180::numeric THEN 'lento'::text
            ELSE 'activo'::text
        END AS estado
   FROM x;

COMMENT ON VIEW analitica.v_ventas IS 'Ventas vigentes. Laminados CPP MP Jonathan; otras líneas ERP. Para el margen por cualquier grupo usar analitica.margen_comercial(es_cpp,ventas,costo_comercial,margen_comercial,ventas_base_margen): JSON margen,costo,base,pct,pct_sin_costo. Los campos costo_comercial/margen_comercial conservan precisión; costo/margen_bruto son compatibles redondeados. Ventas sin CPP permanecen en ventas y se excluyen de base. Mes abierto: ventas visibles, CPP N/D. No es margen contable de transformación.';
