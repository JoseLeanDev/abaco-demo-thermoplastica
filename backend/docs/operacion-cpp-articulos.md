# CPP de Empaques, Tapas y válvulas e Inyectables

Preparación del 22-oct-2026. La publicación y su comprobación final se registran
al terminar el despliegue. Transformación permanece fuera de este cambio.

## Confirmación comercial

La captura compartida por José corresponde al mensaje dirigido a Héctor y
Jonathan sobre Empaques para alimentos, Tapas y válvulas e Inyectables.
Jonathan responde que en esas líneas son millares de unidades y es la misma
medida en compras y ventas. La confirmación se limita a esas tres líneas;
Laminados conserva kilos y la metodología del PDF previamente conciliada.
Es evidencia comunicada por el cliente, no una columna nueva en las vistas ERP.

- Cantidad original del exporte = millares. No convertir otra vez por 1,000.
- CPP = importe comprado sin IVA / millares comprados del mismo código.
- Costo de venta = millares vendidos × CPP; margen = venta sin IVA − costo.
- Buscar primero las compras propias del año de venta hasta el cierre disponible.
  Si no hay, recorrer años anteriores propios, del más reciente al más antiguo,
  prefiriendo H2 antes del año completo. No promediar otros artículos.
- No aplicar las tarifas por kilo ni los costos manuales exclusivos de Laminados.
- Sin compras propias válidas: costo y margen N/D; venta visible, fuera del
  numerador y denominador del margen. No estimar utilidad a partir de otros SKUs.
- Las ventas del mes abierto siguen visibles con CPP pendiente.
- Conservar los importes del ERP y su precisión, sin forzar el Excel de Jonathan.

## Histórico y resultado de la validación

La extracción completa recuperó 6,226 filas físicas de ventas desde enero de
2024 y 1,317 filas de compras propias, incluido el histórico anterior al inicio
de la ingesta. Se publican 6,062 claves comerciales sin ventas internas.
La vista del ERP usa `tpFood`; se conserva en `linea_erp_original` y se expone
como Empaques para alimentos, igual que el catálogo y los filtros actuales.
Todos los códigos vendidos recuperados ya existen en el catálogo. Los grupos
publicados no usan compras anteriores al 2000; las fechas antiguas recibidas
del ERP permanecen trazables en el snapshot, sin inventar fechas nuevas.

Enero–septiembre de 2026, compras al 30-septiembre:

| Línea | Ventas Q | Costo conocido Q | Margen conocido Q | Margen sobre ventas con CPP | Cobertura de ventas |
|---|---:|---:|---:|---:|---:|
| Empaques para alimentos | 985,408.17 | 561,981.70 | 423,426.47 | 42.969653% | 100% |
| Tapas y Valvulas | 5,818,881.78 | 2,268,498.07 | 3,391,964.22 | 59.923802% | 97.277493% |
| Inyectables | 1,991,388.19 | 1,024,782.62 | 966,605.57 | 48.539284% | 100% |

Tapas mantiene Q158,419.49 de ventas sin CPP, correspondientes a cinco códigos:
`APLITAP`, `VALTAPRES`, `V590320410F`, `V650328410.` y `V591524410L`.
No se encontraron compras propias para ellos en las vistas consultadas del ERP.
Esto no demuestra que nunca hayan sido comprados fuera de esas fuentes.

## Fuente única e integración

La migración 023 agrega `cpp_articulos_importacion`, `cpp_articulos_publicacion`,
`cpp_articulos_clave` y `cpp_articulos_venta`. Conserva snapshots, procedencia
del CPP y claves históricas, incluidas las bajas de facturas en cargas posteriores.
La publicación es atómica con advisory lock, fuente activa y costos juntos.
Las tablas originales del ERP y las tablas de publicación de Laminados se conservan.

`v_ventas_costeadas` integra la publicación de ambas metodologías CPP con el
resto de registros ERP. `analitica.margen_comercial` sigue siendo el agregado
único de totales y agentes. Los módulos existentes que ya consumen esa vista
reciben la corrección; no se altera la valuación física del inventario.
Los adaptadores de Ventas/Márgenes comparten contratos con Laminados y separan
línea, unidad y caché. Los detalles identifican su categoría real y no abren
accidentalmente un cálculo de Laminados.

El snapshot completo `articulos_snapshot.py` se integra al `/daily` existente,
dentro del mismo lock, después de Laminados. No se crea un cron nuevo ni se
ejecuta `/backfill`. Una extracción incompleta no reemplaza el snapshot válido.
El publicador del web service revisa novedades al iniciar y cada cinco minutos.
El healthcheck del worker vigila extracción/publicación de ambas fuentes CPP.

## Verificación y recuperación

- 46 pruebas del calculador y adaptadores; incluyen millares fraccionarios,
  respaldo propio de años anteriores, N/D y exclusión de transformación.
- Ensayo de migración/publicación en transacción revertida: cálculo puro y
  agregado SQL coinciden; Laminados y registros fuera del alcance permanecen iguales.
- 58 rutas HTTP con la base real, más tres detalles de producto: todas HTTP 200.
- Compilación frontend correcta; conserva avisos previos de tamaño y claves duplicadas.

Comprobaciones de solo lectura desde `backend`:

```sh
node scripts/validar-cpp-articulos.js
node scripts/validar-cpp-laminados.js
node --test test/margen-postgres.test.js
```

La definición anterior de `v_ventas_costeadas` y el prompt previo del playbook
se respaldaron en el expediente local `respaldo-final.json`. El instalador del
worker respalda ETL y Dockerfile antes de modificarlos. Revertir requiere
restaurar la vista/prompt, código anterior y worker; no borrar fuentes ERP ni
recalcular sus costos originales. Los snapshots nuevos permanecen para auditoría.
