# CPP de Laminados: histórico y aplicación general

Implementación del 21 de octubre de 2026, autorizada por José para recuperar el
histórico y extender únicamente Laminados al resto de la aplicación.

**Estado al 22-oct-2026:** la corrección de Laminados está implementada y publicada,
con histórico recuperado e integración en totales generales y módulos. La
conciliación contra el Excel fue validada para enero–septiembre de 2026 con las
excepciones documentadas abajo; no significa coincidencia del 100% con el archivo.
Empaques para alimentos, Tapas y Valvulas e Inyectables siguen sin activar su CPP.
Transformación se trabajará por separado.

## Datos recuperados y alcance

- Ventas originales de Laminados desde el 1 de enero de 2024 hasta la fecha.
- Compras desde el 1 de enero de 2023, para cubrir los respaldos A−1 de ventas
  de 2024. Se consultan las categorías necesarias para Laminados; las compras
  de otras líneas que participan en esos grupos se conservan con su clasificación
  original, sin cambiar sus cálculos de rentabilidad.
- Extracción inicial: 3,771 filas de venta y 676 de compra. Publicación de 3,160
  combinaciones factura/tipo/sucursal/artículo, sin ventas internas.
- Snapshot completo nuevo en cada `/daily` existente. Captura cambios antiguos
  fuera de los 7 días de compras y los 90 días de ventas del incremental.
- No se sobreescriben `fact_ventas_linea`, sus costos ERP, compras originales,
  CxC/CxP ni la valuación física del inventario para sustituirlos por CPP.

El cálculo conserva los nueve respaldos, fletes y manuales del PDF. El Excel
comercial incluye también Almacén General/Flexografía; los resultados de la
línea Laminados de la aplicación no se equiparan a ese alcance más amplio.
Las otras líneas mantienen ERP; no se activa aún su cálculo por compras propias.

## Fuente única y actualización

`cpp_laminados_importacion` guarda las filas físicas completas como JSONB,
fechas cubiertas y extracción/publicación. Una extracción fallida no publica
una carga parcial. Los archivos `ingesta/laminados_snapshot.py` y
`ingesta/instalar_laminados.py` versionan la recuperación y el parche idempotente
al worker de `/opt/thermoplastica/worker`. El instalador respalda ETL/Dockerfile
antes del cambio. La llamada se agrega dentro del lock de `/daily`.

`laminadosPublicacion.js` calcula con `cpp.js`, agrupa las filas físicas y publica
fuente activa y costos juntos, en una transacción con advisory lock. Da de alta
solo dimensiones faltantes; no reescribe las existentes. El servicio web revisa
al iniciar y cada cinco minutos si existe una extracción nueva. Al cambiar el
cierre mensual también recalcula. Los cortes anteriores se pueden auditar con
el endpoint específico y `corte_cpp`.

`cpp_laminados_clave` conserva claves de registros Laminados históricos, incluso
los ausentes del ERP actual. `v_ventas_costeadas` sustituye únicamente esas claves
por la publicación vigente, evitando que el upsert incremental reviva facturas
antiguas. Las demás filas son idénticas a las originales. Cada línea CPP conserva
su fuente de costo para auditoría en `cpp_laminados_venta.fuente_cpp`.

`analitica.margen_comercial` es el agregado común para pantallas y agentes:

- Laminados: costo MP y margen conocidos, sin extrapolar ventas sin CPP.
- Otras líneas: porcentaje ERP conocido y extrapolación anterior, dentro de ese
  bloque. Ese porcentaje nunca se aplica a las ventas de Laminados.
- Total: suma de ambos márgenes / (ventas Laminados con CPP + base del bloque ERP).
- Los faltantes permanecen N/D. Las devoluciones con costo negativo conservan signo.
- Las ventas del mes abierto permanecen visibles; su CPP está pendiente hasta
  cerrar el mes. No se sustituye con costo ERP ni se infla el margen a 100%.

Se integró en Ventas, Márgenes, Panel general, Análisis, Salud financiera,
rotación, Tesorería/clientes, movimientos de Inventario, datos de Compras/Gastos
y vistas del agente. En Inventario el margen de Laminados es el realizado del
período; su stock y valuación conservan el costo ERP. No hay ventas sintéticas.

## Verificación

Enero–septiembre 2026, línea original Laminados:

| Medida | Resultado |
|---|---:|
| Ventas sin IVA | Q29,705,729.94 |
| Ventas con CPP | Q29,669,992.63 |
| Ventas sin CPP | Q35,737.31 |
| Costo MP | Q20,703,953.26 |
| Margen MP | Q8,966,039.37 |
| Margen MP / ventas con CPP | 30.2192167062% |

