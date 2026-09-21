-- ============================================================================
-- 010_capa_semantica.sql
-- Capa semantica para el agente de IA (Fase 1)
--
-- Crea el schema "analitica" con vistas documentadas que encapsulan la logica
-- de negocio. El agente SOLO consulta este schema, nunca las tablas crudas.
--
-- Cada vista lleva COMMENT ON: ese texto es lo que el agente lee para entender
-- que significa cada campo. Si cambia la logica, se cambia aqui y en un solo
-- lugar, no en el prompt.
--
-- Idempotente: se puede correr varias veces sin romper nada.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analitica;

COMMENT ON SCHEMA analitica IS
'Capa semantica de solo lectura para el agente de IA. Contiene vistas con la
logica de negocio ya resuelta (aging, clasificacion de transacciones, KPIs).
El agente consulta unicamente este schema.';

-- ---------------------------------------------------------------------------
-- 1. v_meta  —  Metadatos del dataset. LA VISTA MAS IMPORTANTE.
-- ---------------------------------------------------------------------------
-- Los datos de Thermoplastica llegan hasta 2026-03-30. Si el agente calcula
-- vencimientos contra CURRENT_DATE, toda la cartera aparece con 290+ dias de
-- atraso y los ultimos 30 dias salen en cero. Todo calculo temporal usa
-- fecha_corte, no CURRENT_DATE.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_meta CASCADE;
CREATE VIEW analitica.v_meta AS
SELECT
  (SELECT max(fecha) + 1 FROM public.transacciones)        AS fecha_corte,
  (SELECT max(fecha)     FROM public.transacciones)        AS ultima_transaccion,
  (SELECT min(fecha)     FROM public.transacciones)        AS primera_transaccion,
  CURRENT_DATE                                             AS fecha_real_hoy,
  CURRENT_DATE - (SELECT max(fecha) FROM public.transacciones) AS dias_de_rezago,
  'GTQ'::text                                              AS moneda_base;

COMMENT ON VIEW analitica.v_meta IS
'Metadatos del dataset. Una sola fila. LEER SIEMPRE ANTES DE CUALQUIER CALCULO
CON FECHAS. fecha_corte es la fecha de referencia del dataset (dia siguiente a
la ultima transaccion registrada). Todo calculo de antiguedad, vencimiento o
"ultimos N dias" debe usar fecha_corte, NUNCA CURRENT_DATE: los datos tienen
rezago respecto al dia real y usar CURRENT_DATE produce resultados absurdos.
dias_de_rezago indica cuanto tiempo lleva sin actualizarse la informacion.
Moneda base GTQ (quetzales).';

-- ---------------------------------------------------------------------------
-- 2. v_cxc  —  Cuentas por cobrar con aging calculado
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_cxc CASCADE;
CREATE VIEW analitica.v_cxc AS
SELECT
  c.id,
  c.empresa_id,
  c.cliente_nombre                                  AS cliente,
  c.factura_numero,
  c.monto_total,
  c.monto_pendiente,
  c.monto_total - c.monto_pendiente                 AS monto_cobrado,
  c.fecha_emision,
  c.fecha_vencimiento,
  c.estado,
  GREATEST(m.fecha_corte - c.fecha_vencimiento, 0)  AS dias_vencido,
  (m.fecha_corte > c.fecha_vencimiento)             AS esta_vencida,
  CASE
    WHEN m.fecha_corte <= c.fecha_vencimiento           THEN 'corriente'
    WHEN m.fecha_corte -  c.fecha_vencimiento <= 30     THEN '1-30'
    WHEN m.fecha_corte -  c.fecha_vencimiento <= 60     THEN '31-60'
    WHEN m.fecha_corte -  c.fecha_vencimiento <= 90     THEN '61-90'
    ELSE '90+'
  END                                               AS bucket_aging,
  c.fecha_vencimiento - c.fecha_emision             AS plazo_credito_dias
FROM public.cuentas_cobrar c
CROSS JOIN analitica.v_meta m;

