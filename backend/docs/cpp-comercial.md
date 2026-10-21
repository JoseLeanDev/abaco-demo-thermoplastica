# CPP comercial: preparación y auditoría

Estado: calculador y auditoría local. Las rutas actuales de la aplicación todavía
utilizan `margen.js`; estos archivos no cambian la base ni el cálculo publicado.
Transformación queda fuera de este alcance.

## Alcance

Laminados, Empaques para alimentos, Tapas y Valvulas e Inyectables, con los nombres
del ERP. El documento de Jonathan del 21 de octubre de 2026 acredita kilos para
Laminados. Las otras tres líneas conservan la cantidad original como `unidad_erp`
y el estado `pendiente_confirmacion`: no se presume que sean kilos o piezas.

El CPP puede expresarse por kilo, pieza o millar. Lo necesario es que la cantidad
de compras y ventas use la misma unidad. Para Laminados también deben ser
comparables los artículos agrupados por el PDF. Las otras tres líneas usan solo
compras del mismo código de artículo, según la instrucción del usuario del
21-oct-2026: si faltan compras actuales se buscan las anteriores, sin tomar el
costo de otros productos. Postgres no contiene código de unidad ni conversión.
La consistencia numérica con costos/precios de un SKU es evidencia auxiliar,
no una confirmación de la unidad. Los fletes por kilo del PDF solo se aplican a
compras identificadas como Laminados. Una coincidencia de proveedor en otra línea
queda pendiente; no se multiplica por una cantidad de unidad desconocida.

## Reglas implementadas

- CPP = suma de compras sin IVA más flete / suma de cantidad comprada.
- Corte de compras explícito al último día de un mes cerrado. Las compras usan
  el año disponible hasta ese corte, independientemente del filtro de ventas.
- Laminados: año actual exacto/categoría+sublínea/categoría, luego H2 anterior
  con esos tres niveles, luego año anterior completo con los mismos niveles.
- Empaques, Tapas y Valvulas e Inyectables: CPP ponderado del mismo código en
  el año de venta; si falta, se buscan sus años anteriores disponibles, del más
  reciente al más antiguo. Dentro de cada año anterior se conserva la preferencia
  H2 antes del año completo. No se limita la búsqueda a A−1 para estas tres líneas.
  Si no hay compras propias válidas, queda sin CPP y margen N/D.
- Llaves originales `categoria`, `sublinea`, `color`, con espacios eliminados en
  los extremos y nulos como cadena vacía para Laminados. Las otras líneas usan
  `codigo_articulo` con espacios eliminados, aunque haya cambiado su categoría.
  No usar los alias visuales del frontend.
- Besel/Basim: Q3.90/kg; Maximore/M&M: Q2.34/kg hasta 2025 y Q3.90/kg en 2026.
- Foil de Aluminio, 25 micras, Mate, 2026: Q75.99/kg reemplaza compras.
- Aluminio Impreso Q82 y Foil aluminio blister impreso Q70.40: solo respaldo
  después de agotar la jerarquía de Laminados. No se aplican a las otras líneas.
- Ventas internas a Thermoplástica/Termoplástica excluidas sin distinguir tildes.
  Colgate se atribuye a Gerencia Laminados para reproducir el criterio del PDF.
- Una fila sin CPP conserva su venta total, pero no entra al numerador ni al
  denominador del margen. No se extrapola utilidad a ventas sin costo conocido.
- Las cantidades e importes negativos se conservan con su signo. Esto no prueba
  que la ingesta incluya todas las devoluciones: las fuentes recibidas actualmente
  están identificadas como FACT. No se inventan notas de crédito faltantes.
- Un grupo con datos incompletos no se trata como un costo válido. Los grupos con
  compras de distintas líneas quedan identificados para revisar su homogeneidad.

Se preserva precisión del CPP durante los cálculos. El redondeo de presentación
debe hacerse después de sumar costos y márgenes, nunca antes de multiplicar.

## Auditoría de solo lectura

Desde `backend`:

