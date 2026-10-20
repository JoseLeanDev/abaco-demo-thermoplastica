// ---------------------------------------------------------------------------
// Tipo de compra (lo usan Compras y Análisis › Ventas vs compras)
//
// En el ERP todo entra como "factura de compra", pero no todo es inventario.
// Se clasifica cada línea por la jerarquía del artículo:
//   - Gastos de operación: categoría contable "Gastos de Operación" (es_gasto_operativo),
//     costos administrativos y servicios sin clasificar.
//   - Costos de producción: servicios, repuestos y mantenimiento cargados al costo.
//   - Gastos de importación: fletes, aduana y demás costos de traer mercadería.
//   - Activo fijo: compras de mobiliario/equipo.
//   - Materiales e insumos: todo lo demás (lo que entra al inventario).
// ---------------------------------------------------------------------------
const TIPO_EXPR = `(CASE
  WHEN COALESCE(a.es_gasto_operativo, FALSE)
       OR a.linea IN ('Gastos de Operación', 'Costos Administrativos')          THEN 'gasto'
  WHEN a.linea ILIKE 'activo fijo%'                                            THEN 'activo'
  WHEN a.linea ILIKE 'gastos de importaci%'                                    THEN 'importacion'
  WHEN a.linea ILIKE 'costo% de producci%'                                     THEN 'produccion'
  WHEN a.marca IN ('Contable', 'Articulos de Servicio')                        THEN 'gasto'
  ELSE 'inventario' END)`;

const TIPOS = [
  { id: 'inventario',  label: 'Materiales e insumos' },
  { id: 'produccion',  label: 'Costos de producción' },
  { id: 'importacion', label: 'Gastos de importación' },
  { id: 'gasto',       label: 'Gastos de operación' },
  { id: 'activo',      label: 'Activo fijo' },
];

module.exports = { TIPO_EXPR, TIPOS };