COMMENT ON VIEW analitica.v_cxc IS
'Cuentas por cobrar (cartera de clientes). Una fila = una factura emitida.
Montos en GTQ. monto_pendiente es lo que aun se debe; monto_total es el valor
original de la factura. Para "cuanto me deben" sumar monto_pendiente, NUNCA
monto_total. dias_vencido y bucket_aging se calculan contra v_meta.fecha_corte.
bucket_aging toma los valores: corriente, 1-30, 31-60, 61-90, 90+.
El campo estado viene del sistema origen y solo toma dos valores:
al_corriente (aun no vence) y atrasada (ya vencio). No existe el valor pagada:
las facturas cobradas no permanecen en esta tabla.
Hay 135 facturas de 15 clientes distintos. plazo_credito_dias es el plazo
otorgado al cliente (vencimiento menos emision).';

-- ---------------------------------------------------------------------------
-- 3. v_cxp  —  Cuentas por pagar
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_cxp CASCADE;
CREATE VIEW analitica.v_cxp AS
SELECT
  p.id,
  p.empresa_id,
  p.proveedor_nombre                                AS proveedor,
  p.factura_numero,
  p.monto_total,
  p.monto_pendiente,
  p.fecha_emision,
  p.fecha_vencimiento,
  p.estado,
  p.fecha_vencimiento - m.fecha_corte               AS dias_para_vencer,
  GREATEST(m.fecha_corte - p.fecha_vencimiento, 0)  AS dias_vencido,
  (m.fecha_corte > p.fecha_vencimiento)             AS esta_vencida,
  CASE
    WHEN p.fecha_vencimiento <  m.fecha_corte           THEN 'vencida'
    WHEN p.fecha_vencimiento -  m.fecha_corte <= 7      THEN 'vence_7_dias'
    WHEN p.fecha_vencimiento -  m.fecha_corte <= 30     THEN 'vence_30_dias'
    ELSE 'mas_de_30_dias'
  END                                               AS urgencia
FROM public.cuentas_pagar p
CROSS JOIN analitica.v_meta m;

COMMENT ON VIEW analitica.v_cxp IS
'Cuentas por pagar (deuda con proveedores). Una fila = una factura recibida.
Montos en GTQ. dias_para_vencer es negativo si la factura ya vencio.
urgencia toma los valores: vencida, vence_7_dias, vence_30_dias,
mas_de_30_dias, calculados contra v_meta.fecha_corte.
El campo estado solo toma el valor pendiente en los datos actuales.
Hay 105 facturas de 15 proveedores distintos.';

-- ---------------------------------------------------------------------------
-- 4. v_transacciones  —  Movimientos de caja CLASIFICADOS
-- ---------------------------------------------------------------------------
-- OJO: la columna cuenta_id de public.transacciones esta 100% en NULL y la
-- tabla cuentas_contables esta vacia. La categoria real vive embebida en el
-- texto de concepto, con formato "Categoria - YYYY-MM-DD". Aqui se extrae.
--
-- Y lo mas importante: NO todas las entradas son ventas. "Cobros CxC" es el
-- cobro de una factura emitida antes; sumarlo junto a las ventas duplica los
-- ingresos. Lo mismo con "Pagos CxP" del lado de las salidas.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_transacciones CASCADE;
CREATE VIEW analitica.v_transacciones AS
SELECT
  t.id,
  t.empresa_id,
  t.fecha,
  date_trunc('month', t.fecha)::date        AS mes,
  t.tipo,
  t.monto,
  trim(split_part(t.concepto, ' - ', 1))    AS categoria,
  t.concepto,
  CASE
    WHEN t.tipo = 'entrada' AND trim(split_part(t.concepto,' - ',1)) = 'Cobros CxC'
      THEN 'cobranza'
    WHEN t.tipo = 'entrada' AND trim(split_part(t.concepto,' - ',1)) IN ('Intereses bancarios','Otros ingresos')
      THEN 'ingreso_no_operativo'
    WHEN t.tipo = 'entrada'
      THEN 'venta_operativa'
    WHEN t.tipo = 'salida'  AND trim(split_part(t.concepto,' - ',1)) = 'Pagos CxP'
      THEN 'pago_proveedor'
    ELSE 'gasto_operativo'
  END                                       AS clasificacion,
  (t.tipo = 'entrada' AND trim(split_part(t.concepto,' - ',1))
       NOT IN ('Cobros CxC','Intereses bancarios','Otros ingresos'))  AS es_venta,
  (t.tipo = 'salida'  AND trim(split_part(t.concepto,' - ',1)) <> 'Pagos CxP') AS es_gasto