El cálculo puro, la publicación SQL, las agrupaciones de vendedores/clientes/
productos/categorías y el rol `agente_ia` coinciden. `validar-cpp-laminados.js`
verifica esa igualdad y que otras líneas no cambien. Además hay 40 pruebas del
CPP/adaptadores, 5 pruebas contra Postgres en READ ONLY y 26 rutas HTTP reales.
La compilación de frontend pasa; conserva avisos preexistentes de tamaño y dos
claves duplicadas. Una prueba HTTP no acredita revisión visual autenticada.

La compra PET 108139 está recuperada. La factura 1092096 usa el importe actual
Q78,916.50. Las facturas 1093405/1093406 ausentes del ERP ya no se incluyen.
Las 9 filas internas de 1091190 también se excluyen según el PDF.

ACLAR sigue pendiente: la referencia del cliente tiene Q64,084.20 más de ventas
que el ERP actual. No se inventa una factura ni se ajusta el CPP para cuadrar.
El PDF no define fletes 2023 para Besel/Basim o Maximore/M&M. Se recuperaron esas compras, pero los grupos que dependan de esa tarifa quedan pendientes; no se extrapola la de otro año. Se verificó que actualmente ningún resultado publicado requiere esa tarifa.

El antecedente completo está en `conciliacion-laminados-2026-09.md`.

## Operación y recuperación

Se aplicaron en producción las migraciones 017, 018, 019 y 020 en transacciones antes del código. No
usar el build de backend que ejecuta seed, ni `/backfill` que trunca otras fuentes.
El build de Render ya compila frontend sin ese seed.

En `backend`, con las variables existentes:

```sh
node scripts/publicar-laminados.js
node scripts/validar-cpp-laminados.js
npm run test:cpp
node --test test/margen-postgres.test.js
```

La publicación manual normalmente no es necesaria: la hace el web service.
El healthcheck existente incluye `laminados_cpp`, con edad de extracción y estado
de publicación. Falla si el snapshot supera 25 horas o queda más de 15 minutos
sin publicar. No se creó otro cron ni se modificó el horario diario.

El snapshot inicial y las extracciones posteriores quedan guardados en Postgres.
El costo ERP original está intacto. Para revertir el método, volver al código
anterior y restaurar las definiciones previas de las vistas analíticas; no borrar
compras/ventas ni recalcular costos ERP. El respaldo inicial de definiciones se
conservó en el expediente local `vistas-originales.json`; el worker respalda sus
archivos en `/opt/thermoplastica/respaldo-cpp-20261021T225811Z`.

## Publicación comprobada

Commit de aplicación `eff3de4`, desplegado automáticamente desde `main`. GitHub
registró `success` para el servicio web (21-oct-2026 23:09:34 UTC) y el scheduler
(23:08:50 UTC). Se comprobó HTTP 200 de `/api/health`, la ruta SPA de Márgenes y
el bundle publicado, con las leyendas nuevas de CPP. El contenedor de ingesta
quedó `running/healthy`; el healthcheck confirmó importación 2 publicada.

Validación: 40 pruebas del calculador/adaptadores, 5 pruebas SQL en READ ONLY,
26 rutas locales con la base real y conciliación comercial de 18/19 categorías
con costo. Los resultados de Laminados también coinciden usando el rol real
`agente_ia`. Se regeneraron los cuatro insights del playbook de márgenes con el
agregado nuevo. La comprobación visual autenticada se completó posteriormente,
como se detalla abajo.

## Conciliación con sesión autenticada y Excel de Jonathan

Revisión del 21 de octubre de 2026, con la sesión del usuario en producción.
Se seleccionó Personalizado, 1-ene-2026 a 30-sept-2026, categoría Laminados.
La pantalla de Márgenes presenta Q29,705,730 de ventas, Q8,966,039 de margen
MP y 30.2%, consistentes con la publicación de Postgres y su redondeo visual.
Se revisaron las vistas por categoría, vendedor y cliente, además de ejemplos
del detalle por producto. Esto cubre esas pantallas observadas; no acredita
por sí solo revisión visual de todos los módulos ni del Excel exportado.

El archivo original `Reporte a septiembre 2026 (1).xlsx` se volvió a leer sin
modificarlo. La comparación numérica independiente dio:

- Los 63 CPP de la hoja `11. Productos Margen Bajo` coinciden con el calculador.
  De ellos, 52 son exclusivamente Laminados y 11 pertenecen a las otras líneas
  incluidas por el Excel. La comparación de esas otras líneas es diagnóstica;
  no activa CPP en su publicación de producción.
- Ejemplos visibles que coinciden con el Excel: M097410155, CPP Q226.05 y margen
  21.0%; M097410110, CPP Q226.05 y margen 23.4%; M077260150, CPP Q65.09 y margen
  23.0%. La pantalla deja M135310210 como N/D por falta de CPP.
- Al reconstruir el alcance más amplio del Excel, 18 de 19 categorías con costo
  coinciden al centavo en costo MP. ACLAR conserva la diferencia de Q64,084.20
  de venta y Q48,001.67 de costo; todavía requiere el detalle documental de ALTIAN.
