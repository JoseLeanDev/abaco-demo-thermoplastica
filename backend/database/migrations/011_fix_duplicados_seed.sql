-- ============================================================================
-- 011_fix_duplicados_seed.sql
--
-- El seed corrio 3 veces el 2026-09-04 (23:45, 23:54 y 23:56) e inserto las
-- mismas filas cada vez en dos tablas:
--
--   cuentas_bancarias  9 filas  =  3 cuentas reales x 3
--   obligaciones_sat  42 filas  = 14 obligaciones reales x 3
--
-- Consecuencia: v_kpis reportaba el TRIPLE del efectivo (Q5,310,000 en vez de
-- Q1,770,000) y por lo tanto un runway de 60 dias cuando el real es 20.
-- Exactamente el tipo de cifra equivocada que se ve creible.
--
-- cuentas_cobrar, cuentas_pagar y transacciones NO estan duplicadas: se
-- verificaron y sus totales son correctos.
--
-- Este arreglo NO borra datos. Deduplica en la vista, quedandose con la fila
-- de id mas bajo. Si algun dia se limpia la tabla origen, la vista sigue
-- funcionando igual.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- v_bancos: una fila por cuenta real
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW analitica.v_bancos AS
SELECT DISTINCT ON (b.numero_cuenta, b.moneda)
  b.id, b.empresa_id, b.banco, b.tipo, b.moneda, b.saldo,
  b.numero_cuenta, b.activa, b.ultima_conciliacion
FROM public.cuentas_bancarias b
ORDER BY b.numero_cuenta, b.moneda, b.id;

COMMENT ON VIEW analitica.v_bancos IS
'Cuentas bancarias y sus saldos. 3 cuentas reales: 2 en GTQ (Banco Industrial
y BAC Credomatic) y 1 en USD (Banco Agromercantil).
La tabla origen tiene cada cuenta repetida 3 veces porque el seed corrio tres
veces; esta vista deduplica por numero de cuenta. Si alguien consulta la tabla
cruda, vera el triple del efectivo real.
IMPORTANTE: los saldos NO estan convertidos a una moneda comun. Para el total
de efectivo sumar por moneda por separado y decirlo explicitamente. Nunca
sumar GTQ y USD en una sola cifra.
Ninguna cuenta tiene fecha de ultima conciliacion registrada.
La tabla movimientos_bancarios esta vacia, asi que no es posible hacer
conciliacion bancaria ni reconstruir el historico de saldos.';

-- ---------------------------------------------------------------------------
-- v_obligaciones_sat: una fila por obligacion real
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW analitica.v_obligaciones_sat AS
SELECT DISTINCT ON (o.tipo, o.periodo, o.fecha_vencimiento)
  o.id, o.empresa_id, o.tipo AS obligacion, o.periodo,
  o.fecha_vencimiento, o.estado, o.monto_estimado,
  o.fecha_vencimiento - m.fecha_corte  AS dias_para_vencer,
  (o.fecha_vencimiento < m.fecha_corte) AS esta_vencida
FROM public.obligaciones_sat o
CROSS JOIN analitica.v_meta m
ORDER BY o.tipo, o.periodo, o.fecha_vencimiento, o.id;

COMMENT ON VIEW analitica.v_obligaciones_sat IS
'Obligaciones fiscales ante la SAT de Guatemala. 14 obligaciones reales.
La tabla origen tiene 42 filas porque el seed corrio tres veces; esta vista
deduplica. Sumar la tabla cruda triplica los montos.
obligacion describe el tramite (Declaracion IVA mensual, cuotas trimestrales
de ISR, IETU trimestral, declaraciones anuales). estado toma los valores
pendiente y atrasada. monto_estimado en GTQ es una proyeccion, no un monto
declarado en firme. Vencimientos de febrero a diciembre 2026.
dias_para_vencer se calcula contra v_meta.fecha_corte.';

-- ---------------------------------------------------------------------------
-- v_calidad_datos: dejar constancia del seed triplicado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW analitica.v_calidad_datos AS
SELECT * FROM (VALUES
  ('transacciones', 'febrero 2026 sin datos',
   'No hay ninguna transaccion en febrero 2026. Es un faltante del dataset, NO una caida de ventas. No graficar como cero sin advertirlo.', 'alto'),
  ('transacciones', 'marzo 2026 incompleto y anomalo',
   'Los datos cortan el 30 de marzo y ese mes tiene 153 movimientos contra ~82 de un mes normal, posiblemente absorbiendo febrero. No comparar marzo contra otros meses sin advertirlo.', 'alto'),
  ('transacciones', 'sin enlace al catalogo contable',
   'La columna cuenta_id esta 100% en NULL y cuentas_contables esta vacia. La categoria se deriva del texto de concepto. No es posible armar balance ni estado de resultados contable.', 'medio'),
  ('movimientos_bancarios', 'tabla vacia',
   'Cero filas. No es posible hacer conciliacion bancaria ni reconstruir el historico de saldos. Si preguntan por conciliacion, responder que no hay datos.', 'alto'),
  ('cuentas_bancarias', 'seed corrido tres veces',
   'La tabla tiene cada cuenta repetida 3 veces (9 filas = 3 cuentas reales). La vista v_bancos ya deduplica. Nunca consultar public.cuentas_bancarias directamente: triplica el efectivo.', 'alto'),
  ('obligaciones_sat', 'seed corrido tres veces',
   'La tabla tiene cada obligacion repetida 3 veces (42 filas = 14 reales). La vista v_obligaciones_sat ya deduplica.', 'alto'),
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
bancaria, efectivo disponible o cualquier cosa que suene a contabilidad formal.
Si una limitacion aplica a la pregunta, decirla explicitamente en la respuesta
en vez de producir un numero que parezca valido. severidad alto significa que
responder sin advertirlo produce una conclusion equivocada.';