FROM public.transacciones t
WHERE t.estado = 'activa';

COMMENT ON VIEW analitica.v_transacciones IS
'Movimientos de caja clasificados. Una fila = un movimiento. Montos en GTQ,
siempre positivos: el signo lo da tipo (entrada / salida).
Rango de datos: 2025-10-01 a 2026-03-30. 480 movimientos.

REGLA CRITICA PARA NO DUPLICAR INGRESOS: no todas las entradas son ventas.
clasificacion separa cinco casos:
  venta_operativa      = venta real de producto o servicio (usar para ventas)
  cobranza             = cobro de una factura ya registrada antes (Cobros CxC),
                         es movimiento de caja pero NO es venta nueva
  ingreso_no_operativo = intereses bancarios y otros ingresos
  gasto_operativo      = gasto real (nomina, resinas, servicios, impuestos)
  pago_proveedor       = pago de una factura ya registrada (Pagos CxP),
                         salida de caja pero NO es gasto nuevo
Para VENTAS usar es_venta = true. Para GASTOS usar es_gasto = true.
Para FLUJO DE CAJA usar todas las filas segun tipo.
Sumar todas las entradas como ventas sobreestima los ingresos en ~5.9 millones.

categoria se extrae del texto de concepto. Valores de venta: Venta
termoformados B2B, Venta envases y tapas, Venta liners y sellos de seguridad,
Venta laminaciones, Servicios de maquila. Valores de gasto: Nomina, Compra
resinas plasticas, Servicios publicos (electricidad, agua), Impuestos,
Alquiler planta industrial, Mantenimiento maquinaria termoformado, Transporte
y logistica, Marketing y publicidad, Seguros.

Se excluyen filas con estado distinto de activa.';

-- ---------------------------------------------------------------------------
-- 5. v_resultados_mensuales  —  P&L de caja por mes
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_resultados_mensuales CASCADE;
CREATE VIEW analitica.v_resultados_mensuales AS
SELECT
  mes,
  empresa_id,
  sum(monto) FILTER (WHERE es_venta)                      AS ventas,
  sum(monto) FILTER (WHERE es_gasto)                      AS gastos,
  sum(monto) FILTER (WHERE es_venta)
    - sum(monto) FILTER (WHERE es_gasto)                  AS utilidad,
  ROUND(
    CASE WHEN sum(monto) FILTER (WHERE es_venta) > 0
    THEN (sum(monto) FILTER (WHERE es_venta) - sum(monto) FILTER (WHERE es_gasto))
         / sum(monto) FILTER (WHERE es_venta) * 100
    END, 2)                                               AS margen_pct,
  sum(monto) FILTER (WHERE tipo = 'entrada')              AS entradas_caja,
  sum(monto) FILTER (WHERE tipo = 'salida')               AS salidas_caja,
  sum(monto) FILTER (WHERE tipo = 'entrada')
    - sum(monto) FILTER (WHERE tipo = 'salida')           AS flujo_neto_caja,
  count(*)                                                AS num_movimientos
FROM analitica.v_transacciones
GROUP BY mes, empresa_id;

COMMENT ON VIEW analitica.v_resultados_mensuales IS
'Resultados por mes. Una fila = un mes. Montos en GTQ.
ventas y gastos excluyen cobranzas y pagos de facturas para no duplicar
(ver v_transacciones). margen_pct = utilidad / ventas * 100.
flujo_neto_caja si incluye todo el movimiento de efectivo del mes, por eso
puede diferir de utilidad: son dos medidas distintas y ambas son correctas.
Cubre de octubre 2025 a marzo 2026, con DOS HUECOS CONOCIDOS que hay que
advertir al usuario en cualquier analisis de tendencia:
  - FEBRERO 2026 NO EXISTE: cero transacciones registradas. No es una caida
    de ventas, es un faltante de datos. Nunca interpretarlo como desplome ni
    graficarlo como cero sin decirlo.
  - MARZO 2026 esta incompleto (corta el dia 30) y ademas concentra 153
    movimientos contra ~82 de un mes normal, probablemente porque absorbio
    los registros de febrero. Comparar marzo contra otros meses es enganoso.