```sh
npm run test:cpp
npm run audit:cpp -- --desde=2026-01-01 --hasta=2026-09-30 --corte=2026-09-30 --salida=/tmp/auditoria-cpp.json
```

La auditoría abre una transacción READ ONLY con snapshot consistente. Trabaja
con la última versión recibida de cada factura/artículo, conservando sus filas
partidas dentro del mismo batch. Exporta trazabilidad, cobertura, alertas y CPP
por SKU. No ejecuta migraciones ni activa el cálculo en los endpoints.

Para las tres líneas por artículo, la consulta recupera todo el historial propio
disponible en Postgres, sin filtrar por la categoría actual ni solo por A−1.

Para repetir sobre datos raw extraídos previamente, agregar `--datos=/ruta/source.json`.
Ese archivo debe contener `[compras_raw, ventas_raw]`, con identificador de batch,
hash y timestamp de ingesta. No se deben versionar exportes de datos del cliente.

## Antes de activar

1. Confirmar la unidad correspondiente a `Unidades` en compras y ventas por
   artículo de las otras tres líneas. La regla de usar solo compras propias,
   incluyendo anteriores, ya fue definida por el usuario.
2. Conciliar las diferencias de PVC UV, ACLAR y PET con el reporte del cliente.
3. Confirmar el límite comercial de Laminados frente a Almacén General e impresos
   de Flexografía. El alcance actual no los agrega silenciosamente a Laminados.
4. Completar el histórico propio que falta: Postgres empieza el 18-sep-2024.
   La consulta de solo lectura al ERP del 21-oct encontró compras anteriores
   para nueve de los catorce artículos sin compras en Postgres (cuatro de
   Empaques y cinco de Tapas). Esos registros todavía no se ingieren ni se
   incluyen en los resultados de la auditoría a Postgres que siguen.
5. Integrar una sola fuente de costo y base del margen en los módulos afectados,
   incluyendo importes y porcentajes, una vez validados los puntos anteriores.

## Comprobación del 21-oct-2026

Prueba de enero a septiembre de 2026 contra Postgres, con compras al 30-sep-2026:

| Línea | SKUs vendidos | Ventas con CPP encontrado | Unidad |
| --- | ---: | ---: | --- |
| Laminados | 259 | 99.88% | kg documentado en el PDF |
| Empaques para alimentos | 12 | 92.42% | por confirmar |
| Tapas y Valvulas | 50 | 96.36% | por confirmar |
| Inyectables | 26 | 100% | por confirmar |

La cobertura describe coincidencias de CPP, no validación física de las unidades.
Laminados conserva sus resultados anteriores dentro de medio centavo, incluidos
CPP Q65.08504598 para M077260150 y Q226.04979778 para M097410110/M097410155.
La regla nueva por artículo se verificó contra las compras del vial descrito al
final y con 27 pruebas financieras que pasan, incluyendo ausencia de compra
propia, cambio de categoría y compras de años anteriores a A−1.

En los SKUs con compra directa 2025/2026 se contrastaron las escalas de importes
por cantidad frente a costos del ERP: no se detectó un desfase de factor 1,000.
Esto no acredita por sí solo que las cantidades sean piezas, cajas o millares.
Los fletes por kilo del PDF solo aparecen en compras de Laminados dentro de
estas cuatro líneas.

VTESPA2 ya no recibe el promedio de la llave genérica No Aplica/No Aplica/No Aplica
de otros productos. Queda sin CPP en Postgres; se encontró una compra propia
de junio de 2022 en el ERP que requiere recuperar junto con el resto del histórico.
En Laminados se sigue señalando la mezcla con Almacén General, que forma parte
de la metodología comercial del reporte y debe confirmarse al definir el alcance.

Un ejemplo material es I110NBB38 (vial de 3 ml): la búsqueda por artículo toma
su compra de noviembre de 2025, CPP Q594.64468776 por unidad exportada, y produce
27.77% de margen. Ya no usa el CPP Q114.42886641 de otros Viales que generaba
86.10%. Todos los resultados de las tres líneas quedan provisionales hasta
confirmar unidades. Si faltan compras propias, se muestra N/D y no se sustituye
con el costo de otros productos.
