import ComoSeCalcula from './ComoSeCalcula'

// ---------------------------------------------------------------------------
// Glosario de métricas: cómo se calcula cada número de la plataforma.
// Uso: <Leyenda k="margen_bruto" />  → ⓘ discreto con la explicación.
//
// Los textos describen la lógica REAL del backend (rutas en backend/src/routes y
// vistas analitica.*). Si cambia un cálculo, actualizar aquí.
// ---------------------------------------------------------------------------

const L = ({ children }) => <ul className="list-disc pl-4 mt-1 space-y-0.5">{children}</ul>
const Nota = ({ children }) => <span className="block mt-1.5 text-[var(--text-muted)]">{children}</span>

export const LEYENDAS = {
  // ======================= Generales / Ventas =======================
  ventas: {
    titulo: 'Ventas (sin IVA)',
    texto: <>Suma sin IVA de las líneas de factura (tipo FACT) emitidas en el período. Las notas de crédito casi no se registran en el ERP, así que no se restan.</>,
  },
  vs_anio_anterior: {
    titulo: 'Comparación con el año anterior',
    texto: <>Se compara con el mismo rango de fechas un año antes. Si el período elegido dura más de un año, se compara con el período inmediatamente anterior de igual largo.</>,
  },
  cambio: {
    titulo: 'Cambio',
    texto: <>(Ventas del período − ventas del año anterior) ÷ ventas del año anterior. “Nuevo” = no tuvo ventas en el período anterior. Debajo, la diferencia en Q.</>,
  },
  margen_bruto: {
    titulo: 'Margen bruto',
    texto: <>
      Laminados usa CPP de materia prima en kilos. Empaques, Tapas y válvulas e Inyectables usan el costo ponderado de las compras del mismo producto, en millares.
      Las otras líneas conservan unidades × costo promedio facturado del ERP.
      <Nota>El total suma los márgenes de ambos métodos. Las ventas sin CPP se excluyen del numerador y denominador; no se les estima utilidad.</Nota>
    </>,
  },
  margen_mp: {
    titulo: 'Margen sobre costo de compras',
    texto: <>Ventas sin IVA menos cantidad vendida por el costo promedio ponderado de compras. Laminados usa kilos, con los fletes y respaldos de su metodología. Empaques, Tapas y válvulas e Inyectables usan millares y compras del mismo producto, incluidas las anteriores disponibles. El porcentaje usa únicamente ventas con CPP disponible; a las ventas sin CPP no se les estima utilidad.</>,
  },
  costo_cpp: {
    titulo: 'Costo promedio ponderado de compras',
    texto: <>Importe de compras sin IVA dividido entre la cantidad comprada. Laminados usa kilos, flete y respaldos por categoría, sublínea y color. Empaques, Tapas y válvulas e Inyectables usan millares y solo compras del mismo código: primero el año de venta y luego sus compras anteriores disponibles. Se utilizan compras de meses cerrados.</>,
  },
  margen_pts: {
    titulo: 'Puntos de margen',
    texto: <>Diferencia en puntos porcentuales entre el margen % del período y el del mismo período del año anterior (p. ej. 35% → 38% = +3 pts).</>,
  },
  pct_sin_costo: {
    titulo: 'Ventas sin costo',
    texto: <>% de ventas sin costo disponible: CPP pendiente en las cuatro líneas comerciales o costo 0 del ERP en las otras líneas. No se cuentan como 100% de margen.</>,
  },
  clientes_compraron: {
    titulo: 'Clientes que compraron',
    texto: <>Clientes distintos con al menos una factura en el período.</>,
  },
  ticket_promedio: {
    titulo: 'Ticket promedio',
    texto: <>Ventas sin IVA ÷ número de facturas del período.</>,
  },
  participacion: {
    titulo: '% del total',
    texto: <>Ventas de la fila ÷ ventas totales de la selección actual (respeta los filtros de período y producto).</>,
  },
  unidades: {
    titulo: 'Unidades',
    texto: <>Unidades facturadas en la unidad de medida de cada artículo (pueden ser piezas, kilos, yardas…), por eso sumar artículos distintos solo sirve como referencia.</>,
  },
  precio_promedio: {
    titulo: 'Precio promedio',
    texto: <>Ventas sin IVA ÷ unidades facturadas del artículo en el período.</>,
  },
  productos_skus: {
    titulo: 'Productos',
    texto: <>Códigos de artículo distintos con ventas en el período.</>,
  },
  efecto_precio: {
    titulo: 'Por precio',
    texto: <>Cambio de ventas por vender los <strong>mismos</strong> artículos más caros o más baratos: (precio promedio actual − precio promedio del año anterior) × unidades actuales. Se calcula artículo por artículo y se suma.</>,
  },
  efecto_cantidad: {
    titulo: 'Por cantidad',
    texto: <>Cambio de ventas por vender más o menos unidades de los <strong>mismos</strong> artículos: (unidades actuales − unidades del año anterior) × precio promedio del año anterior.</>,
  },
  productos_nuevos: {
    titulo: 'Productos nuevos',
    texto: <>Ventas de códigos que no se vendieron en el período anterior.</>,
  },
  productos_perdidos: {
    titulo: 'Ya no se venden',
    texto: <>Ventas del año anterior de códigos que no tuvieron venta este período. En producto a la medida, muchas veces un código nuevo reemplaza a uno viejo, así que este efecto y el de productos nuevos tienden a compensarse.</>,
  },
  puente: {
    titulo: 'Puente de variación',
    texto: <>
      Parte de las ventas del año anterior y suma o resta cada efecto hasta llegar a las de este período.
      Precio + cantidad + nuevos + ya no se venden (+ otros) = cambio total exacto.
      <Nota>“Otros” son líneas sin unidades, como servicios o ajustes.</Nota>
    </>,
  },
  venta_perdida: {
    titulo: 'Venta perdida',
    texto: <>Lo que vendieron el año anterior los elementos que este período no tuvieron ninguna venta.</>,
  },
  clientes_nuevos: {
    titulo: 'Clientes nuevos',
    texto: <>Clientes con ventas en el período que no compraron nada en el mismo período del año anterior.</>,
  },
  clientes_perdidos: {
    titulo: 'Clientes perdidos',
    texto: <>Clientes que compraron en el período del año anterior y en este no tienen ninguna factura. El monto es lo que compraron el año anterior.</>,
  },
  clientes_activos: {
    titulo: 'Clientes activos',
    texto: <>Clientes distintos con ventas en el período (respeta el filtro de producto).</>,
  },
  concentracion_top: {
    titulo: 'Concentración',
    texto: <>Ventas acumuladas de los N clientes más grandes ÷ ventas totales del período. Arriba de 50% en el top 10 se marca como concentración alta.</>,
  },
  pareto: {
    titulo: 'Curva de Pareto',
    texto: <>Barras: ventas de cada cliente ordenadas de mayor a menor. Línea: % acumulado de las ventas totales.</>,
  },
  vendedor_top: {
    titulo: 'Concentración por vendedor',
    texto: <>% de las ventas de la selección que factura el vendedor principal. Desde 40% se marca como concentración alta.</>,
  },
  matriz: {
    titulo: 'Matriz de ventas',
    texto: <>
      Ventas sin IVA del período cruzadas entre dos dimensiones. Modos:
      <L>
        <li><strong>% de la fila:</strong> celda ÷ total de su fila.</li>
        <li><strong>% de la columna:</strong> celda ÷ total de su columna.</li>
        <li><strong>Margen %:</strong> con el criterio de margen de la plataforma (s/c = sin costo).</li>
      </L>
      <Nota>Hasta 40 filas y 10 columnas; el resto se agrupa en “Otros”.</Nota>
    </>,
  },
  jerarquia_producto: {
    titulo: 'Categoría › Subcategoría › Sublínea',
    texto: <>Agrupación del catálogo del ERP: categoría = campo “marca” (Laminados, Liners…), subcategoría = “línea” y sublínea = “sublínea”.</>,
  },
  serie_mensual: {
    titulo: 'Serie mensual',
    texto: <>Ventas sin IVA por mes calendario dentro del período. El último mes puede estar incompleto si el período termina hoy.</>,
  },

  // ======================= Márgenes =======================
  semaforo_margen: {
    titulo: 'Semáforo de margen',
    texto: <>
      Margen % del período vs el mismo período del año anterior:
      <L>
        <li><strong>Verde:</strong> subió o bajó menos de 1 punto.</li>
        <li><strong>Ámbar:</strong> bajó entre 1 y 5 puntos.</li>
        <li><strong>Rojo:</strong> bajó más de 5 puntos.</li>
      </L>
      <Nota>Se excluyen productos cuyo margen del año anterior es mayor a 90% o menor a −10%: suele ser un costo mal cargado en el ERP.</Nota>
    </>,
  },
  semaforo_categoria: {
    titulo: 'Semáforo por categoría',
    texto: <>
      <L>
        <li><strong>Rojo:</strong> margen menor a 20% o cayó 5 puntos o más vs el año anterior.</li>
        <li><strong>Ámbar:</strong> margen menor a 30% o cayó 2 puntos o más.</li>
        <li><strong>Verde:</strong> el resto.</li>
      </L>
    </>,
  },
  necesitan_ajuste: {
    titulo: 'Necesitan ajuste de precio',
    texto: <>Productos en rojo (perdieron más de 5 puntos de margen vs el año anterior) y en ámbar (entre 1 y 5), entre los que vendieron Q1,000 o más en el período. Respeta el filtro de producto.</>,
  },
  precio_sugerido: {
    titulo: 'Precio sugerido',
    texto: <>Costo unitario actual ÷ (1 − margen del año anterior), es decir, el precio que recupera el margen anterior. Tope: +30% sobre el precio actual.</>,
  },
  costo_unitario: {
    titulo: 'Costo unitario',
    texto: <>Costo de ventas del período ÷ unidades vendidas. El costo de ventas sigue el criterio de margen: ventas − margen bruto.</>,
  },
  aporte_margen: {
    titulo: 'Aporte al margen',
    texto: <>Margen en Q de la fila ÷ margen en Q total de la selección.</>,
  },

  // ======================= Panel =======================
  health_score: {
    titulo: 'Health Score (0–100)',
    texto: <>
      Promedio ponderado de 7 puntajes, cada uno de 0 a 100:
      <L>
        <li>Crecimiento de ventas 20% · margen bruto 20% · EBITDA % 15%</li>
        <li>Cobertura CxC/CxP 15% · cartera vencida 10%</li>
        <li>Concentración del cliente #1 10% · disciplina de crédito 10%</li>
      </L>
      <Nota>80+ excelente · 65–79 saludable · 50–64 atención · menos de 50 crítico.</Nota>
    </>,
  },
  score_componentes: {
    titulo: 'Puntajes del Health Score',
    texto: <>
      <L>
        <li><strong>Crec.:</strong> 50 + 3 × variación % de ventas.</li>
        <li><strong>Margen:</strong> (margen % − 15) × 4.</li>
        <li><strong>EBITDA:</strong> (EBITDA % − 5) × 6.</li>
        <li><strong>WC:</strong> (cobertura CxC/CxP − 0.5) × 100.</li>
        <li><strong>Cobros:</strong> 100 − 2 × % de la cartera vencida.</li>
        <li><strong>Concent.:</strong> 100 − 2 × % de ventas del cliente #1.</li>
        <li><strong>Disc.:</strong> 100 − 3 × % de facturas con más días que el crédito pactado.</li>
      </L>
      <Nota>Cada puntaje se limita entre 0 y 100.</Nota>
    </>,
  },
  ebitda: {
    titulo: 'EBITDA estimado',
    texto: <>
      Margen bruto − gastos operativos del período. Margen % EBITDA = EBITDA ÷ ventas.
      <Nota>Es una aproximación: solo incluye los gastos que se registran como compras de “Gastos de Operación” en el ERP. Nómina y otros gastos fuera del ERP no están.</Nota>
    </>,
  },
  posicion_neta_wc: {
    titulo: 'Posición neta de capital de trabajo',
    texto: <>Saldo por cobrar − saldo por pagar, de documentos emitidos en el período. Cobertura = CxC ÷ CxP: arriba de 1× se cobra más de lo que se debe.</>,
  },
  dso_panel: {
    titulo: 'DSO · días cobrando',
    texto: <>
      Lo que los clientes deben hoy ÷ lo que se vende en un día (con IVA, promedio del período).
      <Nota>No cuenta facturas vencidas hace más de 90 días: se tratan como cobro dudoso y distorsionarían el número. Mismo cálculo que Análisis.</Nota>
    </>,
  },
  dio_panel: {
    titulo: 'DIO · días de inventario',
    texto: <>Inventario a costo hoy ÷ costo de venta diario del período. Mismo cálculo que Análisis.</>,
  },
  dpo_panel: {
    titulo: 'DPO · días pagando',
    texto: <>
      Lo que se debe hoy a proveedores ÷ lo que se compra en un día (con IVA, promedio del período).
      <Nota>No cuenta facturas de proveedor vencidas hace más de 90 días: casi siempre son saldos viejos sin depurar en el ERP, no deudas reales. Mismo cálculo que Análisis.</Nota>
    </>,
  },
  ccc_panel: {
    titulo: 'Ciclo de conversión de efectivo',
    texto: <>DSO + DIO − DPO: días que el efectivo queda atrapado entre pagar a proveedores y cobrar a clientes. Es el mismo número que en Análisis.</>,
  },
  cascada_pl: {
    titulo: 'Cascada P&L',
    texto: <>
      Ventas sin IVA − costo de ventas (COGS) = margen bruto − gastos operativos = EBITDA estimado.
      <Nota>COGS se calcula con el mismo criterio que el margen: ventas − margen bruto.</Nota>
    </>,
  },
  aging_cxc: {
    titulo: 'Antigüedad de CxC',
    texto: <>Saldo por cobrar del último corte del reporte de cartera del ERP, separado por días desde el vencimiento de cada documento. Solo documentos emitidos en el período.</>,
  },
  aging_cxp: {
    titulo: 'Antigüedad de CxP',
    texto: <>Saldo por pagar separado por días desde la fecha de vencimiento real de cada factura de proveedor. Solo facturas emitidas en el período.</>,
  },
  facturacion_yoy: {
    titulo: 'Facturación mensual',
    texto: <>Barras: ventas sin IVA de cada mes y del mismo mes del año anterior. Línea: margen % del mes. La línea punteada es el promedio mensual del período.</>,
  },
  compras_mp: {
    titulo: 'Compras de materia prima',
    texto: <>Compras sin IVA del período de artículos que no son gasto operativo. % = compras ÷ ventas del período.</>,
  },
  gastos_operativos: {
    titulo: 'Gastos operativos',
    texto: <>Compras sin IVA del período de artículos con categoría “Gastos de Operación” en el ERP. % = gastos ÷ ventas del período.</>,
  },
  rotacion_inventario: {
    titulo: 'Rotación comercial de inventarios',
    texto: <>Costo vendido anualizado ÷ inventario de artículos con venta directa observada. El stock sin consumo trazable sigue en el total, pero no se infiere rotación cero ni consumo a partir de compras.</>,
  },
  mix_lineas: {
    titulo: 'Mix de líneas',
    texto: <>Las 6 subcategorías (líneas) con más ventas del período, con su margen %. No incluye artículos genéricos del ERP (GENARTICULO, GENSERV…).</>,
  },
  top_deudores: {
    titulo: 'Top clientes deudores',
    texto: <>Clientes con mayor saldo por cobrar de documentos emitidos en el período.</>,
  },
  top_proveedores_cxp: {
    titulo: 'Top proveedores por pagar',
    texto: <>Proveedores con mayor saldo pendiente en facturas emitidas en el período.</>,
  },
  cxc_criticas: {
    titulo: 'CxC con +60 días de atraso',
    texto: <>Documentos con saldo pendiente cuyo vencimiento fue hace más de 60 días, ordenados por saldo.</>,
  },

  // ======================= Compras / Gastos =======================
  gasto_compras: {
    titulo: 'Compras (sin IVA)',
    texto: <>
      Suma sin IVA de las líneas de factura de proveedor emitidas en el período, con los filtros de arriba
      (tipo de compra, producto y proveedor). Se compara con el mismo rango de fechas del año anterior.
      <Nota>Incluye todo lo que se factura como compra en el ERP: materiales, servicios, gastos y activo fijo. Usá “Tipo de compra” para separarlos.</Nota>
    </>,
  },
  tipo_compra: {
    titulo: 'Tipo de compra',
    texto: <>
      Cada línea se clasifica por la jerarquía del artículo en el ERP:
      <L>
        <li><strong>Materiales e insumos:</strong> artículos que entran al inventario (laminados, liners, resinas, tapas…).</li>
        <li><strong>Costos de producción:</strong> servicios, repuestos, mantenimiento y materiales cargados al costo (categoría contable “Costo de Producción”).</li>
        <li><strong>Gastos de importación:</strong> fletes, aduana y demás costos de traer mercadería.</li>
        <li><strong>Gastos de operación:</strong> categoría contable “Gastos de Operación” y costos administrativos.</li>
        <li><strong>Activo fijo:</strong> mobiliario y equipo.</li>
      </L>
    </>,
  },
  compras_mensual: {
    titulo: 'Compras por mes',
    texto: <>Compras sin IVA de cada mes del período, apiladas por tipo de compra. La línea punteada es el mismo mes del año anterior (con los mismos filtros).</>,
  },
  inflacion_compras: {
    titulo: 'Variación de precios',
    texto: <>
      Cuánto cambió el precio unitario de los <strong>mismos artículos</strong> comprados en ambos períodos.
      <L>
        <li>Precio de cada período = compras sin IVA ÷ unidades.</li>
        <li>Promedio ponderado = Σ (precio actual − precio anterior) × unidades actuales ÷ Σ precio anterior × unidades actuales.</li>
      </L>
      <Nota>Solo materiales e insumos: los servicios y gastos no tienen un precio unitario comparable. Rojo = se paga más caro.</Nota>
    </>,
  },
  sobrecosto_precio: {
    titulo: 'Impacto del precio',
    texto: <>(Precio actual − precio del año anterior) × unidades compradas en el período. Es lo que se pagó de más (o de menos) solo por el cambio de precio. Sobrecosto = suma de los artículos que subieron; ahorro = de los que bajaron.</>,
  },
  cobertura_precios: {
    titulo: 'Cobertura de la comparación',
    texto: <>Qué parte de las compras de materiales del período corresponde a artículos que también se compraron el año anterior (valorados a precio anterior). El resto son artículos nuevos y no tienen contra qué compararse.</>,
  },
  precio_unitario_compra: {
    titulo: 'Precio unitario',
    texto: <>Compras sin IVA ÷ unidades compradas en el período. El “último precio” es el de la factura más reciente; el rango es el mínimo y máximo pagado en el período.</>,
  },
  puente_compras: {
    titulo: '¿Por qué cambió el gasto?',
    texto: <>
      Descompone la diferencia contra el año anterior, artículo por artículo:
      <L>
        <li><strong>Precio:</strong> (precio actual − anterior) × unidades actuales.</li>
        <li><strong>Volumen:</strong> (unidades actuales − anteriores) × precio anterior.</li>
        <li><strong>Nuevos / ya no se compraron:</strong> artículos comprados solo en uno de los dos períodos.</li>
        <li><strong>Servicios y gastos:</strong> diferencia de todo lo que no es material de inventario.</li>
      </L>
    </>,
  },
  top_categorias_compras: {
    titulo: 'Categorías de compra',
    texto: <>Compras sin IVA agrupadas por la jerarquía de producto: categoría (marca en el ERP) › subcategoría (línea) › sublínea.</>,
  },
  categorias_compras: {
    titulo: 'Compras por categoría',
    texto: <>
      Compras sin IVA agrupadas por el siguiente nivel de la jerarquía según el filtro de producto:
      categoría (marca en el ERP) › subcategoría (línea) › sublínea › artículo.
      <Nota>“Var. precio” es la variación de precios de los artículos de ese grupo comprados en ambos períodos.</Nota>
    </>,
  },
  top_proveedores: {
    titulo: 'Proveedores',
    texto: <>Proveedores ordenados por compras sin IVA del período. % = compras al proveedor ÷ compras totales con los mismos filtros.</>,
  },
  concentracion_proveedores: {
    titulo: 'Concentración de proveedores',
    texto: <>Cuántos proveedores, de mayor a menor, suman el 80% de las compras del período, y qué % suman los 5 más grandes. Mucha concentración = más riesgo si uno falla o sube precios.</>,
  },
  acumulado_pct: {
    titulo: '% acumulado',
    texto: <>Suma del % de este proveedor y de todos los que están arriba de él en el ranking por compras (curva de Pareto).</>,
  },
  proveedores_nuevos: {
    titulo: 'Proveedores nuevos',
    texto: <>Proveedores con compras en el período a los que no se les compró nada en el mismo período del año anterior.</>,
  },
  proveedores_dejados: {
    titulo: 'Ya no se les compró',
    texto: <>Proveedores con compras en el mismo período del año anterior y ninguna en el período actual.</>,
  },
  dias_pago_proveedor: {
    titulo: 'Días de pago',
    texto: <>
      Días reales entre la emisión de la factura y su último pago, promedio ponderado por monto, de las facturas
      por pagar del período que ya están pagadas. Debajo, el crédito que tiene el proveedor en su ficha del ERP.
    </>,
  },
  saldo_proveedor: {
    titulo: 'Por pagar',
    texto: <>Saldo pendiente hoy de todas las facturas por pagar del proveedor (sin importar la fecha de emisión).</>,
  },
  factura_promedio: {
    titulo: 'Factura promedio',
    texto: <>Compras sin IVA ÷ número de facturas del período. Debajo, el promedio mensual = compras ÷ meses del período.</>,
  },
  gasto_admin: {
    titulo: 'Gasto de administración',
    texto: <>
      Suma sin IVA de las facturas de compra con artículos de “Gastos de Operación” cuyo centro de costo
      (sublínea en el ERP) es “Administración”, emitidas en el período. Se compara con el mismo rango del año anterior.
      <Nota>Rojo = se gastó más que el año anterior.</Nota>
    </>,
  },
  pct_operativo_admin: {
    titulo: '% del gasto operativo',
    texto: <>Gasto de administración ÷ todo el gasto operativo del período (todos los centros de costo: administración, laminados, impresión, etc.).</>,
  },
  gasto_mensual_admin: {
    titulo: 'Gasto por mes',
    texto: <>Promedio mensual = gasto del período ÷ meses del período (días ÷ 30.4). La proyección anual multiplica ese promedio por 12. En la gráfica, el mes en curso está incompleto.</>,
  },
  rubro_admin: {
    titulo: 'Rubros',
    texto: <>
      Agrupación de la plataforma para leer los conceptos contables más fácil:
      <L>
        <li><strong>Instalaciones:</strong> alquileres, agua y energía, mantenimiento.</li>
        <li><strong>Servicios y tecnología:</strong> otros servicios, teléfono, software, equipo electrónico, suscripciones, honorarios.</li>
        <li><strong>Fletes e importación:</strong> pasajes, fletes y acarreos, gastos de importación.</li>
        <li><strong>Vehículos y viajes:</strong> gastos de vehículos, combustible, hospedaje, viáticos.</li>
        <li><strong>Personal:</strong> atención al personal, capacitación, uniformes y equipo SSO, gastos médicos.</li>
        <li><strong>Seguros y fianzas</strong> · <strong>Oficina y suministros</strong> · <strong>Otros</strong> (diversos, no deducibles, impuestos, multas, representación, publicidad).</li>
      </L>
    </>,
  },
  concepto_gasto: {
    titulo: 'Concepto de gasto',
    texto: <>
      En el ERP cada gasto se registra con un artículo cuyo nombre es el concepto contable; el código trae la cuenta
      (02GOA51106 → 5.1.1.06 Alquileres). Por mes = gasto del concepto ÷ meses del período. Proveedor principal = al que
      más se le pagó por ese concepto.
    </>,
  },
  recurrentes_admin: {
    titulo: 'Cargos que se repiten cada mes',
    texto: <>
      Mismo concepto y mismo proveedor facturado en al menos el 75% de los meses completos del período (mínimo 3).
      <L>
        <li><strong>Monto típico:</strong> la mediana de lo facturado en los meses con cargo.</li>
        <li><strong>Fijo:</strong> varía menos de 15% entre meses (contratos: alquiler, servicios fijos). <strong>Variable:</strong> depende del consumo (energía, combustible).</li>
      </L>
      <Nota>No se cuenta “El Portador” (proveedor genérico para compras sin proveedor identificado).</Nota>
    </>,
  },
  proveedores_admin: {
    titulo: 'Proveedores de administración',
    texto: <>Proveedores ordenados por gasto de administración del período. “Qué se le paga” lista los conceptos facturados por ese proveedor.</>,
  },
  iva_acreditable: {
    titulo: 'IVA acreditable',
    texto: <>IVA de las facturas de compra del período. El % es IVA ÷ base sin IVA.</>,
  },
  gasto_operativo: {
    titulo: 'Gasto operativo',
    texto: <>
      Suma sin IVA de las facturas de compra del período con artículos de “Gastos de Operación” en el ERP
      (con los filtros de centro, rubro y proveedor). Se compara con el mismo rango del año anterior; rojo = se gastó más.
    </>,
  },
  centros_costo: {
    titulo: 'Centros de costo',
    texto: <>
      El ERP registra el centro de costo en la sublínea del artículo de gasto (Administración, Laminados, Impresión…).
      La barra de cada centro está dividida por rubro; debajo, sus conceptos más grandes.
    </>,
  },
  gasto_vs_ventas: {
    titulo: 'Gasto contra ventas',
    texto: <>
      Gasto operativo ÷ ventas sin IVA del mismo período (o del mismo mes). “Por cada Q100 vendidos” = cuántos quetzales
      se fueron en gasto operativo. La comparación es en puntos contra el mismo período del año anterior.
      <Nota>Un mes alto puede ser un mes de ventas bajas, no necesariamente de más gasto.</Nota>
    </>,
  },
  reposicion: {
    titulo: 'Recomendación de reposición',
    texto: <>
      <L>
        <li><strong>Consumo</strong> = unidades compradas en los últimos N meses ÷ N.</li>
        <li><strong>Cobertura</strong> = (stock + en tránsito) ÷ consumo diario.</li>
        <li><strong>Cantidad sugerida</strong> = consumo del horizonte + stock de seguridad (30% del consumo durante el lead time) − stock − en tránsito.</li>
        <li><strong>Valor</strong> = cantidad × último costo. Proveedor sugerido = al que más se le compró en 12 meses.</li>
      </L>
    </>,
  },
  prioridad_reposicion: {
    titulo: 'Prioridad',
    texto: <>
      Según cobertura vs lead time (tiempo de entrega del proveedor):
      <L>
        <li><strong>Urgente:</strong> alcanza para menos que el lead time.</li>
        <li><strong>Alta:</strong> menos de 1.5× el lead time.</li>
        <li><strong>Media:</strong> menos de 2.5×.</li>
        <li><strong>OK:</strong> 2.5× o más.</li>
      </L>
    </>,
  },

  // ======================= Inventario =======================
  valor_stock: {
    titulo: 'Valor en stock',
    texto: <>Existencia × costo promedio del ERP, en la foto más reciente del inventario.</>,
  },
  articulos_con_stock: {
    titulo: 'Artículos con stock',
    texto: <>Códigos con existencia mayor a cero en la última foto del inventario.</>,
  },
  margen_teorico: {
    titulo: 'Margen bruto teórico',
    texto: <>
      Promedio simple del margen de lista de cada artículo: (precio de venta 1 − costo promedio) ÷ precio de venta 1, solo de los que tienen margen positivo.
      <Nota>No pondera por volumen ni usa precios reales de venta; para el margen real ver Ventas o Márgenes.</Nota>
    </>,
  },
  transito: {
    titulo: 'Stock en tránsito',
    texto: <>Unidades pedidas que aún no llegan × costo promedio.</>,
  },
  // ======================= Análisis › Ventas vs compras =======================
  vc_vendido: {
    titulo: 'Vendido',
    texto: <>Suma sin IVA de las facturas de venta (FACT) del tramo. Debajo, el cambio contra el mismo tramo del año anterior.</>,
  },
  vc_comprado: {
    titulo: 'Comprado',
    texto: <>Suma sin IVA de las facturas de compra del tramo. Con “Materiales e insumos” solo cuenta material de inventario; con “Todas” incluye gastos, fletes, importación y activo fijo. Debajo, el cambio contra el año anterior.</>,
  },
  vc_diferencia: {
    titulo: 'Diferencia',
    texto: <>Vendido − comprado, en quetzales. Negativo (rojo) = se compró más de lo que se vendió en ese grupo.</>,
  },
  vc_compra_venta: {
    titulo: 'Compra / venta',
    texto: <>Comprado ÷ vendido. Arriba de 100% (rojo) se compró más de lo que se vendió. “Solo compras” = el grupo no tuvo ventas.</>,
  },
  vc_delta_uds: {
    titulo: 'Δ inventario (unidades)',
    texto: <>
      Unidades compradas − unidades vendidas en el tramo, en la unidad de medida del ERP de cada artículo.
      <L>
        <li><strong>Positivo:</strong> entraron más unidades de las que salieron vendidas; el inventario creció.</li>
        <li><strong>Negativo:</strong> se vendió más de lo que se compró; salió de inventario o de producción propia.</li>
      </L>
      Debajo, las unidades compradas y vendidas, y el delta del mismo tramo del año anterior.
      <Nota>“Incluye materia prima” = más de la mitad de lo comprado son artículos que no se venden tal cual (resina, rollos madre), así que compara unidades distintas (p. ej. kilos contra piezas). Úsalo como referencia, no como existencia exacta.</Nota>
    </>,
  },
  costo_vendido: {
    titulo: 'Costo vendido',
    texto: <>Costo de las facturas de venta del período, con el mismo criterio que el margen (ventas − margen bruto).</>,
  },
  compras_periodo: {
    titulo: 'Compras del período',
    texto: <>Compras sin IVA de materia prima y mercadería en el período, sin gastos operativos.</>,
  },
  rotacion_anual: {
    titulo: 'Rotación anual',
    texto: <>Costo vendido del período anualizado ÷ valor del inventario hoy. Días de inventario = inventario ÷ costo vendido diario.</>,
  },
  sin_venta_periodo: {
    titulo: 'Con stock y sin venta',
    texto: <>
      Valor de los artículos con existencia que no tuvieron ninguna factura de venta en el período.
      <Nota>Incluye materia prima, que no se vende directamente; para distinguirla ver Análisis › Capital inmovilizado.</Nota>
    </>,
  },
  dias_inventario_grupo: {
    titulo: 'Días de inventario',
    texto: <>Valor del stock del grupo ÷ su costo vendido diario en el período. “Sin venta en el período” = sin costo vendido.</>,
  },
  inv_tipo_articulo: {
    titulo: 'Tipo de artículo',
    texto: <>Producto: venta directa observada. Materia prima / insumo: compras sin venta directa registrada. Sin trazabilidad: sin compras/ventas en las fuentes disponibles. La relación insumo-producto transformado todavía no está expuesta.</>,
  },
  inv_salida: {
    titulo: 'Salida comercial del período',
    texto: <>Costo de ventas del artículo. Las salidas a producción no están disponibles y se muestran como pendientes; no se estiman a partir de las compras. Salida mensual = costo vendido ÷ días del período × 30.</>,
  },
  inv_dias: {
    titulo: 'Días de inventario comercial',
    texto: <>Valor del stock de artículos con venta directa ÷ costo vendido diario. Se excluye de ambos lados el stock sin consumo trazable. Rotación = 365 ÷ días. El inventario total sigue incluyendo los materiales pendientes.</>,
  },
  inv_cobertura: {
    titulo: 'Cobertura por artículo',
    texto: <>Valor en stock ÷ salida comercial diaria del período. Sin salida comercial medida no equivale a falta de transformación. Para materiales sin consumo trazable, la cobertura está por validar.</>,
  },
  inv_objetivo: {
    titulo: 'Cobertura objetivo',
    texto: <>Días de inventario que se consideran sanos para tener en bodega. Lo que pase de ese nivel cuenta como exceso. Cámbialo para ver cuánto capital se liberaría con una política más o menos holgada (con importaciones de ~45 días, 90 es razonable).</>,
  },
  inv_quieto: {
    titulo: 'Capital quieto',
    texto: <>Suma de estados lento e inmovilizado para artículos con venta directa observada. Los insumos sin consumo trazable se muestran como Consumo por validar y no se incluyen como activos ni quietos.</>,
  },
  inv_exceso: {
    titulo: 'Exceso de inventario comercial',
    texto: <>Para artículos con venta directa: valor en stock − salida comercial diaria × objetivo, si es positivo. Los materiales sin salidas de producción disponibles no generan exceso automático. El inventario total conserva su valor.</>,
  },
  inv_quiebre: {
    titulo: 'Quiebre de stock',
    texto: <>Artículo con venta directa recurrente, en cero, sin tránsito: ventas en al menos 3 de los últimos 6 meses y alguna en los últimos 90 días. Sin consumos de producción disponibles no se infiere quiebre de materia prima por sus compras.</>,
  },
  inv_abc: {
    titulo: 'Clasificación ABC comercial',
    texto: <>Pareto por costo vendido en el período: A suma el primer 80%, B el siguiente 15% y C el resto. Sin salida medida incluye artículos sin costo vendido y materiales cuyo consumo de producción no está disponible; no significa que no se utilicen.</>,
  },
  inv_matriz_abc: {
    titulo: 'Matriz ABC × cobertura',
    texto: <>Valor en stock cruzando la clase ABC con los días de cobertura de cada artículo. Bordes rojos: artículos A con menos de 30 días (riesgo de quiebre) y C o sin salida con más de 180 días (capital estancado).</>,
  },
  inv_composicion: {
    titulo: 'Inventario por grupo',
    texto: <>Valor en stock, días de inventario, % en estado lento o inmovilizado, exceso sobre la cobertura objetivo y quiebres de cada grupo de la jerarquía Categoría › Subcategoría › Sublínea.</>,
  },
  inv_dias_sin_mov: {
    titulo: 'Tiempo desde la última venta directa',
    texto: <>Días desde la última venta del artículo. Para materias primas o registros sin trazabilidad de salida, queda pendiente. La última compra se muestra por separado y no demuestra consumo.</>,
  },
  inv_proveedor: {
    titulo: 'Proveedor principal',
    texto: <>
      La foto de inventario del ERP no trae proveedor, así que a cada artículo se le asigna el proveedor al que más se le compró (monto sin IVA) en los últimos 24 meses.
      <Nota>“Sin compras registradas”: artículos fabricados o que no se compraron en 24 meses.</Nota>
    </>,
  },
  top_proveedores_stock: {
    titulo: 'Proveedores por valor en stock',
    texto: <>Valor del stock con existencia, agrupado por el proveedor asignado al artículo en el ERP.</>,
  },

  // ======================= Tesorería =======================
  efectivo_bancos: {
    titulo: 'Efectivo en bancos',
    texto: <>El ERP actual no expone saldos bancarios, por eso no se muestra.</>,
  },
  cxc_vencida_pct: {
    titulo: 'Cartera vencida (%)',
    texto: <>Saldo de documentos de clientes que ya pasaron su fecha de vencimiento ÷ saldo total por cobrar, del último corte del reporte de cartera del ERP (documentos emitidos en el período). Semáforo: más de 30% rojo, de 25% a 30% amarillo, menos de 25% verde.</>,
  },
  cxc_total: {
    titulo: 'Por cobrar (CxC)',
    texto: <>Saldo pendiente de documentos de clientes emitidos en el período, según el último corte del reporte de cartera del ERP.</>,
  },
  cxp_total: {
    titulo: 'Por pagar (CxP)',
    texto: <>Saldo pendiente de facturas de proveedor emitidas en el período.</>,
  },
  cxc_riesgo: {
    titulo: '+60 días',
    texto: <>Saldo de documentos vencidos hace más de 60 días.</>,
  },
  por_vencer: {
    titulo: 'Por vencer',
    texto: <>Saldo de documentos cuya fecha de vencimiento todavía no llega.</>,
  },
  proximos_pagos: {
    titulo: 'Próximos pagos',
    texto: <>Facturas de proveedor con saldo cuyo vencimiento cae en los próximos 30 días.</>,
  },
  credito_ficha_factura: {
    titulo: 'Crédito: ficha · factura',
    texto: <>
      <strong>Ficha:</strong> días de crédito pactados en el ERP. <strong>Factura:</strong> días entre la emisión y el vencimiento de esa factura.
      <Nota>Si la factura da más días que la ficha, el crédito se extendió.</Nota>
    </>,
  },
  dias_vencido: {
    titulo: 'Días',
    texto: <>Días desde la fecha de vencimiento hasta hoy. Si aún no vence, aparece al corriente.</>,
  },
  dias_restantes: {
    titulo: 'Días para el vencimiento',
    texto: <>Días que faltan desde hoy hasta la fecha de vencimiento de la factura. En rojo, 7 días o menos.</>,
  },
  atraso_promedio: {
    titulo: 'Atraso promedio',
    texto: <>Promedio simple, por documento, de los días transcurridos desde su vencimiento (0 si aún no vence). No pondera por monto.</>,
  },
  pct_cxp: {
    titulo: '% del CxP',
    texto: <>Saldo pendiente del proveedor ÷ saldo total por pagar.</>,
  },
  dias_credito: {
    titulo: 'Días de crédito',
    texto: <>Días de crédito pactados en la ficha del proveedor o cliente en el ERP.</>,
  },

  // ======================= Ficha de cliente (CxC) =======================
  cxc_por_cliente: {
    titulo: 'Cartera por cliente',
    texto: <>
      Saldo del último corte de cartera del ERP sumado por cliente (documentos emitidos en el período).
      <Nota>“Paga en” y “A tiempo” salen de las facturas que el cliente terminó de pagar en el período. Clic en un cliente para ver su ficha.</Nota>
    </>,
  },
  saldo_cliente: {
    titulo: 'Saldo del cliente',
    texto: <>
      Todo lo que el cliente debe al último corte del reporte de cartera, sin importar cuándo se emitió el documento.
      <Nota>Por eso puede ser mayor que lo que suma en la lista de Cuentas por Cobrar, que solo cuenta documentos emitidos en el período.</Nota>
    </>,
  },
  dias_pago_real: {
    titulo: 'Días reales de pago',
    texto: <>
      Para cada factura ya pagada: fecha del último cobro − fecha de emisión. Promedio ponderado por el valor de la factura.
      <Nota>Solo facturas que terminaron de pagarse en el período. Se compara con el mismo rango del año anterior y con los días de crédito de su ficha.</Nota>
    </>,
  },
  atraso_pago: {
    titulo: 'Atraso al pagar',
    texto: <>
      Fecha del último cobro − fecha de vencimiento, ponderado por monto. Negativo = paga antes de vencer.
    </>,
  },
  pct_a_tiempo: {
    titulo: 'Pagado a tiempo',
    texto: <>% del monto de las facturas pagadas en el período cuyo último cobro fue en o antes de su vencimiento.</>,
  },
  plazo_facturado: {
    titulo: 'Plazo en factura',
    texto: <>
      Días entre emisión y vencimiento con que se emitieron sus facturas, ponderado por monto.
      <Nota>Si es mayor que los días de la ficha, se le está dando más crédito del pactado.</Nota>
    </>,
  },
  peor_atraso: {
    titulo: 'Peor atraso',
    texto: <>El mayor número de días que una factura pagada en el período se cobró después de vencer.</>,
  },
  estado_cuenta: {
    titulo: 'Estado de cuenta',
    texto: <>
      Documentos con saldo al último corte del reporte de cartera del ERP.
      <L>
        <li><strong>Valor:</strong> monto original de la factura (con IVA).</li>
        <li><strong>Abonado:</strong> valor − saldo.</li>
        <li><strong>Último abono:</strong> fecha del cobro más reciente aplicado a esa factura.</li>
      </L>
    </>,
  },
  facturado_cobrado: {
    titulo: 'Facturado vs cobrado',
    texto: <>
      <strong>Facturado:</strong> valor con IVA de las facturas emitidas en el mes. <strong>Cobrado:</strong> valor de las facturas que terminaron de pagarse en el mes.
      <Nota>Los abonos parciales cuentan hasta que la factura se liquida. El historial del ERP empieza en septiembre de 2024.</Nota>
    </>,
  },
  distribucion_atraso: {
    titulo: 'Cuándo paga',
    texto: <>Las últimas facturas pagadas (hasta 200), agrupadas por días entre el vencimiento y el último cobro, ponderadas por monto.</>,
  },
  compras_cliente: {
    titulo: 'Compras del cliente',
    texto: <>Ventas sin IVA facturadas al cliente en el período, mismo criterio que el módulo de Ventas. Se compara con el mismo rango del año anterior.</>,
  },
  frecuencia_compra: {
    titulo: 'Frecuencia de compra',
    texto: <>Días promedio entre fechas con compra en los últimos 12 meses: (última compra − primera) ÷ (días con compra − 1).</>,
  },
  senales_cliente: {
    titulo: 'Señales',
    texto: <>Reglas fijas sobre los números de esta ficha (atraso de más de 5 días, cambio de 7+ días en el tiempo de pago, compras ±15%, días sin comprar más de 2.5× su frecuencia). No es IA.</>,
  },

  // ======================= Análisis =======================
  ciclo_caja: {
    titulo: 'Ciclo de caja',
    texto: <>
      Días de cobro + días de inventario − días de pago.
      <L>
        <li><strong>Cobro:</strong> lo que deben los clientes hoy ÷ ventas de un día (con IVA).</li>
        <li><strong>Inventario:</strong> inventario a costo hoy ÷ costo de lo vendido en un día.</li>
        <li><strong>Pago:</strong> lo que se debe a proveedores hoy ÷ compras de un día (con IVA).</li>
      </L>
      <Nota>Los promedios diarios son del período seleccionado. No se cuentan saldos vencidos hace más de 90 días (cobros dudosos y facturas de proveedor sin depurar), que se muestran aparte al final de la página.</Nota>
    </>,
  },
  // ======================= Rotación de inventarios =======================
  rotacion_inventario: {
    titulo: 'Rotación de inventarios',
    texto: <>
      Cuántas veces al año se vende y repone todo el inventario.
      <L>
        <li><strong>Fórmula:</strong> costo de ventas ÷ inventario promedio, ambos a costo.</li>
        <li>El costo de ventas del período se lleva a un año (× 365 ÷ días del período) para comparar períodos de distinto largo.</li>
      </L>
      <Nota>Más alto es mejor: 4× significa que el inventario se renueva cada 3 meses. Un grupo que solo tiene materia prima se mide con lo que se compra para reponerla (ver “Rotación por tipo”).</Nota>
    </>,
  },
  dias_inventario_rot: {
    titulo: 'Días de inventario comercial',
    texto: <>365 ÷ rotación comercial. Se calcula sobre artículos con venta directa observada. El DIO del ciclo de caja tiene otro alcance y no es necesariamente igual.</>,
  },
  costo_ventas_rot: {
    titulo: 'Costo de ventas',
    texto: <>
      Lo que costó la mercadería vendida en el período (COGS). Mismo criterio que Márgenes: el margen se mide con las líneas que traen costo y se aplica a las que no; si un artículo no tiene ninguna línea con costo, se usa el margen global.
      <Nota>Ya incluye la materia prima consumida para fabricar lo vendido.</Nota>
    </>,
  },
  inventario_promedio: {
    titulo: 'Inventario promedio',
    texto: <>
      Promedio del valor del inventario a costo en las fotos diarias del período.
      <Nota>El ERP no guarda el inventario de días pasados. La plataforma guarda una foto diaria desde el 9 oct 2026; mientras se arma la historia, el promedio usa las fotos disponibles o, si no hay ninguna en el período, el inventario de hoy.</Nota>
    </>,
  },
  rotacion_por_tipo: {
    titulo: 'Rotación por tipo',
    texto: <>Costo de ventas para los artículos con venta directa. El consumo de materias primas está por validar; sus compras no sustituyen salidas de producción.</>,
  },
  salida_articulo: {
    titulo: 'Salida comercial por artículo',
    texto: <>Costo vendido en el período. Sin consumos de producción disponibles, la salida de materia prima permanece pendiente, aunque haya compras.</>,
  },
  inventario_vs_costo: {
    titulo: 'Peso en inventario vs en costo de ventas',
    texto: <>
      Qué parte del inventario total tiene cada grupo (azul) y qué parte del costo de ventas genera (verde).
      <Nota>Si el azul es mucho mayor que el verde, ese grupo acumula más inventario del que su venta justifica y rota más lento que el promedio.</Nota>
    </>,
  },
  sin_salida: {
    titulo: 'Sin venta comercial medida',
    texto: <>Artículos con venta directa en su historia pero sin costo vendido en el período. No incluye como inmovilizados los materiales con consumo por validar.</>,
  },
  distribucion_rotacion: {
    titulo: 'Cobertura comercial',
    texto: <>Stock según su costo vendido diario. Sin salida medida incluye códigos sin costo vendido y materiales con consumo de producción pendiente. No demuestra que no se transformen.</>,
  },
  salida_mensual: {
    titulo: 'Ventas a costo y compras mensuales',
    texto: <>Costo vendido y compras sin IVA de la selección. Las compras son entradas; la diferencia con ventas a costo no permite concluir por sí sola que el inventario crece.</>,
  },
  capital_trabajo: {
    titulo: 'Capital de trabajo',
    texto: <>
      El dinero que el negocio tiene “atrapado” en la operación del día a día:
      <L>
        <li><strong>+ Por cobrar a clientes:</strong> facturas de clientes pendientes de pago.</li>
        <li><strong>+ Inventario:</strong> mercadería en bodega, valuada a costo.</li>
        <li><strong>− Por pagar a proveedores:</strong> facturas de proveedores aún no pagadas; ese dinero lo financia el proveedor.</li>
      </L>
      <Nota>
        Saldos a hoy. En cobros y pagos no se cuentan facturas vencidas hace más de 90 días: las de clientes se tratan como cobro dudoso y las de proveedores casi siempre son saldos viejos sin depurar en el ERP.
        El % compara ese dinero con las ventas de un año al ritmo del período: cuántos quetzales hay atrapados por cada Q100 vendidos.
      </Nota>
    </>,
  },
  caja_crecimiento: {
    titulo: 'Caja que pide el crecimiento',
    texto: <>Capital de trabajo como % de las ventas × el aumento anual de ventas si se repite el crecimiento del período vs el año anterior. Es la caja extra que el negocio inmoviliza para crecer.</>,
  },
  liberar_caja: {
    titulo: 'Caja que se libera',
    texto: <>Valor de un día del componente × 10 días. Cobro: ventas con IVA ÷ días; inventario: costo de venta ÷ días; pago: compras con IVA ÷ días.</>,
  },
  dias_reales: {
    titulo: 'Días reales de cobro y pago',
    texto: <>Para las facturas cobradas (o pagadas) cada mes: días entre la emisión y el último cobro (o pago), promediados y ponderados por monto.</>,
  },
  proyeccion_ventas: {
    titulo: 'Modelo de proyección',
    texto: <>
      Promedio de los últimos 12 meses × crecimiento interanual × estacionalidad del mes (atenuada al 50%, porque hay pocos años de historia).
      <Nota>Usa los meses completos; el mes en curso se compara con lo facturado a la fecha.</Nota>
    </>,
  },
  crecimiento_interanual: {
    titulo: 'Crecimiento interanual',
    texto: <>Ventas de los últimos 12 meses completos ÷ ventas de los 12 anteriores − 1.</>,
  },
  error_modelo: {
    titulo: 'Error típico del modelo',
    texto: <>
      Se pronosticaron los últimos 6 meses como si fuera un mes antes y se comparó con lo real. Error típico = raíz del error cuadrático medio (mínimo ±8%).
      <Nota>El rango probable (~80%) es ±1.28 × error × √meses de distancia.</Nota>
    </>,
  },
  flujo_entradas: {
    titulo: 'Entradas',
    texto: <>Cobro de la cartera pendiente en su vencimiento + el atraso histórico de cada cliente, más el cobro de las ventas proyectadas que aún no se facturan.</>,
  },
  flujo_salidas: {
    titulo: 'Salidas',
    texto: <>Pago a proveedores en su fecha de vencimiento, más las compras proyectadas al ritmo de los últimos 12 meses. No incluye nómina, impuestos ni deuda (no vienen del ERP).</>,
  },
  flujo_neto: {
    titulo: 'Flujo neto acumulado',
    texto: <>
      Entradas − salidas, acumuladas semana a semana desde hoy. No es saldo en caja porque no hay saldo bancario de partida.
      <Nota>Lo ya vencido se reparte en las primeras 4 semanas. CxC y CxP vencidas hace más de 90 días quedan fuera.</Nota>
    </>,
  },

  // ======================= Inventario quieto (Capital inmovilizado) =======================
  inventario: {
    titulo: 'Inventario a costo',
    texto: <>Existencia actual × costo promedio del ERP, en la foto más reciente del inventario. Solo cuenta artículos con existencia mayor a cero.</>,
  },
  por_validar: {
    titulo: 'Consumo por validar',
    texto: <>Stock conservado en el inventario total, sin trazabilidad de sus salidas a producción. No se clasifica como activo, lento, inmovilizado ni exceso usando ventas o recompras. Falta relacionar el insumo con el producto transformado y su consumo.</>,
  },
  inmovilizado: {
    titulo: 'Inmovilizado',
    texto: <>Artículos con venta directa registrada, sin venta comercial en los últimos 180 días. No incluye insumos sin trazabilidad de consumo. Esta señal comercial no demuestra ausencia de uso en producción.</>,
  },
  lento: {
    titulo: 'Lento',
    texto: <>Artículos con venta directa observada cuyo stock supera 180 días al ritmo de costo vendido. Las compras no se utilizan como consumo de materias primas.</>,
  },
  activo: {
    titulo: 'Activo',
    texto: <>Artículos con venta directa observada y cobertura comercial de hasta 180 días. El stock con consumo pendiente de validar se muestra por separado.</>,
  },
  quieto: {
    titulo: 'Capital quieto',
    texto: <>Capital quieto = inmovilizado + lento. <br />% quieto = capital quieto ÷ inventario a costo.</>,
  },
  cobertura: {
    titulo: 'Cobertura comercial (días)',
    texto: <>Valor del stock evaluable ÷ costo vendido diario de los últimos 180 días. El stock sin salidas de producción disponibles no entra en esta cobertura. Las compras no equivalen a consumo.</>,
  },
  unidades: {
    titulo: 'Unidades en stock',
    texto: <>
      Existencia actual en la unidad de medida del ERP de cada artículo (rollos, kilos, millares, unidades…), en la foto más reciente del inventario.
      <Nota>En categorías y subcategorías es la suma de artículos que pueden tener distinta unidad de medida: sirve para ver volumen, no para comparar entre grupos.</Nota>
    </>,
  },
  articulos: {
    titulo: 'Artículos quietos',
    texto: <>Artículos en estado lento o inmovilizado, sobre el total de artículos con existencia.</>,
  },
  tipo: {
    titulo: 'Tipo de inventario',
    texto: <>Producto: tiene venta directa en los registros disponibles. Materia prima / insumo: tiene compras sin venta directa registrada; es una clasificación por actividad, pendiente de relacionar con producción. Sin trazabilidad: sin compras ni ventas en las fuentes disponibles; puede tener transformación no expuesta.</>,
  },
  antiguedad: {
    titulo: 'Tiempo desde la última venta directa',
    texto: <>Días desde la última venta registrada del código. Para artículos sin venta directa, el consumo está por validar; la fecha de compra no se usa como fecha de salida ni como edad del stock.</>,
  },
  corte: {
    titulo: 'Foto al corte',
    texto: <>Es el stock de la última carga del ERP. No depende del filtro de período: las ventas y compras se miden en ventanas fijas (180 y 365 días) contadas desde hoy.</>,
  },
  categoria: {
    titulo: 'Categoría › Subcategoría › Sublínea',
    texto: <>Agrupación del catálogo del ERP: categoría = campo “marca” (Laminados, Liners…), subcategoría = “línea” y sublínea = “sublínea”. Es la misma que se usa en Ventas.</>,
  },
}

// <Leyenda k="margen_bruto" />  ·  claro: true para fondos oscuros
export function Leyenda({ k, className = '', claro = false }) {
  const l = LEYENDAS[k]
  if (!l) {
    if (import.meta.env.DEV) console.warn(`[Leyenda] clave desconocida: ${k}`)
    return null
  }
  return (
    <ComoSeCalcula titulo={l.titulo} className={className} claro={claro}>
      {l.texto}
    </ComoSeCalcula>
  )
}