- Foil de Aluminio coincide en costo, pero tiene Q3,935.46 menos de venta en los
  datos actuales: la factura 1092096 aparece con Q78,916.50 frente a Q82,851.96
  de la referencia. Entre ambos casos, la diferencia comercial de ventas es
  Q68,019.66. No se ajustó el costo para compensarla.
- De los 95 clientes con importe 2026 en la hoja `3. Clientes`, solo EUROFARMA
  y ALTIAN difieren al normalizar espacios y comparar ese mismo alcance.
  De los 12 vendedores del resumen, las diferencias actuales se concentran en
  Sergio Sosa y Virginia Cordón, afectadas por esos casos y por las ventas sin CPP.

Hay dos diferencias de presentación que deben conservarse explícitas:

1. La hoja `11. Productos Margen Bajo` selecciona movimientos con margen menor
   a 25% antes de agruparlos por artículo. Se reprodujeron así ventas y costos
   de 62 de sus 63 filas. El artículo restante, M204570210, cambia porque la
   factura 1092096 queda ahora por debajo del umbral: se incorpora completa
   a esa selección. La tabla de productos de la aplicación muestra el conjunto
   de ventas del artículo y su margen agregado; sus ventas no son directamente
   comparables con ese subconjunto del Excel.
2. El Excel muestra PVC impreso con costo vacío y margen 100% en la hoja 8.
   La aplicación aplica el PDF: N/D y exclusión del denominador del margen.
   Por eso el porcentaje total impreso de la hoja 8 tampoco debe usarse como
   control idéntico sin corregir su tratamiento de los faltantes.

Conclusión de esta revisión: el CPP de los productos contrastados coincide;
la conciliación monetaria completa sigue abierta por los dos casos de ventas
y por las diferencias de alcance y selección descritas. No hubo cambios de
datos ni de código de producción durante esta comprobación.

## Decisión sobre las diferencias — 22 de octubre de 2026

El usuario indicó documentar las diferencias y continuar tomando el ERP como
fuente principal para ventas e importes de facturas. Esta decisión no sustituye
la metodología CPP del PDF por los campos de costo promedio o último costo del
ERP: la fuente de ventas y la regla de cálculo de costos son decisiones distintas.

Registro de diferencias para enero–septiembre de 2026, comparando el mismo
alcance comercial del Excel (incluye Almacén General/Flexografía):

| Caso | Referencia Excel | Fuente ERP usada por la aplicación | Diferencia Excel menos fuente | Tratamiento |
|---|---:|---:|---:|---|
| ACLAR, categoría; diferencia localizada en ALTIAN | Q2,866,730.19 de ventas | Q2,802,645.99 de ventas | Q64,084.20 | Conservar la fuente ERP. Falta el detalle de facturas que explique la diferencia. |
| Factura 1092096, aluminio | Q82,851.96 | Q78,916.50 | Q3,935.46 | Conservar el importe ERP recibido. La causa del cambio no está confirmada. |
| **Total de diferencias de ventas** | — | — | **Q68,019.66** | No crear ventas ni compensar costos para igualar el archivo. |

La diferencia de costo total en ACLAR es Q48,001.67; los CPP unitarios
contrastados coinciden. No se registra como una nueva discrepancia de CPP ni
como una tercera diferencia de ventas. La causa de las diferencias permanece
sin resolver: no está demostrado que el Excel esté equivocado, ni que haya una
anulación, devolución o modificación posterior concreta.

El alcance adicional del Excel, su selección de movimientos con margen menor
al 25% y el 100% mostrado para PVC impreso sin costo se mantienen como diferencias
de criterio, según la sección anterior. No se suman a los Q68,019.66.

Para seguir operando Laminados se conserva el snapshot ERP vigente, su trazabilidad
y el CPP acordado. Los dos casos quedan como excepciones abiertas de conciliación,
sin bloquear por sí solos el trabajo en las líneas siguientes. Si se obtiene el
detalle documental, contrastar fecha, artículo, importe, estado y posibles
devoluciones con la extracción antes de atribuir la causa o cambiar datos.

## Trabajo restante por línea

| Línea | Estado de la corrección |
|---|---|
| Laminados | Implementada, publicada e integrada. Validación del período y límites descritos arriba. |
| Empaques para alimentos | Regla por compras del mismo artículo preparada; falta confirmar unidades de compras/ventas, completar histórico propio y validar antes de activar. |
| Tapas y Valvulas | Mismo estado: compras propias, incluidas anteriores; pendiente unidades, histórico y activación validada. |
| Inyectables | Regla por artículo preparada; pendiente confirmar unidades y validar cobertura histórica y resultados antes de activar. |
| Líneas de transformación | Pendiente: `(ventas - compras + inventario_final - inventario_inicial) / ventas`, con alcance de líneas por confirmar. |

El orden previsto conserva primero las tres líneas comerciales restantes y
después transformación. No usar promedios de otros productos para las tres
líneas por artículo ni asumir que compras y ventas están en la misma medida.
