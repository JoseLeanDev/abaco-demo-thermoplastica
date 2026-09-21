-- ============================================================================
-- 012_capa_semantica_real.sql
--
-- Reapunta la capa semantica (schema analitica) al MODELO REAL de Thermoplastica
-- (schema thermoplastica: modelo estrella con datos del ERP, actualizado a 3 dias).
--
-- Las vistas de la migracion 010 se construyeron sobre el schema public, que
-- resulto ser data DEMO (480 transacciones, 6 meses de rezago). El schema
-- thermoplastica tiene lo real: 20,801 lineas de venta, 761 clientes, 2,125
-- articulos, margen y costo por linea, CxC/CxP reales, inventario y compras.
--
-- Esta migracion:
--   - Reemplaza v_cxc y v_cxp para que lean thermoplastica.
--   - Crea v_ventas, v_inventario, v_compras sobre thermoplastica.
--   - Reescribe v_meta y v_calidad_datos.
--   - ELIMINA las vistas demo que darian numeros falsos (v_bancos,
--     v_obligaciones_sat, v_kpis, v_resultados_mensuales, v_transacciones).
--     El dataset real no trae saldos bancarios ni obligaciones SAT; es
--     preferible que el agente diga "no tengo ese dato" a inventarlo.
--
-- Idempotente. No modifica datos.
-- ============================================================================

-- ---- Limpieza de las vistas demo (schema public) --------------------------
DROP VIEW IF EXISTS analitica.v_kpis CASCADE;
DROP VIEW IF EXISTS analitica.v_resultados_mensuales CASCADE;
DROP VIEW IF EXISTS analitica.v_transacciones CASCADE;
DROP VIEW IF EXISTS analitica.v_bancos CASCADE;
DROP VIEW IF EXISTS analitica.v_obligaciones_sat CASCADE;
DROP VIEW IF EXISTS analitica.v_cxc CASCADE;
DROP VIEW IF EXISTS analitica.v_cxp CASCADE;

-- ---------------------------------------------------------------------------
-- v_meta  —  fecha de corte del dataset real
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_meta CASCADE;
CREATE VIEW analitica.v_meta AS
SELECT
  (SELECT max(fecha_emision) FROM thermoplastica.fact_ventas_linea)     AS ultima_venta,
  (SELECT min(fecha_emision) FROM thermoplastica.fact_ventas_linea)     AS primera_venta,
  CURRENT_DATE                                                          AS hoy,
  CURRENT_DATE - (SELECT max(fecha_emision) FROM thermoplastica.fact_ventas_linea) AS dias_de_rezago,
  'GTQ'::text                                                           AS moneda_base;

COMMENT ON VIEW analitica.v_meta IS
'Metadatos del dataset real de Thermoplastica. Una sola fila.
Los datos provienen del ERP y estan actualizados casi al dia (pocos dias de
rezago, ver dias_de_rezago). A diferencia del dataset demo anterior, aqui SI se
puede usar CURRENT_DATE para calculos de antiguedad y vencimiento.
Moneda GTQ (quetzales). Ventas cubren desde primera_venta hasta ultima_venta.';

-- ---------------------------------------------------------------------------
-- v_ventas  —  lineas de venta con cliente, articulo, vendedor y fecha
-- ---------------------------------------------------------------------------
-- Vista central. Grano: una fila = una linea de una factura de venta.
-- margen_bruto y total_sin_iva ya vienen calculados por linea en el ERP y son
-- los mismos que usa la pagina de Margenes de la app.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_ventas CASCADE;
CREATE VIEW analitica.v_ventas AS
SELECT
  f.venta_id, f.fact_num, f.fecha_emision,
  d.anio, d.mes, d.anio_mes, d.mes_nombre, d.trimestre,
  c.nombre                                   AS cliente,
  c.cliente_id,
  f.tipo_cliente,
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
- linea/sublinea/categoria clasifican el producto (ej: Termoformados B2B,
  Envases y tapas, Liners y sellos, Laminaciones, Maquila).
