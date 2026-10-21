-- Fuente dedicada: no altera las tablas originales ni las cargas de otras líneas.
CREATE TABLE IF NOT EXISTS thermoplastica.cpp_laminados_importacion (
  id bigserial PRIMARY KEY, extraido_en timestamptz NOT NULL DEFAULT now(),
  desde_ventas date NOT NULL, desde_compras date NOT NULL, hasta date NOT NULL,
  ventas jsonb NOT NULL, compras jsonb NOT NULL, publicado_en timestamptz,
  CHECK (jsonb_typeof(ventas)='array' AND jsonb_typeof(compras)='array')
);
CREATE TABLE IF NOT EXISTS thermoplastica.cpp_laminados_publicacion (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  importacion_id bigint NOT NULL REFERENCES thermoplastica.cpp_laminados_importacion(id),
  corte date NOT NULL, publicado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS thermoplastica.cpp_laminados_clave (
  fact_num bigint NOT NULL, tipo_doc text NOT NULL, sucursal_id bigint NOT NULL,
  articulo_id bigint NOT NULL, PRIMARY KEY(fact_num,tipo_doc,sucursal_id,articulo_id)
);
-- LIKE sin INCLUDING GENERATED: costos CPP se guardan separados del costo ERP.
CREATE TABLE IF NOT EXISTS thermoplastica.cpp_laminados_venta
  (LIKE thermoplastica.fact_ventas_linea);
ALTER TABLE thermoplastica.cpp_laminados_venta ADD COLUMN IF NOT EXISTS ventas_base_margen numeric;
ALTER TABLE thermoplastica.cpp_laminados_venta ADD COLUMN IF NOT EXISTS fuente_cpp jsonb;
ALTER TABLE thermoplastica.cpp_laminados_venta ALTER COLUMN batch_id DROP NOT NULL;
DO $$ BEGIN
IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='thermoplastica.cpp_laminados_venta'::regclass AND attname='costo_total_facturado' AND atttypmod<>-1) THEN
  DROP VIEW IF EXISTS thermoplastica.v_ventas_costeadas;
  ALTER TABLE thermoplastica.cpp_laminados_venta ALTER COLUMN costo_total_facturado TYPE numeric;
  ALTER TABLE thermoplastica.cpp_laminados_venta ALTER COLUMN margen_bruto TYPE numeric;
  ALTER TABLE thermoplastica.cpp_laminados_venta ALTER COLUMN margen_bruto_pct TYPE numeric;
END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS cpp_laminados_venta_clave ON thermoplastica.cpp_laminados_venta(fact_num,tipo_doc,sucursal_id,articulo_id);
CREATE OR REPLACE VIEW thermoplastica.v_ventas_costeadas AS
SELECT f.*,false AS es_cpp,
  CASE WHEN f.costo_total_facturado>0 THEN f.total_sin_iva ELSE 0::numeric END AS ventas_base_margen
FROM thermoplastica.fact_ventas_linea f
WHERE NOT EXISTS (SELECT 1 FROM thermoplastica.cpp_laminados_clave k
  WHERE (k.fact_num,k.tipo_doc,k.sucursal_id,k.articulo_id)=(f.fact_num,f.tipo_doc,f.sucursal_id,f.articulo_id))
UNION ALL
SELECT v.venta_id,v.fact_num,v.tipo_doc,v.sucursal_id,v.cliente_id,v.vendedor_id,v.articulo_id,
 v.fecha_emision,v.fel,v.unidades,v.unidades_dev,v.total_sin_iva,v.total_sin_iva_dev,
 v.total_con_iva,v.total_con_iva_dev,v.iva,v.iva_dev,v.saldo,v.costo_promedio_facturado,v.costo_ultimo_facturado,
 v.costo_total_facturado,v.margen_bruto,v.margen_bruto_pct,v.tipo_cliente,v.es_outlier_fecha,v.batch_id,v.created_at,
 true AS es_cpp,v.ventas_base_margen
FROM thermoplastica.cpp_laminados_venta v;
COMMENT ON VIEW thermoplastica.v_ventas_costeadas IS
'Laminados: snapshot ERP vigente, CPP MP Jonathan, sin extrapolar faltantes; ventas internas excluidas. Otras líneas: campos ERP originales. Costos originales preservados en fact_ventas_linea. ventas_base_margen excluye Laminados sin CPP, incluido mes abierto.';
