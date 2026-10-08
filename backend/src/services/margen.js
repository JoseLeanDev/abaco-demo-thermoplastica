// Margen bruto con un solo criterio para todo el sitio.
//
// ~4% de las ventas viene del ERP SIN COSTO (costo_promedio_facturado = 0). Con la
// fórmula ingenua esas líneas cuentan como 100% de margen e inflan el resultado
// (p. ej. un vendedor con 13% de ventas sin costo subía de 38% a 46%).
//
// Criterio:
// - margen %  = Σ margen ÷ Σ ventas, SOLO sobre líneas con costo conocido.
// - margen Q  = ventas totales × margen % (se asume que las líneas sin costo
//               tienen el mismo margen que las que sí lo tienen).
// - costo Q   = ventas totales − margen Q, para que ventas − costo = margen cuadre.
// - pct_sin_costo = % de las ventas que vino sin costo, para mostrarlo al lado.
//
// Cada función devuelve un fragmento SQL de agregación. `a` es el alias de
// fact_ventas_linea ('' si la consulta no usa alias) y `cond` una condición
// extra opcional para usar el agregado con FILTER (p. ej. un rango de fechas).

const col = (a, c) => (a ? `${a}.${c}` : c);
const filtro = (...conds) => {
  const c = conds.filter(Boolean);
  return c.length ? ` FILTER (WHERE ${c.join(' AND ')})` : '';
};

const conCosto = (a) => `${col(a, 'costo_total_facturado')} > 0`;
const sinCosto = (a) => `COALESCE(${col(a, 'costo_total_facturado')}, 0) = 0`;

// Margen % (NULL si no hay ninguna línea con costo)
const pct = (a = '', cond) =>
  `(SUM(${col(a, 'margen_bruto')})${filtro(cond, conCosto(a))}` +
  ` / NULLIF(SUM(${col(a, 'total_sin_iva')})${filtro(cond, conCosto(a))}, 0) * 100)`;

// Margen en Q extrapolado a todas las ventas (NULL si el grupo no tiene ninguna
// línea con costo: no se puede saber su margen)
const margen = (a = '', cond) =>
  `(SUM(${col(a, 'total_sin_iva')})${filtro(cond)} * ${pct(a, cond)} / 100)`;

// Costo de ventas en Q coherente con el margen anterior
const costo = (a = '', cond) =>
  `(COALESCE(SUM(${col(a, 'total_sin_iva')})${filtro(cond)}, 0) - ${margen(a, cond)})`;

// % de las ventas que vino sin costo
const pctSinCosto = (a = '', cond) =>
  `COALESCE(SUM(${col(a, 'total_sin_iva')})${filtro(cond, sinCosto(a))}` +
  ` / NULLIF(SUM(${col(a, 'total_sin_iva')})${filtro(cond)}, 0) * 100, 0)`;

module.exports = { pct, margen, costo, pctSinCosto };
