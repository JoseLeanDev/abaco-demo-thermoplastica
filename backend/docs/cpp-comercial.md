# CPP comercial: preparación y auditoría

**Estado al 22-oct-2026:** las cuatro líneas comerciales tienen activa la
corrección. Laminados se publicó el 21-oct; Empaques para alimentos, Tapas y
Valvulas e Inyectables se publicaron el 22-oct tras recuperar y validar su histórico.
El usuario comunicó el 22-oct-2026 que esas tres líneas se miden en millares;
el calculador y la auditoría ya registran `millar` / `confirmada_usuario`, sin
convertir nuevamente las cantidades originales por 1,000. La referencia del
usuario a Laminados se aclaró con la captura de la respuesta de Jonathan:
la consulta y la confirmación corresponden solo a las otras tres líneas.
Laminados conserva su cálculo en kilos según el PDF.
Transformación está en revisión de fuentes; procesos, método y faltantes en
[margenes-transformacion.md](margenes-transformacion.md). Estado, diferencias documentadas y criterio
de conservar las ventas del ERP en
[operacion-cpp-laminados.md](operacion-cpp-laminados.md). Operación, cobertura y
cinco productos de Tapas sin compras propias en
[operacion-cpp-articulos.md](operacion-cpp-articulos.md).

## Antecedente: estado local antes de la publicación del 21-oct-2026

Los siguientes párrafos describen la fase previa; no representan el estado
publicado actual. Las secciones de auditoría inicial conservan sus cifras
históricas.

Estado: corrección local conectada al filtro `categoria=Laminados` de Ventas y
Márgenes, con una sola fuente para resumen, artículos, detalle, vendedores,
clientes, categorías, series y matriz. No publicada; no se modificaron datos
ni servicios de producción. Transformación queda fuera de este alcance.

El alcance actual es la selección explícita de Laminados. Los totales generales
sin ese filtro, Dashboard, Tesorería y la capa SQL de IA conservan el criterio
anterior y requieren integración antes de publicar una corrección de toda la
aplicación. No presentar este avance como una migración global terminada.

La conciliación actual y las diferencias del ERP se detallan en
[conciliacion-laminados-2026-09.md](./conciliacion-laminados-2026-09.md).

## Acuerdos y evidencia confirmados con el usuario

- El costo promedio y el último costo ya vienen del ERP, pero no equivalen al
  CPP del reporte. Se verificaron directamente en `vstFacturas_Devoluciones`:
  ACLAR M097410110 trae ambos en Q22.56845 frente al CPP Q226.04979778 de
  Jonathan; M097410155 trae ambos en Q212.78 frente al mismo CPP del reporte.
  Cambiar de un campo de costo al otro no resuelve la discrepancia.
- Las nueve vistas visibles para `usrDasboard` en SQL Server TP_A no exponen
  unidad de medida ni factor de conversión. Se revisaron sus columnas, incluidas
  `vst_Articulos`, `vstCompras` y `vstFacturas_Devoluciones`. Esto no prueba que
  el ERP carezca del dato en sus tablas internas, a las que no tenemos acceso.
- `Unidades` es cantidad numérica. Algunas ventas tienen anotaciones en `aux02`
  como `5*400` para cantidad 2 o `24*450` para 10.80. Son indicios de millares
  para esos artículos, no una unidad maestra confirmada; las compras revisadas
  no traen esas anotaciones. `aux01` está en cero en las compras revisadas.
- Laminados ya tiene `Unidades = kg` acreditado en el PDF (página 3). No se
  necesita esperar una nueva columna de unidad para avanzar con Laminados.
- Para Empaques, Tapas y Valvulas e Inyectables, el usuario definió usar compras
  del mismo artículo y sus compras anteriores, sin promediar otros productos.
  No queda pendiente pedir aprobación a Jonathan sobre esa regla.
- El usuario confirmó que ya envió al grupo de Héctor y Jonathan la solicitud
  para identificar la unidad de cada artículo en compras y ventas y, si es
  posible, agregarla a las dos vistas. El 22-oct comunicó que Empaques, Tapas y
  Valvulas e Inyectables se miden en millares de unidades. Se registra como
  confirmación transmitida por el usuario, no como una columna nueva del ERP.
