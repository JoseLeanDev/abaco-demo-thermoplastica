# Márgenes de transformación: método y suficiencia de datos

Estado al 22-oct-2026: el margen de transformación sigue pendiente de trazabilidad.
Se corrige por separado la clasificación de inventario mediante la migración 024.
Las cuatro líneas comerciales conservan su CPP publicado.

## Proceso comunicado por el cliente

| Línea | Entrada | Facturación / salida |
|---|---|---|
| Liners* | Bobinas principalmente en m² | Yardas o millares de discos |
| Soplado | Sacos o kg de material | Millares de envases |
| Termoformado | Kg de material | Millares de bandejas |
| Serigrafía | Servicio; insumos por identificar en la fuente | Servicio por millares de unidades |
| Maquila | Millares de mangas | Servicio |
| Flexografía | Aluminio, papel/PE y papel/PE/alu/PE comprados muchas veces por Laminados; base PET comprada por Flexografía | Kg, facturados por Flexografía |

*El mensaje dice «lines». Se interpreta como Liners por el nombre del catálogo;
esta correspondencia es una interpretación y debe quedar explícita al cerrar
el alcance. El catálogo también tiene `Serigrafía TP-2`; no incorporarla por
similitud de nombre sin establecer su relación con Serigrafía.

Estos datos provienen del mensaje del cliente transmitido por José. No son
nuevas columnas ni una definición técnica de las vistas del ERP.

## Método acordado

```text
margen = (ventas - compras + inventario_final - inventario_inicial) / ventas
```

Todos los importes son monetarios y deben corresponder al mismo período y
alcance de línea. Compras y ventas deben usar importes netos sin IVA y un
tratamiento coherente de devoluciones. Para enero–septiembre de 2026, el
inventario inicial corresponde al cierre del 31-dic-2025 y el final al del
30-sept-2026. Una serie mensual requiere además cada cierre intermedio.

Las unidades físicas distintas no impiden esta fórmula: no se restan m² de
yardas ni kg de millares. Se comparan compras, ventas e inventarios en quetzales.
La transformación y las conversiones sí importan para valorar o reconstruir
existencias si el ERP no entrega directamente los cierres valorizados.

El alcance de inventario debe ser coherente con las compras y ventas incluidas:
identificar materias primas, producción en proceso y producto terminado que
corresponden a cada línea, sin contabilizar dos veces el mismo material.
No usar el inventario actual como sustituto de un cierre histórico faltante.

Serigrafía y Maquila no tienen margen de 100% por facturar un servicio. Hay que
ubicar los insumos y costos incluidos en el método acordado, y su existencia
inicial/final cuando aplique. Un inventario cero necesita evidencia; la ausencia
de filas o la etiqueta de servicio no lo demuestra. Esta fórmula, con solo
materiales, no acredita utilidad neta ni incorpora automáticamente nómina,
energía u otros gastos de fabricación.

## Lo comprobado en Postgres

- Hay registros de ventas para las seis etiquetas de línea en
  `thermoplastica.fact_ventas_linea` y compras en
  `thermoplastica.fact_compras_linea`, con importes y fechas. No se ha certificado
  que su clasificación incluya todos los insumos de cada proceso.
- El hecho de inventario `thermoplastica.fact_inventario_snapshot` contiene
  únicamente la foto del 22-oct-2026 en la consulta actual. El ETL reemplaza
  este snapshot y el catálogo raw; no guarda allí cierres anteriores.
- Sí existe un historial aparte: `analitica.hist_inventario`. La consulta actual
  devuelve 14 fechas diarias, del 9 al 22-oct-2026. No contiene 31-dic-2025,
  30-sept-2026 ni los cierres mensuales anteriores necesarios.
- El historial guarda `fecha`, `articulo_id`, `stock`, `valor` y `capturado_en`.
  `historialInventario.js` lo captura desde el snapshot al iniciar el servidor y
  cada cuatro horas, conservando solo stock positivo. No contiene línea a la
  fecha de captura, almacén, destino de consumo ni documento de traslado.
- Los valores del historial proceden de la valorización del snapshot ERP; no
  representan una nueva conciliación del costo ni prueban la aceptación de esa
  valorización para el método del cliente. Tampoco incluyen stock negativo.
- La clasificación de inventario actual incluye tanto líneas comerciales como
  `Materia Prima (Insumos)` y `TINTAS`. No se puede asignar automáticamente todo
  ese inventario a una única línea productiva.

La cobertura histórica de compras/ventas de transformación todavía no se ha
recuperado con el mecanismo completo usado para las cuatro líneas comerciales.
Por ejemplo, Postgres muestra ventas de Liners, Maquila, Serigrafia, Soplado y
Termoformado desde septiembre de 2024; la vista ERP devuelve registros desde
enero de 2024. Las clasificaciones histórica de la vista y actual del catálogo
deben conciliarse antes de comparar conteos o publicar el histórico.

## Lo comprobado en la fuente ERP

Se revisaron las columnas y objetos visibles para la conexión de ingesta. Hay
nueve vistas con SELECT. Esto delimita lo expuesto a nuestra conexión; no
demuestra que el ERP carezca de otras tablas o reportes internos.