- tipo_cliente: "001 - INDUSTRIA" o "002 - Clientes Almacen".
Para MARGEN POR CLIENTE: agrupar por cliente, sum(margen_bruto)/sum(ventas)*100.
Esta vista es la fuente de la pagina de Margenes de la aplicacion.';

-- ---------------------------------------------------------------------------
-- v_cxc  —  cuentas por cobrar reales con aging
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_cxc CASCADE;
CREATE VIEW analitica.v_cxc AS
SELECT
  f.factura_pk, f.factura_num,
  c.nombre                                    AS cliente,
  c.cliente_id,
  f.valor, f.saldo,
  f.fecha_emision, f.fecha_vencimiento,
  f.estado,
  f.forma_pago                                AS sector_cliente,
  GREATEST(CURRENT_DATE - f.fecha_vencimiento, 0) AS dias_vencido,
  (f.estado = 'ATRASADA' OR (f.saldo > 0 AND CURRENT_DATE > f.fecha_vencimiento)) AS esta_vencida,
  CASE
    WHEN f.saldo <= 0                                    THEN 'cobrada'
    WHEN CURRENT_DATE <= f.fecha_vencimiento             THEN 'corriente'
    WHEN CURRENT_DATE -  f.fecha_vencimiento <= 30       THEN '1-30'
    WHEN CURRENT_DATE -  f.fecha_vencimiento <= 60       THEN '31-60'
    WHEN CURRENT_DATE -  f.fecha_vencimiento <= 90       THEN '61-90'
    ELSE '90+'
  END                                         AS bucket_aging,
  f.fecha_ultimo_cobro
FROM thermoplastica.fact_cxc_factura f
JOIN thermoplastica.dim_cliente c ON c.cliente_id = f.cliente_id;

COMMENT ON VIEW analitica.v_cxc IS
'Cuentas por cobrar reales. Grano: una fila = una factura. Montos GTQ.
- saldo = lo que aun se debe de esa factura; valor = monto original.
  Para "cuanto me deben" sumar saldo (NO valor).
- estado: CANCELADA (pagada, saldo 0), VIGENTE (al dia), ATRASADA (vencida).
- La mayoria de filas estan CANCELADA (historico). Para cartera pendiente
  filtrar saldo > 0.
- dias_vencido y bucket_aging se calculan contra CURRENT_DATE (datos al dia).
- OJO: la columna origen forma_pago NO es la forma de pago, es el SECTOR del
  cliente (Farmaceutica, Comercio, Alimenticia, etc.); aqui se expone como
  sector_cliente.';

-- ---------------------------------------------------------------------------
-- v_cxp  —  cuentas por pagar reales
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_cxp CASCADE;
CREATE VIEW analitica.v_cxp AS
SELECT
  f.factura_pk, f.numero_interno, f.factura_proveedor,
  p.nombre                                    AS proveedor,
  p.proveedor_id,
  f.valor, f.saldo,
  f.fecha_emision, f.fecha_vencimiento,
  f.estado,
  f.fecha_vencimiento - CURRENT_DATE          AS dias_para_vencer,
  GREATEST(CURRENT_DATE - f.fecha_vencimiento, 0) AS dias_vencido,
  (f.estado = 'ATRASADA' OR (f.saldo > 0 AND CURRENT_DATE > f.fecha_vencimiento)) AS esta_vencida,
  f.fecha_ultimo_pago
FROM thermoplastica.fact_cxp_factura f
JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id;

COMMENT ON VIEW analitica.v_cxp IS
'Cuentas por pagar reales (deuda con proveedores). Grano: una fila = una factura.
Montos GTQ. saldo = lo que aun se debe. estado: CANCELADA (pagada), VIGENTE,
ATRASADA. Para deuda pendiente filtrar saldo > 0. Calculos contra CURRENT_DATE.';

