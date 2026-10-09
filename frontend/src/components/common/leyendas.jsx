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
      Margen % = (ventas − costo) ÷ ventas, usando solo las líneas que traen costo en el ERP
      (costo = unidades × costo promedio facturado).
      <Nota>El margen en Q aplica ese % a todas las ventas. Las ventas que vienen sin costo se informan aparte y no entran al %.</Nota>
    </>,
  },
  margen_pts: {
    titulo: 'Puntos de margen',
    texto: <>Diferencia en puntos porcentuales entre el margen % del período y el del mismo período del año anterior (p. ej. 35% → 38% = +3 pts).</>,
  },
  pct_sin_costo: {
    titulo: 'Ventas sin costo',
    texto: <>% de las ventas cuyas líneas llegan del ERP con costo 0. No se cuentan como 100% de margen: se excluyen del margen %.</>,
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
  dejaste_de_ganar: {
    titulo: 'Q que dejaste de ganar',
    texto: <>
      Ventas del período × puntos de margen perdidos ÷ 100, solo donde el margen bajó vs el año anterior.
      Es lo que se habría ganado vendiendo lo mismo con el margen del año anterior.
      <Nota>En el resumen se suma sobre los 50 productos de mayor venta (≥ Q1,000 en el período).</Nota>
    </>,
  },
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
    texto: <>Productos en rojo (perdieron más de 5 puntos de margen) y en ámbar (entre 1 y 5), entre los 50 de mayor venta del período.</>,
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
      <Nota>No cuenta facturas vencidas hace más de 90 días: se tratan como cobro dudoso y distorsionarían el número. Mismo cálculo que Salud financiera.</Nota>
    </>,
  },
  dio_panel: {
    titulo: 'DIO · días de inventario',
    texto: <>Inventario a costo hoy ÷ costo de venta diario del período. Mismo cálculo que Salud financiera.</>,
  },
  dpo_panel: {
    titulo: 'DPO · días pagando',
    texto: <>
      Lo que se debe hoy a proveedores ÷ lo que se compra en un día (con IVA, promedio del período).
      <Nota>No cuenta facturas de proveedor vencidas hace más de 90 días: casi siempre son saldos viejos sin depurar en el ERP, no deudas reales. Mismo cálculo que Salud financiera.</Nota>
    </>,
  },
  ccc_panel: {
    titulo: 'Ciclo de conversión de efectivo',
    texto: <>DSO + DIO − DPO: días que el efectivo queda atrapado entre pagar a proveedores y cobrar a clientes. Es el mismo número que en Salud financiera.</>,
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
    titulo: 'Rotaciones al año',
    texto: <>365 ÷ días de inventario (DIO): cuántas veces al año se renueva el stock al ritmo de venta del período.</>,
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
  iva_acreditable: {
    titulo: 'IVA acreditable',
    texto: <>IVA de las facturas de compra del período. El % es IVA ÷ base sin IVA.</>,
  },
  gasto_operativo: {
    titulo: 'Gasto operativo',
    texto: <>Compras sin IVA del período de artículos con categoría “Gastos de Operación” en el ERP.</>,
  },
  centros_costo: {
    titulo: 'Centros de costo',
    texto: <>El ERP registra el centro de costo en la sublínea del artículo de gasto. Se cuentan las sublíneas distintas con gasto en el período.</>,
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
      <Nota>Incluye materia prima, que no se vende directamente; para distinguirla ver Salud financiera › Capital inmovilizado.</Nota>
    </>,
  },
  dias_inventario_grupo: {
    titulo: 'Días de inventario',
    texto: <>Valor del stock del grupo ÷ su costo vendido diario en el período. “Sin venta en el período” = sin costo vendido.</>,
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

  // ======================= Salud financiera =======================
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
    titulo: 'Días de inventario',
    texto: <>
      365 ÷ rotación: para cuántos días alcanza lo que hay en bodega al ritmo de salida del período.
      <Nota>Para toda la empresa es el mismo número que “Días de inventario” en el ciclo de caja de Salud financiera; puede variar unos días porque aquí se usa el inventario promedio.</Nota>
    </>,
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
    texto: <>
      <L>
        <li><strong>Producto terminado:</strong> costo de ventas ÷ su inventario.</li>
        <li><strong>Materia prima:</strong> no se vende, se consume en producción. Se mide con lo comprado en el período (lo que se consume se repone) ÷ su inventario.</li>
        <li><strong>Sin movimiento:</strong> sin ventas ni compras registradas; no rota.</li>
      </L>
      <Nota>Por eso la rotación total no es el promedio de las tres: el costo de ventas ya incluye la materia prima consumida.</Nota>
    </>,
  },
  salida_articulo: {
    titulo: 'Salida del período',
    texto: <>Producto terminado: costo de lo vendido. Materia prima: lo comprado en el período, como aproximación de lo consumido. Ambos a costo, sin IVA.</>,
  },
  inventario_vs_costo: {
    titulo: 'Peso en inventario vs en costo de ventas',
    texto: <>
      Qué parte del inventario total tiene cada grupo (azul) y qué parte del costo de ventas genera (verde).
      <Nota>Si el azul es mucho mayor que el verde, ese grupo acumula más inventario del que su venta justifica y rota más lento que el promedio.</Nota>
    </>,
  },
  sin_salida: {
    titulo: 'Sin salida',
    texto: <>Inventario de artículos que no tuvieron ninguna venta (producto) ni compra (materia prima) en el período.</>,
  },
  distribucion_rotacion: {
    titulo: 'Para cuánto alcanza',
    texto: <>Cada artículo con stock se ubica según sus días de inventario (su inventario ÷ su salida diaria del período) y se suma su valor. “Sin salida”: no se vendió ni se compró en el período.</>,
  },
  salida_mensual: {
    titulo: 'Salida mensual',
    texto: <>Costo de ventas y compras sin IVA de los artículos de la selección, por mes. Muestra si se está comprando más de lo que se vende (el inventario crece).</>,
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
  inmovilizado: {
    titulo: 'Inmovilizado',
    texto: <>
      Stock que no se ha movido en mucho tiempo:
      <L>
        <li><strong>Producto</strong> sin ventas en los últimos 180 días.</li>
        <li><strong>Materia prima</strong> sin compras en los últimos 365 días.</li>
        <li>Artículos <strong>sin ningún movimiento</strong> registrado.</li>
      </L>
    </>,
  },
  lento: {
    titulo: 'Lento',
    texto: <>Se sigue moviendo, pero hay de más: el stock alcanza para <strong>más de 180 días</strong> al ritmo actual, o no tuvo consumo en la ventana reciente. Ver “Cobertura” para cómo se mide el ritmo.</>,
  },
  activo: {
    titulo: 'Activo',
    texto: <>Se mueve y su stock alcanza para 180 días o menos al ritmo actual.</>,
  },
  quieto: {
    titulo: 'Capital quieto',
    texto: <>Capital quieto = inmovilizado + lento. <br />% quieto = capital quieto ÷ inventario a costo.</>,
  },
  cobertura: {
    titulo: 'Cobertura (días)',
    texto: <>
      Cuántos días alcanza el stock al ritmo de consumo actual: valor del stock ÷ consumo diario.
      <L>
        <li><strong>Producto:</strong> costo vendido en los últimos 180 días ÷ 180.</li>
        <li><strong>Materia prima:</strong> compras de los últimos 365 días ÷ 365 (no hay datos de consumo en producción; lo comprado se usa como aproximación).</li>
      </L>
      <Nota>En un grupo se suman el valor y el consumo de sus artículos; los que no tienen consumo suben la cobertura.</Nota>
    </>,
  },
  articulos: {
    titulo: 'Artículos quietos',
    texto: <>Artículos en estado lento o inmovilizado, sobre el total de artículos con existencia.</>,
  },
  tipo: {
    titulo: 'Tipo de inventario',
    texto: <>
      Se clasifica por la historia de cada artículo:
      <L>
        <li><strong>Producto:</strong> se ha vendido alguna vez.</li>
        <li><strong>Materia prima:</strong> nunca se ha vendido, pero se compra.</li>
        <li><strong>Sin movimiento:</strong> no tiene ventas ni compras registradas.</li>
      </L>
    </>,
  },
  antiguedad: {
    titulo: 'Antigüedad',
    texto: <>Días desde el último movimiento: la última <strong>venta</strong> para producto y la última <strong>compra</strong> para materia prima. “Sin registro” son artículos sin ventas ni compras.</>,
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