- `vstFacturas_Devoluciones`: ventas con fecha, importes y `Linea`.
- `vstCompras`: compras con fecha, importes y `Linea`.
- `vst_Articulos`: stock actual y costos unitarios; no expone fecha de cierre
  histórico, línea de consumo o destino de un traslado.
- `vst_sell_through_Movimientos`: tiene cantidades `Inicial`, `Ventas`,
  `Compras`, `Devoluciones`, `Entradas`, `Salidas` y `Semana`. No expone año,
  fecha completa, importes valorizados ni línea origen/destino. No basta para
  reconstruir cierres monetarios y transferencias entre líneas por período.
- Las definiciones SQL de las dos vistas de inventario anteriores no son
  visibles para esta conexión (`OBJECT_DEFINITION` devuelve null).

Consulta de compras de la fuente entre 1-ene-2024 y 22-oct-2026, filtrando la
etiqueta `Linea` original:

| Etiqueta | Filas físicas de la vista |
|---|---:|
| Liners | 187 |
| Soplado | 59 |
| Serigrafia | 66 |
| Flexografía | 4 |
| Maquila | 0 |
| Termoformado | 0 |

Esto no prueba ausencia de compras o costos de Maquila o Termoformado. Deben
identificarse los códigos, cuentas o clasificaciones donde se registran sus
mangas y resinas. La fuente también tiene compras bajo `TINTAS`,
`Materia Prima (Laminadora)`, `Contable` y otras etiquetas; no se ha determinado
qué parte pertenece a cada proceso. Los conteos son de filas físicas, no de
facturas únicas, y no equivalen a una conciliación de costo.

## Pendientes concretos de datos y asignación

1. José confirma que el cliente no guarda inventarios históricos: las fotos
   desde el 9-oct-2026 las empezamos a capturar nosotros. No seguir solicitando
   cierres históricos como si existieran. La fórmula requiere esos límites,
   pero no se puede publicar enero–septiembre de 2026 con el inventario de hoy.
   Para períodos anteriores solo sería posible una reconstrucción sustentada
   en movimientos completos y valorizados, si se consiguen; no se ha acreditado
   esa fuente. Conservar las fotos para períodos futuros y conciliar su valor.
2. Identificar los códigos y registros de compras/consumos que corresponden a
   cada línea, incluidas mangas de Maquila, resinas de Soplado/Termoformado,
   tintas y otros insumos de Serigrafía. Definir la asignación de insumos
   compartidos con evidencia, sin prorrateos inventados.
3. Obtener la trazabilidad del material comprado por Laminados y utilizado por
   Flexografía: fecha, artículo, línea origen/destino, valor del material y
   referencia de movimiento; cantidad/unidad si hay que derivar el valor.
   Definir cómo entra esa asignación en el cálculo por línea. Sumar únicamente
   compras externas con la etiqueta Flexografía omitiría esos materiales.
   No cambiar silenciosamente la fórmula acordada ni alterar el CPP publicado
   de Laminados. Conciliar ambas líneas y el total para evitar doble cargo.
4. Recuperar compras/ventas históricas completas de las líneas incluidas y
   conciliar clasificación, devoluciones, exclusiones y cierres. Una consulta
   agregada de la fuente no equivale a haber realizado esa recuperación.

## Límites para la implementación

El método entrega un margen por línea y período. Por sí solo no entrega costos
por producto, cliente o vendedor. Esos desgloses necesitan consumo/costeo de
producción o una regla de asignación acordada y presentada como tal; no repartir
un porcentaje de línea y llamarlo costo real por producto.

Con los datos actuales no se puede publicar un margen histórico fiable de
transformación. La siguiente implementación depende de los cierres valorizados
y de la asignación de materiales descritos. No usar cero para datos faltantes
ni extender CPP de producto comprado a producto transformado.

## Evidencia y consultas de control

Revisión del 22-oct-2026: SQL de solo lectura en Postgres y SELECT en SQL Server
por el worker existente vía Tailscale. Sin ETL/backfill ni cambios de fórmulas.
Expediente local de consultas: `/tmp/thermo-transformacion-20261022/`.
Los archivos temporales son auxiliares; las conclusiones vigentes quedan aquí.

```sql
-- Historial disponible; no reemplazar fechas faltantes con la foto actual.
SELECT min(fecha), max(fecha), count(DISTINCT fecha)
FROM analitica.hist_inventario;

SELECT fecha_snapshot, count(*)
FROM thermoplastica.fact_inventario_snapshot
GROUP BY fecha_snapshot;

-- SQL Server: la clasificación de la vista puede diferir del catálogo actual.
SELECT RTRIM(Linea) AS linea, count(*) AS filas
FROM dbo.vstCompras
WHERE fec_emis >= '20240101' AND fec_emis < '20261023'
GROUP BY RTRIM(Linea);
```

## Corrección de inventario sin trazabilidad — 22-oct-2026