Consultar analitica.v_calidad_datos antes de responder sobre tendencias.';

-- ---------------------------------------------------------------------------
-- 6. v_bancos
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_bancos CASCADE;
CREATE VIEW analitica.v_bancos AS
SELECT
  b.id, b.empresa_id, b.banco, b.tipo, b.moneda, b.saldo,
  b.numero_cuenta, b.activa, b.ultima_conciliacion
FROM public.cuentas_bancarias b;

COMMENT ON VIEW analitica.v_bancos IS
'Cuentas bancarias y sus saldos. 9 cuentas: 6 en GTQ y 3 en USD.
IMPORTANTE: los saldos NO estan convertidos a una moneda comun. Para el total
de efectivo hay que sumar por moneda por separado y decirlo explicitamente.
Nunca sumar GTQ y USD en una sola cifra.
La tabla movimientos_bancarios esta vacia, asi que no es posible hacer
conciliacion bancaria ni reconstruir el historico de saldos.';

-- ---------------------------------------------------------------------------
-- 7. v_obligaciones_sat
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_obligaciones_sat CASCADE;
CREATE VIEW analitica.v_obligaciones_sat AS
SELECT
  o.id, o.empresa_id, o.tipo AS obligacion, o.periodo,
  o.fecha_vencimiento, o.estado, o.monto_estimado,
  o.fecha_vencimiento - m.fecha_corte  AS dias_para_vencer,
  (o.fecha_vencimiento < m.fecha_corte) AS esta_vencida
FROM public.obligaciones_sat o
CROSS JOIN analitica.v_meta m;

COMMENT ON VIEW analitica.v_obligaciones_sat IS
'Obligaciones fiscales ante la SAT de Guatemala. 42 registros.
obligacion describe el tramite (Declaracion IVA mensual, cuotas trimestrales
de ISR, IETU trimestral, declaraciones anuales). estado toma los valores
pendiente y atrasada. monto_estimado en GTQ es una proyeccion, no un monto
declarado en firme. Vencimientos de febrero a diciembre 2026.
dias_para_vencer se calcula contra v_meta.fecha_corte.';

-- ---------------------------------------------------------------------------
-- 8. v_kpis  —  Snapshot ejecutivo, una sola fila
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_kpis CASCADE;
CREATE VIEW analitica.v_kpis AS
WITH m AS (SELECT * FROM analitica.v_meta),
ult30 AS (
  SELECT
    sum(monto) FILTER (WHERE es_venta) AS ventas_30d,
    sum(monto) FILTER (WHERE es_gasto) AS gastos_30d
  FROM analitica.v_transacciones, m
  WHERE fecha > m.fecha_corte - 30
),
cartera AS (
  SELECT
    sum(monto_pendiente)                                AS cxc_total,
    count(*)                                            AS cxc_facturas,
    sum(monto_pendiente) FILTER (WHERE esta_vencida)    AS cxc_vencida,
    ROUND(avg(dias_vencido) FILTER (WHERE esta_vencida), 1) AS dias_prom_atraso
  FROM analitica.v_cxc
),
deuda AS (
  SELECT sum(monto_pendiente) AS cxp_total, count(*) AS cxp_facturas,
         sum(monto_pendiente) FILTER (WHERE fecha_vencimiento <= (SELECT fecha_corte FROM m) + 30) AS cxp_vence_30d
  FROM analitica.v_cxp
),
caja AS (
  SELECT sum(saldo) FILTER (WHERE moneda = 'GTQ') AS efectivo_gtq,
         sum(saldo) FILTER (WHERE moneda = 'USD') AS efectivo_usd
  FROM analitica.v_bancos WHERE activa IS NOT FALSE
)
SELECT
  m.fecha_corte, m.dias_de_rezago,
  caja.efectivo_gtq, caja.efectivo_usd,
  ult30.ventas_30d, ult30.gastos_30d,
  ult30.ventas_30d - ult30.gastos_30d AS utilidad_30d,
  cartera.cxc_total, cartera.cxc_facturas, cartera.cxc_vencida, cartera.dias_prom_atraso,
  deuda.cxp_total, deuda.cxp_facturas, deuda.cxp_vence_30d,
  cartera.cxc_total - deuda.cxp_total AS capital_trabajo_neto,
  CASE WHEN ult30.gastos_30d > 0
       THEN ROUND(caja.efectivo_gtq / (ult30.gastos_30d / 30.0), 0) END AS runway_dias