- La captura posterior del grupo muestra que el mensaje consultaba únicamente
  Empaques, Tapas y válvulas e Inyectables. Jonathan respondió que «en todas esas
  es millares de unidades» y que es lo mismo en compras y ventas. Esa respuesta
  no cambia Laminados, que conserva kilos según el PDF, ni traslada su flete por
  kilo a cantidades en millares. No queda pendiente repetir esa consulta de unidad.
- Cantidad y unidad bastan cuando compras y ventas están en la misma medida.
  Un factor solo es necesario si efectivamente difieren; no pedirlo como
  requisito universal ni convertir de nuevo cantidades ya normalizadas.
- Transformación se trabajará después. No mezclar con CPP su fórmula prevista:
  `(ventas - compras + inventario_final - inventario_inicial) / ventas`.

Los datos del Excel y el PDF son fuentes para analizar. Las decisiones del usuario
en esta sección son las instrucciones de alcance. La revisión actual de Laminados
debe conservar trazabilidad de diferencias de datos, sin forzar coincidencias con
ajustes manuales que no estén documentados por Jonathan.

## Alcance

Laminados, Empaques para alimentos, Tapas y Valvulas e Inyectables, con los nombres
del ERP. El documento de Jonathan del 21 de octubre de 2026 acredita kilos para
Laminados. Las otras tres líneas
conservan la cantidad original como millares, con `unidad = millar` y
`estado_unidad = confirmada_usuario`. Si compras y ventas están en esa misma
medida, `CPP = importe comprado / cantidad en millares` da Q por millar;
`cantidad vendida en millares × CPP` da el costo total sin otro factor de 1,000.

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
con la última carga completa exitosa que cubre cada fecha, conservando sus filas
partidas. Una factura que desaparece de esa carga ya no se rescata de un hash
antiguo. Exporta trazabilidad, cobertura, alertas y CPP por SKU. No ejecuta
migraciones ni modifica datos.

Para las tres líneas por artículo, la consulta recupera todo el historial propio
disponible en Postgres, sin filtrar por la categoría actual ni solo por A−1.

Para repetir sobre datos raw, agregar `--datos=/ruta/source.json` con un objeto
`{compras, ventas, batches}`. Los metadatos de cargas son necesarios para detectar
bajas. El formato antiguo de arrays sin batches se admite solo para diagnóstico
y queda marcado como insuficiente para aprobar producción. No versionar exportes
de datos del cliente.

## Integración local de Laminados

- `cppDatos.js`: lecturas de snapshots en transacción READ ONLY. Descarta cargas
  fallidas/incompletas y versiones que fueron reemplazadas, incluso por cargas
  vacías. No basta elegir el último registro de cada hash.
- `laminados.js`: CPP único, período actual/anterior y agrupaciones sin
  extrapolar márgenes ni promediar porcentajes. Corte explícito `corte_cpp` o
  último mes cerrado según Guatemala. Las compras usan el año disponible hasta
  el corte, aunque se filtre un mes, vendedor, cliente o producto.
- `laminadosHttp.js`: adapta ese resultado a las rutas existentes de Ventas y
  Márgenes cuando se selecciona Laminados. Incluye el detalle mensual y la matriz.
  También permite revisar `GET /api/margenes/cpp-laminados` con autenticación.
- La interfaz identifica el margen sobre materia prima y la fecha de corte;
  conserva N/D cuando falta costo. El detalle usa el mismo corte que el resumen.

## Pendientes registrados antes de la publicación del 21-oct-2026

Esta lista es histórica: el documento de operación indica lo resuelto para
Laminados y el estado actual de las tres líneas todavía no activadas.

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
5. Integrar la fuente CPP en los totales generales y módulos restantes, y definir
   su presentación junto con las otras metodologías antes del despliegue global.
6. Refrescar ventanas históricas completas: compras de septiembre y ventas de
   junio cambiaron después de su emisión. La ventana de siete días de compras y
   noventa de ventas no garantiza capturar esos cambios retroactivos. La lectura
   por snapshot resuelve bajas dentro de ventanas cargadas, pero no crea filas
   que nunca fueron extraídas ni actualiza ventanas que ya dejaron de refrescarse.

## Comprobación inicial del 21-oct-2026 (antes de corregir la lectura de snapshots)

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
86.10%. En esa auditoría inicial, los resultados de las tres líneas quedaban
provisionales hasta confirmar unidades; la confirmación posterior del usuario
se registra al inicio de este documento. Si faltan compras propias, se muestra N/D y no se sustituye
con el costo de otros productos.
