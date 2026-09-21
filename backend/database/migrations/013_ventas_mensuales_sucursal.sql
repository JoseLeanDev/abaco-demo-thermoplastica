-- ============================================================================
-- 013_ventas_mensuales_sucursal.sql
--
-- Cubre dos elementos del ERP que no tenian vista:
--   1. fact_ventas_mensuales: ventas agregadas por mes desde ENERO 2024, ocho
--      meses mas de historia que fact_ventas_linea (que arranca en sep-2024).
--   2. dim_sucursal: se agrega el nombre de sucursal a v_ventas (antes solo
--      salia el id numerico).
--
-- fact_cxc_snapshot_diario se deja fuera a proposito: hoy solo tiene 1 dia
-- capturado. Cuando acumule dias, crear una vista de evolucion de cartera.
--
-- Idempotente. No modifica datos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- v_ventas_mensuales  —  ventas por mes con mas historia (sin cliente/margen)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_ventas_mensuales CASCADE;
CREATE VIEW analitica.v_ventas_mensuales AS
SELECT
  m.anio, m.mes,
  to_char(make_date(m.anio, m.mes, 1), 'YYYY-MM') AS anio_mes,
  s.nombre                     AS sucursal,
  m.sucursal_id,
  a.descripcion                AS articulo,
  a.linea, a.categoria,
  m.unidades,
  m.monto                      AS ventas
FROM thermoplastica.fact_ventas_mensuales m
LEFT JOIN thermoplastica.dim_sucursal s ON s.sucursal_id = m.sucursal_id
LEFT JOIN thermoplastica.dim_articulo  a ON a.articulo_id  = m.articulo_id;

COMMENT ON VIEW analitica.v_ventas_mensuales IS
'Ventas agregadas por mes, articulo y sucursal. Grano: una fila = un mes-articulo-sucursal.
Montos GTQ sin IVA (la columna ventas coincide exactamente con total_sin_iva de v_ventas).
COBERTURA: desde enero 2024, OCHO MESES MAS de historia que v_ventas (que arranca
en septiembre 2024). Usar esta vista para tendencias de venta de largo plazo o
comparativos ano contra ano.
LIMITACION: no tiene cliente ni margen ni costo. Para margen, margen por cliente,
o cualquier analisis de rentabilidad, usar v_ventas (aunque tenga menos historia).';

-- ---------------------------------------------------------------------------
-- v_ventas  —  se recrea agregando el nombre de sucursal
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_ventas CASCADE;
CREATE VIEW analitica.v_ventas AS
SELECT
  f.venta_id, f.fact_num, f.fecha_emision,
  d.anio, d.mes, d.anio_mes, d.mes_nombre, d.trimestre,
  c.nombre                                   AS cliente,
  c.cliente_id,
  f.tipo_cliente,
  s.nombre                                   AS sucursal,
  f.sucursal_id,
  v.nombre                                   AS vendedor,
  f.vendedor_id,
  a.descripcion                              AS articulo,
  a.codigo_articulo,
  a.linea, a.sublinea, a.categoria, a.marca, a.color,
  f.unidades,
  f.total_sin_iva                            AS ventas,
  f.costo_total_facturado                    AS costo,
  f.margen_bruto,
  f.margen_bruto_pct,
  f.total_sin_iva_dev                        AS devoluciones,
  f.saldo
FROM thermoplastica.fact_ventas_linea f
JOIN thermoplastica.dim_cliente  c ON c.cliente_id  = f.cliente_id
LEFT JOIN thermoplastica.dim_vendedor v ON v.vendedor_id = f.vendedor_id
JOIN thermoplastica.dim_articulo a ON a.articulo_id = f.articulo_id
LEFT JOIN thermoplastica.dim_sucursal s ON s.sucursal_id = f.sucursal_id
LEFT JOIN thermoplastica.dim_fecha   d ON d.fecha       = f.fecha_emision;

COMMENT ON VIEW analitica.v_ventas IS
'Lineas de venta reales del ERP. Grano: una fila = una linea de factura.
20,801 lineas, 761 clientes, 2,125 articulos, del 2024-09 al 2026-09.
Montos en GTQ sin IVA.
- ventas = total_sin_iva de la linea. Para "ventas totales" sumar esta columna.
- margen_bruto = utilidad bruta en GTQ de la linea (ya trae el costo descontado).
- margen_bruto_pct = margen de esa linea. Para el margen % de un grupo NO promediar
  esta columna: calcular sum(margen_bruto)/sum(ventas)*100.
- costo = costo_total_facturado de la linea.
- devoluciones = monto devuelto (total_sin_iva_dev); suele ser 0.
- sucursal = nombre de la sucursal (001, ALMACEN, Oficinas Centrales).
- linea/sublinea/categoria clasifican el producto.
- tipo_cliente: "001 - INDUSTRIA" o "002 - Clientes Almacen".
Para MARGEN POR CLIENTE: agrupar por cliente, sum(margen_bruto)/sum(ventas)*100.
Para tendencias de venta ANTERIORES a septiembre 2024, usar v_ventas_mensuales
(tiene mas historia pero sin cliente ni margen).
Esta vista es la fuente de la pagina de Margenes de la aplicacion.';

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
DO $perm$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agente_ia') THEN
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA analitica TO agente_ia';
  END IF;
END
$perm$;
