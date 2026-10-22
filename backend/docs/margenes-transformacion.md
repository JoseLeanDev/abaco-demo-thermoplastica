# Márgenes de transformación: método y suficiencia de datos

Estado al 22-oct-2026: revisión de solo lectura de Postgres y de las vistas del
ERP. Método pendiente de implementar. Las cuatro líneas comerciales conservan
su CPP publicado; esta revisión no cambia cálculos ni datos de producción.

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

1. Obtener del ERP inventarios valorizados a cada cierre requerido, con fecha,
   línea responsable y valor total en Q. El detalle por artículo y sus cantidades
   ayuda a conciliar y asignar materiales, pero no es necesario convertir las
   unidades de compra y venta si ya se recibe el valor correcto por línea.
   Establecer el alcance de materias primas, proceso y producto terminado.
   Para el acumulado enero–septiembre de 2026,
   como mínimo 31-dic-2025 y 30-sept-2026; para meses y años anteriores, todos
   sus límites. Conciliar la valorización con el reporte aceptado por el cliente.
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
