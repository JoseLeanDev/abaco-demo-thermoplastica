-- Agregado único, disponible también para el agente de solo lectura.
CREATE OR REPLACE FUNCTION analitica.cpp_acumular(s numeric[], cpp boolean, venta numeric, costo numeric, margen numeric, base numeric)
RETURNS numeric[] LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
SELECT ARRAY[
 s[1]+CASE WHEN cpp THEN coalesce(costo,0) ELSE 0 END,
 s[2]+CASE WHEN cpp THEN coalesce(margen,0) ELSE 0 END,
 s[3]+CASE WHEN cpp THEN coalesce(base,0) ELSE 0 END,
 s[4]+CASE WHEN NOT cpp THEN coalesce(venta,0) ELSE 0 END,
 s[5]+CASE WHEN NOT cpp AND costo>0 THEN coalesce(venta,0) ELSE 0 END,
 s[6]+CASE WHEN NOT cpp AND costo>0 THEN coalesce(margen,0) ELSE 0 END,
 s[7]+CASE WHEN cpp AND costo IS NOT NULL THEN 1 ELSE 0 END,
 s[8]+CASE WHEN cpp THEN coalesce(venta,0)-coalesce(base,0) WHEN coalesce(costo,0)=0 THEN coalesce(venta,0) ELSE 0 END,
 s[9]+coalesce(venta,0)
]; $$;
CREATE OR REPLACE FUNCTION analitica.cpp_final(s numeric[])
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
WITH b AS (SELECT s[6]/nullif(s[5],0) AS erp_pct), t AS (
 SELECT CASE WHEN s[7]>0 OR erp_pct IS NOT NULL THEN s[2]+coalesce(s[4]*erp_pct,0) END AS margen,
        CASE WHEN s[7]>0 OR erp_pct IS NOT NULL THEN s[1]+coalesce(s[4]*(1-erp_pct),0) END AS costo,
        s[3]+CASE WHEN erp_pct IS NOT NULL THEN s[4] ELSE 0 END AS base FROM b)
SELECT jsonb_build_object('margen',margen,'costo',costo,'base',base,
 'pct',CASE WHEN base>0 THEN margen/base*100 END,'pct_sin_costo',coalesce(s[8]/nullif(s[9],0)*100,0)) FROM t;
$$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='analitica' AND p.proname='margen_comercial') THEN
 EXECUTE 'CREATE AGGREGATE analitica.margen_comercial(boolean,numeric,numeric,numeric,numeric) (SFUNC=analitica.cpp_acumular,STYPE=numeric[],FINALFUNC=analitica.cpp_final,INITCOND=''{0,0,0,0,0,0,0,0,0}'')';
 END IF;
END $$;
COMMENT ON AGGREGATE analitica.margen_comercial(boolean,numeric,numeric,numeric,numeric) IS
'Usar con (es_cpp,ventas,costo_comercial,margen_comercial,ventas_base_margen) de v_ventas. Retorna JSON: margen,costo,base,pct,pct_sin_costo. CPP Laminados sin extrapolar; demás líneas mantienen ERP y extrapolación anterior. Nunca AVG de porcentajes.';