-- ---------------------------------------------------------------------------
-- v_inventario  —  ultimo snapshot por articulo
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_inventario CASCADE;
CREATE VIEW analitica.v_inventario AS
SELECT DISTINCT ON (s.articulo_id)
  s.articulo_id,
  a.codigo_articulo, a.descripcion AS articulo, a.linea, a.categoria,
  s.stock_actual, s.stock_en_transito,
  s.costo_promedio, s.costo_ultimo,
  s.precio_venta_1, s.valor_inventario, s.margen_bruto_pct,
  s.fecha_snapshot
FROM thermoplastica.fact_inventario_snapshot s
JOIN thermoplastica.dim_articulo a ON a.articulo_id = s.articulo_id
ORDER BY s.articulo_id, s.fecha_snapshot DESC;

COMMENT ON VIEW analitica.v_inventario IS
'Inventario: ultimo snapshot por articulo. Grano: una fila = un articulo.
stock_actual en unidades; valor_inventario en GTQ (stock por costo).
precio_venta_1 es el precio de lista principal. Para "valor del inventario"
sumar valor_inventario.';

-- ---------------------------------------------------------------------------
-- v_compras  —  lineas de compra
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_compras CASCADE;
CREATE VIEW analitica.v_compras AS
SELECT
  f.compra_id, f.fact_num, f.fecha_emision,
  d.anio, d.mes, d.anio_mes,
  p.nombre AS proveedor, p.proveedor_id,
  a.descripcion AS articulo, a.linea, a.categoria,
  f.unidades, f.total_sin_iva AS compras, f.es_gasto_operativo, f.saldo
FROM thermoplastica.fact_compras_linea f
JOIN thermoplastica.dim_proveedor p ON p.proveedor_id = f.proveedor_id
JOIN thermoplastica.dim_articulo  a ON a.articulo_id  = f.articulo_id
LEFT JOIN thermoplastica.dim_fecha d ON d.fecha       = f.fecha_emision;

COMMENT ON VIEW analitica.v_compras IS
'Lineas de compra a proveedores. Grano: una fila = una linea de factura de compra.
Montos GTQ sin IVA. compras = total_sin_iva. es_gasto_operativo distingue compra
de mercaderia (false) de gasto operativo (true).';

-- ---------------------------------------------------------------------------
-- v_calidad_datos  —  reescrita para el dataset real
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_calidad_datos CASCADE;
CREATE VIEW analitica.v_calidad_datos AS
SELECT * FROM (VALUES
  ('general', 'fuente de datos real',
   'Los datos vienen del ERP de Thermoplastica (schema thermoplastica), actualizados a pocos dias. Se puede usar CURRENT_DATE para vencimientos y antiguedad.', 'info'),
  ('v_cxc', 'forma_pago es el sector, no la forma de pago',
   'La columna origen forma_pago en realidad clasifica el sector del cliente (Farmaceutica, Comercio, etc.). Se expone como sector_cliente.', 'medio'),
  ('v_cxc/v_cxp', 'la mayoria de facturas estan canceladas',
   'El grueso de las filas tiene estado CANCELADA (historico pagado). Para cartera o deuda pendiente filtrar saldo > 0.', 'alto'),
  ('bancos y SAT', 'no disponibles en el dataset real',
   'El dataset real no incluye saldos bancarios, flujo de caja, runway ni obligaciones SAT. Si preguntan por eso, responder que no esta disponible en los datos actuales.', 'alto'),
  ('v_ventas', 'margen porcentual no se promedia',
   'Para el margen % de un grupo usar sum(margen_bruto)/sum(ventas)*100, nunca avg(margen_bruto_pct).', 'medio')
) AS t(entidad, problema, detalle, severidad);

COMMENT ON VIEW analitica.v_calidad_datos IS
'Notas de calidad e interpretacion del dataset real. Consultar ante dudas de
grano, filtros o cuando una pregunta toque bancos/SAT (no disponibles).';

-- ---------------------------------------------------------------------------
-- Permisos: el agente lee las vistas nuevas
-- ---------------------------------------------------------------------------
DO $perm$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agente_ia') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA analitica TO agente_ia';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA analitica TO agente_ia';
    RAISE NOTICE 'Permisos actualizados para agente_ia';
  END IF;
END
$perm$;
