# Conciliación de Laminados — cierre septiembre 2026

**Actualización posterior:** se recuperaron los datos y se integró Laminados a los totales y módulos generales. Ver [operacion-cpp-laminados.md](operacion-cpp-laminados.md). Este documento conserva la comparación anterior a esa recuperación; ACLAR continúa pendiente del detalle del cliente.

Revisión del 21-oct-2026. Comparación de solo lectura entre PostgreSQL, las vistas
actuales de SQL Server TP_A y el reporte de Jonathan. No se modificaron datos
del ERP/Postgres ni se publicaron cambios.

## Método y alcance

La fuente metodológica es el PDF de Jonathan del 21-oct-2026: CPP ponderado de
compras sin IVA, fletes por proveedor/año, nueve niveles en su orden, costos
manuales definidos, exclusión de ventas internas y margen N/D sin CPP. Tanto
el numerador como el denominador del porcentaje excluyen las ventas sin CPP.

El Excel se titula «REPORTE COMERCIAL LAMINADOS & ALMACÉN GENERAL». La conciliación
comercial incluye las líneas originales Laminados, Almacén General y Flexografía.
La selección Laminados de la app considera solamente la línea original Laminados.
No se comparan sus totales directamente como si fueran el mismo alcance.

El PDF es el criterio de cálculo; no se fuerzan sus resultados para reproducir
inconsistencias del Excel. En particular, PVC impreso aparece sin costo y con
100% de margen en la hoja 8, mientras que el PDF exige N/D. La referencia Excel
recalculada con el denominador del PDF da 30.2740% en el alcance comercial;
no es el 30.2254% del resumen ni el 30.3859% de la hoja 8.

## Resultado contra la hoja 8, enero–septiembre 2026

| Fuente utilizada | Categorías cuyo costo coincide al centavo | Ventas Q | Ventas con CPP Q | Costo MP Q | Margen según PDF |
|---|---:|---:|---:|---:|---:|
| PostgreSQL con snapshots vigentes | 17 de 19 | 30,831,375.34 | 30,781,812.51 | 21,464,254.38 | 30.2697% |
| Vistas actuales del ERP | 18 de 19 | 30,827,439.88 | 30,777,877.05 | 21,459,607.68 | 30.2759% |

Las categorías sin costo no entran al conteo de 19. Una coincidencia del total
no demuestra que coincidan sus componentes; se revisaron categorías por separado.

## Diferencias localizadas

### PVC UV: facturas ausentes de la vista actual

Postgres conservaba las facturas 1093405 y 1093406, del 09-sep-2026, por un total
de Q69,410.91 y costo CPP de Q46,206.30. Se consultaron sus números directamente
en `vstFacturas_Devoluciones`, sin filtro de línea: ya no devuelve esos registros.
No se afirma que estén anuladas, porque la vista no expone esa causa.

El selector anterior por último hash retenía la copia de septiembre aunque las
cargas completas posteriores ya no la incluían. `cppDatos.js` elige la última
carga exitosa que cubre la fecha y conserva únicamente sus filas. Con ello PVC UV
coincide con Jonathan sin eliminar ni alterar físicamente registros de Postgres.

### PET: compra no ingestada

La vista actual de compras incluye la factura 108139, artículo M050100255CS,
del 21-sep-2026: 13,385.20 unidades y Q280,604.66 sin IVA. No está en los raw
recibidos en Postgres. Al incluirla en la comparación de solo lectura, el costo
de PET baja Q4,646.70 y coincide con el Excel.

Esto no requiere un CPP manual. Requiere recuperar esa compra del origen y
evitar que las ventanas incrementales pierdan registros incorporados con fecha
retroactiva. La lectura por snapshot no puede reconstruir una compra nunca cargada.

### Aluminio: cambio de importe de una factura histórica

La factura 1092096, artículo M204570210, del 18-jun-2026, tiene 799.95 unidades.
En Postgres trae Q82,851.96 sin IVA; la vista actual del ERP entrega Q78,916.50.
La diferencia es Q3,935.46. El costo CPP coincide con Jonathan; el importe de
venta actual ya es diferente. No se presupone el motivo de la modificación.

