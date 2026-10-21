// Una agregación para pantallas, totales y agentes. El agregado en Postgres
// separa CPP Laminados del método ERP que conservan las demás líneas.
const col = (a, c) => a ? `${a}.${c}` : c;
function agregado(a = '', cond) {
  const cols = ['es_cpp','total_sin_iva','costo_total_facturado','margen_bruto','ventas_base_margen'];
  return `analitica.margen_comercial(${cols.map((c) => col(a,c)).join(',')})${cond ? ` FILTER (WHERE ${cond})` : ''}`;
}
const campo = (k) => (a = '', cond) => `((${agregado(a,cond)}->>'${k}')::numeric)`;
module.exports = { pct:campo('pct'), margen:campo('margen'), costo:campo('costo'),
  pctSinCosto:campo('pct_sin_costo'), base:campo('base') };
