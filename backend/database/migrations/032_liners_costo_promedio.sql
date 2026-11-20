-- 032 · Liners: costo de ventas = costo promedio actual del artículo
--
-- Pedido 2026-11-20, confirmado por Milvia López (inventario, Thermoplastica):
-- el costo que el ERP guarda en cada factura de Liners no se puede corregir
-- (38 artículos con errores de unidad de medida o costo mal cargado), pero el
-- costo promedio del artículo sí se ajusta con movimientos de inventario. Por
-- eso Liners usa ese costo promedio, tomado de la foto diaria de inventario
-- (fact_inventario_snapshot, una fila por artículo).
--
-- Solo cambia la primera rama de v_ventas_costeadas (líneas con método ERP):
--   * Liners con costo promedio > 0: costo = unidades × costo promedio actual;
--     margen y ventas_base_margen se recalculan con ese costo.
--   * Sin costo promedio en la foto: se conserva el costo de la factura.
-- es_cpp sigue en false, así que analitica.margen_comercial no cambia.
-- fact_ventas_linea conserva el costo original de cada factura.
-- Las ramas CPP (Laminados y artículos) quedan igual que en 023.

CREATE OR REPLACE VIEW thermoplastica.v_ventas_costeadas AS
SELECT f.venta_id,f.fact_num,f.tipo_doc,f.sucursal_id,f.cliente_id,f.vendedor_id,f.articulo_id,
 f.fecha_emision,f.fel,f.unidades,f.unidades_dev,f.total_sin_iva,f.total_sin_iva_dev,
 f.total_con_iva,f.total_con_iva_dev,f.iva,f.iva_dev,f.saldo,
 coalesce(lc.costo_promedio,f.costo_promedio_facturado)::numeric(18,5) AS costo_promedio_facturado,
 f.costo_ultimo_facturado,
 c.costo AS costo_total_facturado,
 CASE WHEN lc.costo_promedio IS NULL THEN f.margen_bruto ELSE f.total_sin_iva-c.costo END AS margen_bruto,
 CASE WHEN lc.costo_promedio IS NULL THEN f.margen_bruto_pct
      WHEN f.total_sin_iva<>0 THEN round((f.total_sin_iva-c.costo)/f.total_sin_iva*100,2) END AS margen_bruto_pct,
 f.tipo_cliente,f.es_outlier_fecha,f.batch_id,f.created_at,
 false AS es_cpp,
 CASE WHEN c.costo>0 THEN f.total_sin_iva ELSE 0::numeric END AS ventas_base_margen
FROM thermoplastica.fact_ventas_linea f
LEFT JOIN (SELECT s.articulo_id,s.costo_promedio
           FROM thermoplastica.fact_inventario_snapshot s
           JOIN thermoplastica.dim_articulo a ON a.articulo_id=s.articulo_id
           WHERE a.marca='Liners' AND s.costo_promedio>0) lc ON lc.articulo_id=f.articulo_id
CROSS JOIN LATERAL (SELECT CASE WHEN lc.costo_promedio IS NULL THEN f.costo_total_facturado
                                ELSE f.unidades*lc.costo_promedio END::numeric AS costo) c
WHERE NOT EXISTS(SELECT 1 FROM thermoplastica.cpp_laminados_clave k WHERE
 (k.fact_num,k.tipo_doc,k.sucursal_id,k.articulo_id)=(f.fact_num,f.tipo_doc,f.sucursal_id,f.articulo_id))
AND NOT EXISTS(SELECT 1 FROM thermoplastica.cpp_articulos_clave k WHERE
 (k.fact_num,k.tipo_doc,k.sucursal_id,k.articulo_id)=(f.fact_num,f.tipo_doc,f.sucursal_id,f.articulo_id))
UNION ALL
SELECT v.venta_id,v.fact_num,v.tipo_doc,v.sucursal_id,v.cliente_id,v.vendedor_id,v.articulo_id,
 v.fecha_emision,v.fel,v.unidades,v.unidades_dev,v.total_sin_iva,v.total_sin_iva_dev,
 v.total_con_iva,v.total_con_iva_dev,v.iva,v.iva_dev,v.saldo,v.costo_promedio_facturado,v.costo_ultimo_facturado,
 v.costo_total_facturado,v.margen_bruto,v.margen_bruto_pct,v.tipo_cliente,v.es_outlier_fecha,v.batch_id,v.created_at,
 true AS es_cpp,v.ventas_base_margen
FROM thermoplastica.cpp_laminados_venta v
UNION ALL
SELECT v.venta_id,v.fact_num,v.tipo_doc,v.sucursal_id,v.cliente_id,v.vendedor_id,v.articulo_id,
 v.fecha_emision,v.fel,v.unidades,v.unidades_dev,v.total_sin_iva,v.total_sin_iva_dev,
 v.total_con_iva,v.total_con_iva_dev,v.iva,v.iva_dev,v.saldo,v.costo_promedio_facturado,v.costo_ultimo_facturado,
 v.costo_total_facturado,v.margen_bruto,v.margen_bruto_pct,v.tipo_cliente,v.es_outlier_fecha,v.batch_id,v.created_at,
 true AS es_cpp,v.ventas_base_margen
FROM thermoplastica.cpp_articulos_venta v
WHERE NOT EXISTS(SELECT 1 FROM thermoplastica.cpp_laminados_venta l WHERE
 (l.fact_num,l.tipo_doc,l.sucursal_id,l.articulo_id)=(v.fact_num,v.tipo_doc,v.sucursal_id,v.articulo_id));

COMMENT ON VIEW thermoplastica.v_ventas_costeadas IS
'Laminados: CPP MP sin extrapolar. Empaques, Tapas y válvulas e Inyectables: CPP de compras del mismo producto. Liners (032): costo = unidades × costo promedio actual del artículo (fact_inventario_snapshot); sin costo promedio conserva el costo de la factura. Otras líneas: costo ERP de la factura. Costos originales preservados en fact_ventas_linea.';
