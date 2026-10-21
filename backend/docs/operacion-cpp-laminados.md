# CPP de Laminados: histórico y aplicación general

Implementación del 21 de octubre de 2026, autorizada por José para recuperar el
histórico y extender únicamente Laminados al resto de la aplicación.

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
