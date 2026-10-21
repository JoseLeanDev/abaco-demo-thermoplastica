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
de compras y ventas use la misma unidad y que todos los artículos agrupados sean
comparables. Postgres actualmente no contiene código de unidad ni conversión.
La consistencia numérica con costos/precios de un SKU es evidencia auxiliar,
no una confirmación de la unidad. Los fletes por kilo del PDF solo se aplican a
compras identificadas como Laminados. Una coincidencia de proveedor en otra línea
queda pendiente; no se multiplica por una cantidad de unidad desconocida.

## Reglas implementadas

- CPP = suma de compras sin IVA más flete / suma de cantidad comprada.
- Corte de compras explícito al último día de un mes cerrado. Las compras usan
  el año disponible hasta ese corte, independientemente del filtro de ventas.
- Jerarquía: año actual exacto/categoría+sublínea/categoría, luego H2 anterior
  con esos tres niveles, luego año anterior completo con los mismos niveles.
- Llaves originales `categoria`, `sublinea`, `color`, con espacios eliminados en
  los extremos y nulos como cadena vacía. No usar los alias visuales del frontend.
- Besel/Basim: Q3.90/kg; Maximore/M&M: Q2.34/kg hasta 2025 y Q3.90/kg en 2026.
- Foil de Aluminio, 25 micras, Mate, 2026: Q75.99/kg reemplaza compras.
- Aluminio Impreso Q82 y Foil aluminio blister impreso Q70.40: solo respaldo
  después de agotar la jerarquía, dentro de las líneas autorizadas.
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

Para repetir sobre datos raw extraídos previamente, agregar `--datos=/ruta/source.json`.
Ese archivo debe contener `[compras_raw, ventas_raw]`, con identificador de batch,
hash y timestamp de ingesta. No se deben versionar exportes de datos del cliente.

## Antes de activar

1. Confirmar unidades y homogeneidad de los grupos en las otras tres líneas.
   Especialmente, aprobar o cambiar la preferencia de la categoría completa del
   año actual sobre compras anteriores del mismo SKU o presentación. La
   auditoría replica literalmente el PDF para hacer visible el efecto; no
   significa que esa ampliación ya esté validada para las otras tres líneas.
2. Conciliar las diferencias de PVC UV, ACLAR y PET con el reporte del cliente.
3. Confirmar el límite comercial de Laminados frente a Almacén General e impresos
   de Flexografía. El alcance actual no los agrega silenciosamente a Laminados.
4. Resolver el histórico: detalle disponible desde 18-sep-2024; no hay 2024
   completo ni 2023 para respaldos anteriores. La auditoría muestra ese límite.
5. Integrar una sola fuente de costo y base del margen en los módulos afectados,
   incluyendo importes y porcentajes, una vez validados los puntos anteriores.

## Comprobación del 21-oct-2026

Prueba de enero a septiembre de 2026 contra Postgres, con compras al 30-sep-2026:

| Línea | SKUs vendidos | Ventas con CPP encontrado | Unidad |
| --- | ---: | ---: | --- |
| Laminados | 259 | 99.88% | kg documentado en el PDF |
| Empaques para alimentos | 12 | 100% | por confirmar |
| Tapas y Valvulas | 50 | 100% | por confirmar |
| Inyectables | 26 | 100% | por confirmar |

La cobertura describe coincidencias de CPP, no validación física de las unidades.
Las cuatro líneas coinciden, dentro del redondeo a centavos, con un cálculo
independiente usando Decimal. Se verificaron, entre otros, los CPP Q65.08504598
para M077260150 y Q226.04979778 para M097410110/M097410155. Las 20 pruebas
financieras del módulo pasan.

En los SKUs con compra directa 2025/2026 se contrastaron las escalas de importes
por cantidad frente a costos del ERP: no se detectó un desfase de factor 1,000.
Esto no acredita por sí solo que las cantidades sean piezas, cajas o millares.
Los fletes por kilo del PDF solo aparecen en compras de Laminados dentro de
estas cuatro líneas.

Hay una llave genérica de Tapas y Valvulas (VTESPA2, No Aplica/No Aplica/No Aplica)
que mezcla compras de Articulos de Servicio, Serigrafia y Tapas y Valvulas. Se
marca `grupo_cpp_con_varias_lineas`; su promedio requiere revisión antes de
publicar. En Laminados también se señala la mezcla con Almacén General, que
forma parte de la metodología comercial del reporte y debe confirmarse al
definir el alcance definitivo. No se considera que un 100% de cobertura elimine
estas alertas.

Un ejemplo material es I110NBB38 (vial de 3 ml): al no haber compra exacta en 2026,
la regla L3 toma Viales de ese año, CPP Q114.42886641 por unidad exportada. Hay
una compra 2025 del mismo SKU a Q594.64468776 por unidad exportada. Aplicar el
primer promedio genera 86.10% de margen; no es una discrepancia de factor 1,000,
sino del grupo de productos elegido. En las tres líneas nuevas los respaldos de
categoría se marcan `respaldo_categoria_en_linea_no_validada` y todos los
resultados quedan provisionales hasta confirmar unidades y agrupaciones. No se
cambia automáticamente la jerarquía del cliente para ocultar esta diferencia.