### ACLAR: diferencia pendiente con la referencia del cliente

La hoja 8 contiene Q2,866,730.19 de ventas de ACLAR y Q2,209,541.94 de costo MP.
Tanto Postgres como la vista actual del ERP contienen Q2,802,645.99 de ventas y
Q2,161,540.26 de costo calculado con el PDF.

Faltan explicar Q64,084.20 de ventas y Q48,001.67 de costo frente a la referencia.
La diferencia de costo equivale a 212.35 kg a CPP Q226.04979778; esto es una
reconstrucción aritmética, no una factura identificada.

La misma diferencia de ventas se observa en ALTIAN PHARMA: la hoja 3 reporta
Q913,534.75 y la vista actual Q849,450.55. Se solicitaron al usuario los documentos
de ACLAR de ese cliente para identificar la diferencia. No agregar ventas/costos
sintéticos ni cambiar el CPP para cerrar esta diferencia.

## Corrección local de la aplicación

Con `categoria=Laminados`, Ventas y Márgenes usan el mismo calculador para sus
resúmenes, productos, detalles, vendedores, clientes, categorías, series y matriz.
El costo y margen en Q son aditivos; el porcentaje utiliza las ventas con CPP.
Las ventas sin CPP conservan su importe comercial y su margen permanece N/D.
Colgate se agrupa en Gerencia Laminados; no conserva el código del vendedor anterior.

Ejemplo validado en las rutas reales: M097410110 (ACLAR de 110 mm), CPP
Q226.04979778 y margen 23.42962595%, como en la referencia de Jonathan.

Solo la línea original Laminados, enero–septiembre:

| Fuente | Ventas Q | Ventas con CPP Q | Costo MP Q | Margen según PDF |
|---|---:|---:|---:|---:|
| Postgres con snapshots vigentes | 29,709,665.40 | 29,673,928.09 | 20,708,599.96 | 30.2128% |
| Vistas actuales del ERP | 29,705,729.94 | 29,669,992.63 | 20,703,953.26 | 30.2192% |

La diferencia entre ambas fuentes responde a PET y la factura de aluminio
descritas arriba. La corrección de toda la aplicación todavía requiere integrar
los totales generales, Dashboard, Tesorería y la capa SQL de IA, además de
reconciliar los datos. Este avance no está desplegado.

## Reproducción y comprobaciones

- `npm run test:cpp`: pruebas del método, bajas por snapshot, cargas fallidas o
  vacías, filas partidas, bases del margen, devoluciones, cierre en Guatemala,
  agrupaciones y contratos HTTP.
- Se probaron 16 rutas HTTP locales contra datos reales de Postgres. Resumen y
  series reconcilian; el detalle conserva números aptos para exportar. Un corte
  inválido devuelve 400 y una ruta de Inyectables conserva su contrato anterior.
- `npm run build`, desde `frontend`, compila. No se realizó verificación visual
  autenticada. Permanecen avisos preexistentes de claves duplicadas y tamaño del bundle.
- `conciliar-laminados.js` compara por categoría contra una referencia JSON con
  campos `categoria`, `ventas`, `costo` y `margen_pct`, extraída de A5:J27 de la hoja 8.
  La celda de costo vacía se conserva como null. No versionar exportes raw ni secretos.

```sh
node scripts/conciliar-laminados.js --referencia=/tmp/referencia-laminados.json --desde=2026-01-01 --hasta=2026-09-30 --corte=2026-09-30 --salida=/tmp/conciliacion-pg.json
node scripts/conciliar-laminados.js --referencia=/tmp/referencia-laminados.json --datos-erp=/tmp/exporte-erp.json --desde=2026-01-01 --hasta=2026-09-30 --corte=2026-09-30 --salida=/tmp/conciliacion-erp.json
```

`exportar-laminados-erp.py` se ejecuta por stdin dentro de `ingesta-worker`, donde
existen el conector y las credenciales ambientales. Solo hace SELECT y rollback;
no invoca el ETL ni escribe en ninguna base. Los exportes permanecen fuera del repo.