FROM m, ult30, cartera, deuda, caja;

COMMENT ON VIEW analitica.v_kpis IS
'Snapshot ejecutivo. Una sola fila. Usar para preguntas generales del tipo
como vamos o dame los KPIs. Montos en GTQ salvo efectivo_usd.
Las ventanas de 30 dias se miden hacia atras desde v_meta.fecha_corte, no
desde hoy. runway_dias = efectivo GTQ dividido entre el gasto diario promedio
de los ultimos 30 dias; es una estimacion de cuantos dias alcanza el efectivo
al ritmo de gasto actual, y solo considera quetzales.
capital_trabajo_neto = cartera por cobrar menos deuda con proveedores.';

-- ---------------------------------------------------------------------------
-- 9. v_calidad_datos  —  Huecos y limitaciones conocidas del dataset
-- ---------------------------------------------------------------------------
-- Esta vista existe para que el agente pueda DECIR QUE NO SABE en vez de
-- inventar una explicacion de negocio para lo que en realidad es un faltante.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS analitica.v_calidad_datos CASCADE;
CREATE VIEW analitica.v_calidad_datos AS
SELECT * FROM (VALUES
  ('transacciones', 'febrero 2026 sin datos',
   'No hay ninguna transaccion en febrero 2026. Es un faltante del dataset, NO una caida de ventas. No graficar como cero sin advertirlo.', 'alto'),
  ('transacciones', 'marzo 2026 incompleto y anomalo',
   'Los datos cortan el 30 de marzo y ese mes tiene 153 movimientos contra ~82 de un mes normal, posiblemente absorbiendo febrero. No comparar marzo contra otros meses sin advertirlo.', 'alto'),
  ('transacciones', 'sin enlace al catalogo contable',
   'La columna cuenta_id esta 100% en NULL y cuentas_contables esta vacia. La categoria se deriva del texto de concepto. No es posible armar balance ni estado de resultados contable.', 'medio'),
  ('movimientos_bancarios', 'tabla vacia',
   'Cero filas. No es posible hacer conciliacion bancaria ni reconstruir el historico de saldos. Si preguntan por conciliacion, responder que no hay datos.', 'alto'),
  ('cuentas_bancarias', 'monedas mezcladas sin tipo de cambio',
   'Saldos en GTQ y USD sin tasa de conversion. Reportar siempre por separado.', 'medio'),
  ('cuentas_cobrar', 'no guarda historico de pagos',
   'Solo existe el saldo pendiente actual. No es posible calcular DSO real ni analizar evolucion del comportamiento de pago por cliente.', 'medio'),
  ('general', 'datos con rezago',
   'La informacion llega hasta el 30 de marzo de 2026. Toda referencia a hoy, este mes o ultimos 30 dias debe medirse contra v_meta.fecha_corte y aclararse al usuario.', 'alto')
) AS t(entidad, problema, detalle, severidad);

COMMENT ON VIEW analitica.v_calidad_datos IS
'Catalogo de huecos y limitaciones conocidas de los datos. CONSULTAR ANTES DE
responder preguntas sobre tendencias, comparativos entre meses, conciliacion
bancaria o cualquier cosa que suene a contabilidad formal. Si una limitacion
aplica a la pregunta, decirla explicitamente en la respuesta en vez de
producir un numero que parezca valido. severidad alto significa que responder
sin advertirlo produce una conclusion equivocada.';

-- ---------------------------------------------------------------------------
-- Permisos para el agente
-- ---------------------------------------------------------------------------
-- El rol agente_ia se crea en database/setup/rol_agente_ia.sql (requiere password).
-- Aqui solo se dejan preparados los permisos por si el rol ya existe.
DO $perm$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agente_ia') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA analitica TO agente_ia';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA analitica TO agente_ia';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA analitica GRANT SELECT ON TABLES TO agente_ia';
    RAISE NOTICE 'Permisos otorgados a agente_ia';
  ELSE
    RAISE NOTICE 'Rol agente_ia no existe todavia. Correr database/setup/rol_agente_ia.sql';
  END IF;
END
$perm$;