José solicita identificar la relación insumo → producto transformado y corregir
el material que aparece como inmovilizado por no venderse directamente.
La consulta nueva a SQL Server TP_A, usuario usrDasboard, vuelve a mostrar solo
las nueve vistas documentadas. Ninguna expone orden/lote de producción con
código de insumo y código de producto resultante. `Entradas` y `Salidas` del
sell-through están agregadas por código/semana, sin vínculo entre códigos.
`modelo` contiene referencias contables en muchos artículos, no una lista de
materiales acreditada; no inferir relaciones por nombres, familias o prefijos.

Necesidad para Héctor: exponer los registros de producción/transformación con
referencia de orden/lote, fecha, código de insumo consumido, cantidad y unidad,
código de producto resultante, cantidad y unidad, línea/almacén origen-destino
y costo del material. La receta/lista de materiales puede identificar relaciones;
los consumos reales por fecha permiten medir movimiento y asignar costos.
Verificar qué registra el ERP antes de exigir un nombre de tabla concreto.

La migración 024 deja artículos con compras pero sin venta directa y artículos
sin compras/ventas disponibles en estado `por_validar`. Conserva el valor del
inventario, sin clasificarlos como activos, lentos, inmovilizados ni exceso.
No presume que ya se consumieron: falta la evidencia de producción. La falta de
recompra no se utiliza como prueba de inmovilización y compras no son consumo.
Los criterios de venta directa de productos se conservan como señales comerciales,
no como prueba de ausencia de uso productivo de un código de uso mixto.

El estado se integra en Capital inmovilizado, Análisis, Inventario, filtros,
gráficas, detalle y columnas exportables. Cobertura, exceso, quiebres y ABC
comerciales excluyen el flujo de compra usado antes como supuesto de consumo.
Rotación separa el valor con consumo pendiente de su base comercial; el total
contable del inventario y el DIO del ciclo de caja conservan su alcance.
La vista semántica y el prompt de salud del analista explicitan el mismo límite.

Antes/después en la foto del 22-oct: total Q32,416,849.30, sin cambio de stock ni
valor por artículo. Q22,049,145.72 / 713 artículos quedan por validar; los 438
artículos con venta directa conservan su estado anterior. Inmovilizado comercial:
Q1,398,967.23; lento: Q7,077,881.47; activo: Q1,890,854.88. Esto corrige la
interpretación de los datos; no libera físicamente stock ni demuestra el consumo.

Validación: 4 pruebas nuevas (incluido SQL real con fuentes temporales que no
reemplazan vistas productivas), 51 pruebas de regresión CPP/margen y build frontend.
Expediente: `/tmp/thermo-inventario-transformacion-20261022/`, con respaldo de
vista/comentario/prompt/insights previos. Recuperación: restaurar la definición y
comentario respaldados de `v_inventario_salud` y el prompt de salud junto al código
anterior; no modificar las fuentes ni publicaciones CPP.

Las ocho rutas HTTP revisadas contra la base real responden 200: inventario
quieto general, filtro pendiente, filtro inmovilizado, búsqueda IS30A, inventario
analítico, salud, rotación de materia prima y margen de Laminados. IS30A conserva
Q469,034 y queda completamente por validar, sin capital quieto ni activo.
El margen de Laminados enero–septiembre conserva Q8,966,039.37. La conexión real
`agente_ia` lee los cuatro estados con los mismos importes de Postgres.

Se regeneraron los cuatro insights de salud. Los anteriores que proponían
liquidar materias primas por falta de venta/recompra quedaron resueltos y se
conservan en historial. El prompt vigente prohíbe llamar inmovilizado al total
del inventario o recomendar bajas sin validar consumo y existencia física.
Costo de las dos corridas de verificación: USD 0.08774; la segunda reemplaza a
la primera porque esta aún usaba «inmovilizado» para todo el valor del stock.

Publicación de código `e6e763d`: Render confirmó el servicio web como exitoso a
las 16:46:52 UTC del 22-oct-2026, despliegue `dep-dbd3rbjncjis73ecajkg`.

El scheduler también publicó el mismo código: 16:46:13 UTC, despliegue
`dep-dbd3rbjncjis73ecak90`. Salud HTTP 200. Comprobación visual con sesión activa:
Capital inmovilizado muestra Q22.0M por validar / 713 artículos y 224 artículos
quietos (no 937, que antes incluía los pendientes). Búsqueda IS30A: Q469k por
validar, Q0 quieto, sin cobertura estimada. En Inventario, filtro Materia prima:
Q20.1M conservados, exceso N/D, quiebres 0 y detalle con estado pendiente.
Evidencia visual: `entregables/inventario-consumo-por-validar-2026-10-22.png` en
el workspace superior. Se verificaron las columnas exportables por código; no
se afirma descarga y conciliación de todos los archivos Excel desde el navegador.

Ajuste final `d734674`: copy de consumo pendiente y protección adicional del
prompt. Web publicado 16:53:05 UTC (`dep-dbd3u9mk1f9s738ku16g`); scheduler
16:52:22 UTC (`dep-dbd3u9mk1f9s738ku1r0`). Se comprobó la leyenda nueva desde
la sesión autenticada y se dejó abierta Capital inmovilizado. Captura resumida:
`entregables/inventario-consumo-verificado-2026-10-22.png` en el workspace superior.
