-- Las tablas originales y la publicación de Laminados se conservan.
CREATE TABLE IF NOT EXISTS thermoplastica.cpp_articulos_importacion (
  id bigserial PRIMARY KEY, extraido_en timestamptz NOT NULL DEFAULT now(),
  desde_ventas date NOT NULL, desde_compras date NOT NULL, hasta date NOT NULL,
  ventas jsonb NOT NULL, compras jsonb NOT NULL, publicado_en timestamptz,
  CHECK(jsonb_typeof(ventas)='array' AND jsonb_typeof(compras)='array')
);
CREATE TABLE IF NOT EXISTS thermoplastica.cpp_articulos_publicacion (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  importacion_id bigint NOT NULL REFERENCES thermoplastica.cpp_articulos_importacion(id),
  corte date NOT NULL, publicado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS thermoplastica.cpp_articulos_clave (
  fact_num bigint NOT NULL,tipo_doc text NOT NULL,sucursal_id bigint NOT NULL,
  articulo_id bigint NOT NULL,PRIMARY KEY(fact_num,tipo_doc,sucursal_id,articulo_id)
);
CREATE TABLE IF NOT EXISTS thermoplastica.cpp_articulos_venta
  (LIKE thermoplastica.cpp_laminados_venta);
ALTER TABLE thermoplastica.cpp_articulos_venta ADD COLUMN IF NOT EXISTS linea_cpp text;
ALTER TABLE thermoplastica.cpp_articulos_venta ALTER COLUMN batch_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cpp_articulos_venta_clave ON thermoplastica.cpp_articulos_venta(fact_num,tipo_doc,sucursal_id,articulo_id);

CREATE OR REPLACE VIEW thermoplastica.v_ventas_costeadas AS
SELECT f.*,false AS es_cpp,
 CASE WHEN f.costo_total_facturado>0 THEN f.total_sin_iva ELSE 0::numeric END AS ventas_base_margen
FROM thermoplastica.fact_ventas_linea f
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
'CPP: Laminados en kg según PDF; Empaques, Tapas y Valvulas e Inyectables en millares con compras propias. Los demás registros mantienen ERP. Sin extrapolar CPP faltante. Mes abierto N/D. No es margen contable de transformación.';
COMMENT ON VIEW analitica.v_ventas IS
'Ventas vigentes. Cuatro líneas con CPP: Laminados kg, Empaques/Tapas e Inyectables millares. Usar analitica.margen_comercial(es_cpp,ventas,costo_comercial,margen_comercial,ventas_base_margen); no promediar porcentajes ni estimar utilidad para ventas sin CPP. Restantes líneas mantienen ERP. No es margen contable de transformación.';
UPDATE analisis_playbooks SET prompt=replace(prompt,
 'Laminados usa CPP de materia prima, las demás líneas conservan ERP. No estimar utilidad para Laminados sin CPP.',
 'Laminados usa CPP de materia prima en kg; Empaques para alimentos, Tapas y Valvulas e Inyectables usan CPP de compras propias en millares. Las otras líneas conservan ERP. No estimar utilidad para ninguna venta sin CPP.')
WHERE slug='margenes';
