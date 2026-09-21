# Capa semántica para el agente de IA — Fase 1

Schema `analitica`: 9 vistas documentadas que encapsulan la lógica de negocio.
El agente consulta **solo este schema**, nunca las tablas crudas de `public`.

## Por qué existe

Sin esta capa, el modelo re-deriva la lógica en cada pregunta y le sale distinto
cada vez. Con ella, la lógica está escrita una sola vez y el modelo solo elige
qué consultar. Es lo que mueve la precisión de ~40% a ~90%.

Los `COMMENT ON VIEW` no son documentación decorativa: **son el prompt del
esquema**. El agente los lee para entender qué significa cada campo.
Si cambia una regla de negocio, se cambia ahí y en ningún otro lado.

## Las vistas

| Vista | Qué contiene |
|---|---|
| `v_meta` | Fecha de corte del dataset. **Leer siempre primero.** |
| `v_cxc` | Cartera por cobrar con aging (135 facturas, 15 clientes) |
| `v_cxp` | Deuda con proveedores con urgencia (105 facturas) |
| `v_transacciones` | 480 movimientos clasificados (venta vs cobranza vs gasto) |
| `v_resultados_mensuales` | Ventas, gastos, margen y flujo por mes |
| `v_bancos` | 9 cuentas, GTQ y USD sin mezclar |
| `v_obligaciones_sat` | 42 obligaciones fiscales |
| `v_kpis` | Snapshot ejecutivo de una fila |
| `v_calidad_datos` | Huecos conocidos, para que el agente diga "no sé" |

## Hallazgos del esquema real

Salieron al inspeccionar la base en producción. Las vistas ya los manejan.

**1. Los datos tienen 6 meses de rezago.**
Llegan hasta 2026-03-30; hoy es 2026-09-21. Si el agente calculara vencimientos
contra `CURRENT_DATE`, la cartera saldría con hasta **294 días** de atraso y
"últimos 30 días" devolvería cero. Por eso existe `v_meta.fecha_corte`
(= 2026-03-31), que además **reproduce exactamente** la columna `dias_atraso`
ya almacenada: 135 de 135 filas coinciden.

**2. No todas las entradas son ventas.**
`Cobros CxC` (Q5,913,388 en 73 movimientos) es el cobro de una factura emitida
antes, no una venta nueva. Sumarlo junto a las ventas **sobreestima los ingresos
en casi 6 millones**. Igual pasa con `Pagos CxP` del lado de los gastos.
`v_transacciones` los separa con `es_venta` / `es_gasto`.

**3. El catálogo contable no sirve.**
`transacciones.cuenta_id` está 100% en NULL y `cuentas_contables` está vacía.
La categoría real vive embebida en el texto de `concepto`, con formato
`"Categoría - YYYY-MM-DD"`. La vista la extrae con `split_part`.

**4. Febrero 2026 no existe.**
Cero transacciones. Marzo tiene 153 movimientos contra ~82 de un mes normal,
probablemente absorbió febrero. Un agente sin esta advertencia reportaría
"las ventas cayeron 100% en febrero". Documentado en `v_calidad_datos`.

**5. Siete tablas están vacías.**
`movimientos_bancarios`, `cuentas_contables`, `saldos_cuentas`, `asientos`,
`conciliaciones`, `cierres_mensuales`, `alertas_financieras`.
Conciliación bancaria y estados financieros contables **no son posibles** hoy.

**6. GTQ y USD sin tipo de cambio.**
6 cuentas en quetzales, 3 en dólares, sin tasa de conversión. Nunca sumarlas.

## Cómo aplicarlo

**Paso 1 — crear las vistas** (seguro, no toca datos):

```bash
cd backend && node database/run-sql-migrations.js
```

**Paso 2 — crear el usuario de solo lectura.** Editar
`database/setup/rol_agente_ia.sql` y reemplazar `CAMBIAR_ESTA_PASSWORD`, luego:

```bash
psql "$DATABASE_URL" -f database/setup/rol_agente_ia.sql
```

El script termina con tres verificaciones que deben dar `true`:
puede leer `v_cxc`, **no** puede leer `public.transacciones`,
**no** puede crear objetos.

**Paso 3 — guardar la cadena de conexión** como `DATABASE_URL_READONLY` en las
variables de entorno de Render, con el usuario `agente_ia`.

## El candado

El rol `agente_ia` tiene: `CONNECT` a la base, `USAGE` sobre `analitica`,
`SELECT` sobre sus vistas. Nada más.

Se le revoca todo sobre `public`, se le prohíbe `CREATE`, y trae fijados
`search_path = analitica`, `statement_timeout = 5s` y
`default_transaction_read_only = on`.

Aunque el modelo generara `DROP TABLE transacciones` y la validación del
código fallara, Postgres lo rechaza: el rol no tiene el permiso y el nombre
ni siquiera resuelve con ese `search_path`.

## Verificación rápida

```sql
SELECT * FROM analitica.v_meta;
SELECT bucket_aging, count(*), sum(monto_pendiente) FROM analitica.v_cxc GROUP BY 1;
SELECT * FROM analitica.v_kpis;
SELECT * FROM analitica.v_calidad_datos WHERE severidad = 'alto';
```

Valores esperados (validados contra producción el 2026-09-21):

- `fecha_corte` = 2026-03-31, `dias_de_rezago` = 174
- Aging: corriente 45 facturas / Q1,304,553 · 1-30: 36 · 31-60: 30 · 61-90: 11 · 90+: 13
- Total cartera Q7,331,000, de la cual Q6,026,447 vencida
- CxP Q13,603,743 · efectivo Q5,310,000 GTQ + $555,000 USD · runway 60 días
